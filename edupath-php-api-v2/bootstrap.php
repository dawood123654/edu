<?php
declare(strict_types=1);

// Error handling
set_exception_handler(function($e){
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['error' => ['message' => 'Server error', 'details' => $e->getMessage()]]);
  exit;
});

// Load config with local override
$default = require __DIR__ . '/config.php';
$localPath = __DIR__ . '/config.local.php';
if (file_exists($localPath)) $default = array_replace_recursive($default, require $localPath);
$config = $default;

// CORS
function cors(): void {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204); exit;
  }
}
cors();

// JSON helpers
function json_response($data, int $status=200): void {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function ok($data, $extra=[]){ json_response(array_merge(['data'=>$data], $extra)); }
function fail($message, $details=[], $code=400){ json_response(['error'=>['message'=>$message, 'details'=>$details]], $code); }

// Rate limit (dev): 60 req / 60s per IP
function rate_limit(): void {
  $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
  $file = sys_get_temp_dir() . '/rl_' . md5($ip);
  $now = time();
  $w = 60; $max=60;
  $data = ['window'=>$now, 'count'=>0];
  if (is_file($file)) $data = json_decode(file_get_contents($file), true) ?: $data;
  if ($now - $data['window'] >= $w) $data = ['window'=>$now, 'count'=>0];
  $data['count']++;
  file_put_contents($file, json_encode($data));
  if ($data['count'] > $max) fail('Rate limit exceeded', ['try_in'=>'60s'], 429);
}
rate_limit();

// DB (PDO)
function db(): PDO {
  static $pdo=null;
  if ($pdo) return $pdo;
  $cfg = $GLOBALS['config']['db'];
  $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', $cfg['host'],$cfg['port'],$cfg['name'],$cfg['charset'] ?? 'utf8mb4');
  $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  return $pdo;
}

// Request helpers
function body_json(): array {
  $raw = file_get_contents('php://input'); if (!$raw) return [];
  $j = json_decode($raw, true); return is_array($j) ? $j : [];
}
function route_params(string $pattern, string $path): ?array {
  $regex = preg_replace('#\{[^/]+\}#', '([^/]+)', $pattern);
  $regex = '#^' . $regex . '$#';
  if (preg_match($regex, $path, $m)) { array_shift($m); return $m; }
  return null;
}
function auth_header_token(): ?string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (preg_match('/Bearer\s+(.*)/i', $h, $m)) return trim($m[1]);
  return null;
}

// JWT (HS256)
function base64url_encode($data){ return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); }
function base64url_decode($data){ return base64_decode(strtr($data, '-_', '+/')); }
function jwt_sign(array $payload, int $ttl): string {
  $cfg = $GLOBALS['config']['jwt'];
  $header = ['alg'=>'HS256', 'typ'=>'JWT'];
  $now = time();
  $payload = array_merge($payload, [
    'iss'=>$cfg['issuer'],
    'iat'=>$now,
    'exp'=>$now + $ttl,
  ]);
  $seg1 = base64url_encode(json_encode($header));
  $seg2 = base64url_encode(json_encode($payload));
  $signature = hash_hmac('sha256', $seg1.'.'.$seg2, $cfg['secret'], true);
  $seg3 = base64url_encode($signature);
  return $seg1.'.'.$seg2.'.'.$seg3;
}
function jwt_verify(string $jwt){
  $cfg = $GLOBALS['config']['jwt'];
  $parts = explode('.', $jwt);
  if (count($parts)!==3) return null;
  [$h,$p,$s] = $parts;
  $sig = base64url_decode($s);
  $calc = hash_hmac('sha256', $h.'.'.$p, $cfg['secret'], true);
  if (!hash_equals($calc, $sig)) return null;
  $payload = json_decode(base64url_decode($p), true);
  if (!$payload || ($payload['exp'] ?? 0) < time()) return null;
  return $payload;
}

// Auth helpers
function require_auth(): array {
  $token = auth_header_token();
  if (!$token) fail('Unauthorized', ['auth'=>'missing bearer'], 401);
  $p = jwt_verify($token);
  if (!$p) fail('Unauthorized', ['auth'=>'invalid token'], 401);
  return $p; // contains user_id, role
}
function require_admin(array $auth): void {
  if (($auth['role'] ?? 'user') !== 'admin') fail('Forbidden', ['role'=>'admin required'], 403);
}

// Validation
function v_required($data, $fields){
  $errors = [];
  foreach($fields as $f){
    if (!isset($data[$f]) || $data[$f]==='') $errors[$f] = 'required';
  }
  if ($errors) fail('Validation failed', $errors, 400);
}

// Pagination/sorting
function pg_and_sort($allowedSortCols, $defaultSort='id'){
  $page = max(1, (int)($_GET['page'] ?? 1));
  $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
  $offset = ($page-1)*$limit;
  $sort = $_GET['sort'] ?? $defaultSort;
  $order = strtolower($_GET['order'] ?? 'asc'); $order = $order==='desc' ? 'DESC':'ASC';
  if (!in_array($sort, $allowedSortCols, true)) $sort = $defaultSort;
  return [$page,$limit,$offset,$sort,$order];
}
