<?php
declare(strict_types=1);
session_start();
header('Content-Type: application/json; charset=utf-8');

// --- Basic config for XAMPP/MySQL ---
$dbConfig = [
  'host' => '127.0.0.1',
  'port' => '3306',
  'name' => 'edupath',
  'user' => 'root',
  'pass' => '',
  'charset' => 'utf8mb4'
];

// --- Helpers ---
function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  global $dbConfig;
  $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', $dbConfig['host'], $dbConfig['port'], $dbConfig['name'], $dbConfig['charset']);
  $pdo = new PDO($dsn, $dbConfig['user'], $dbConfig['pass'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  return $pdo;
}

function json_response($data, int $status = 200): void {
  http_response_code($status);
  echo json_encode(['success' => $status < 400, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function json_error(string $message, int $status = 400, $details = null): void {
  http_response_code($status);
  echo json_encode(['success' => false, 'error' => $message, 'details' => $details], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function body_json(): array {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}

function current_user(): ?array {
  if (empty($_SESSION['user_id'])) return null;
  return fetch_user((int)$_SESSION['user_id']);
}

function require_auth(): array {
  $u = current_user();
  if (!$u) json_error('Unauthorized', 401);
  return $u;
}

function require_admin(array $user): void {
  if (($user['role'] ?? 'student') !== 'admin') json_error('Forbidden', 403);
}

function fetch_user(int $id): ?array {
  $pdo = db();
  $st = $pdo->prepare('SELECT id, first_name, last_name, email, phone, birthdate, gender, education_level, role, created_at FROM users WHERE id=?');
  $st->execute([$id]);
  return $st->fetch() ?: null;
}

function validate_required(array $data, array $fields): void {
  $missing = [];
  foreach ($fields as $f) {
    if (!isset($data[$f]) || $data[$f] === '') $missing[] = $f;
  }
  if ($missing) json_error('Validation failed', 422, ['missing' => $missing]);
}

// --- Routing ---
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = body_json();
$pdo = db();

try {
  switch ($action) {
    case 'health':
      json_response(['status' => 'ok', 'time' => date(DATE_ATOM)]);

    case 'register':
      validate_required($input, ['first_name', 'last_name', 'email', 'password']);
      $st = $pdo->prepare('SELECT id FROM users WHERE email=?');
      $st->execute([$input['email']]);
      if ($st->fetch()) json_error('Email already registered', 422, ['email' => 'taken']);
      $hash = password_hash((string)$input['password'], PASSWORD_BCRYPT);
      $ins = $pdo->prepare('INSERT INTO users (first_name, last_name, email, phone, birthdate, gender, education_level, role, password_hash) VALUES (?,?,?,?,?,?,?,?,?)');
      $ins->execute([
        $input['first_name'],
        $input['last_name'],
        $input['email'],
        $input['phone'] ?? null,
        $input['birthdate'] ?? null,
        $input['gender'] ?? null,
        $input['education_level'] ?? null,
        'student',
        $hash
      ]);
      $_SESSION['user_id'] = (int)$pdo->lastInsertId();
      json_response(['user' => fetch_user((int)$_SESSION['user_id'])], 201);

    case 'login':
      validate_required($input, ['email', 'password']);
      $st = $pdo->prepare('SELECT id, password_hash FROM users WHERE email=?');
      $st->execute([$input['email']]);
      $row = $st->fetch();
      if (!$row || !password_verify((string)$input['password'], $row['password_hash'])) {
        json_error('Invalid credentials', 401);
      }
      $_SESSION['user_id'] = (int)$row['id'];
      json_response(['user' => fetch_user((int)$row['id'])]);

    case 'logout':
      session_destroy();
      json_response(['logged_out' => true]);

    case 'me':
      $u = require_auth();
      json_response($u);

    case 'list_quizzes':
      $st = $pdo->query('SELECT id, title, description, is_active, created_at FROM quizzes ORDER BY id DESC');
      json_response($st->fetchAll());

    case 'create_quiz':
      $u = require_auth(); require_admin($u);
      validate_required($input, ['title']);
      $ins = $pdo->prepare('INSERT INTO quizzes (title, description, is_active) VALUES (?,?,?)');
      $ins->execute([$input['title'], $input['description'] ?? null, isset($input['is_active']) ? (int)$input['is_active'] : 1]);
      json_response(['quiz_id' => (int)$pdo->lastInsertId()]);

    case 'list_questions':
      $quizId = (int)($_GET['quiz_id'] ?? 1);
      $qs = $pdo->prepare('SELECT id, quiz_id, question_text, question_type, options_json, is_required FROM quiz_questions WHERE quiz_id=? ORDER BY id');
      $qs->execute([$quizId]);
      $rows = $qs->fetchAll();
      foreach ($rows as &$r) {
        $r['options'] = $r['options_json'] ? json_decode($r['options_json'], true) : [];
        unset($r['options_json']);
      }
      json_response($rows);

    case 'add_question':
      $u = require_auth(); require_admin($u);
      validate_required($input, ['quiz_id', 'question_text']);
      $options = isset($input['options']) ? json_encode($input['options']) : null;
      $ins = $pdo->prepare('INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, is_required) VALUES (?,?,?,?,?)');
      $ins->execute([
        (int)$input['quiz_id'],
        $input['question_text'],
        $input['question_type'] ?? 'choice',
        $options,
        isset($input['is_required']) ? (int)$input['is_required'] : 1
      ]);
      json_response(['question_id' => (int)$pdo->lastInsertId()]);

    case 'save_attempt':
      $u = require_auth();
      validate_required($input, ['quiz_id', 'answers']);
      $answers = $input['answers'];
      if (!is_array($answers)) json_error('Answers must be an object/array', 422);
      $ins = $pdo->prepare('INSERT INTO quiz_attempts (quiz_id, user_id, composite_score, duration_seconds, answers_json) VALUES (?,?,?,?,?)');
      $ins->execute([
        (int)$input['quiz_id'],
        (int)$u['id'],
        isset($input['composite_score']) ? (float)$input['composite_score'] : null,
        isset($input['duration_seconds']) ? (int)$input['duration_seconds'] : null,
        json_encode($answers)
      ]);
      json_response(['attempt_id' => (int)$pdo->lastInsertId()]);

    case 'latest_attempt':
      $u = require_auth();
      $quizId = (int)($_GET['quiz_id'] ?? 1);
      $st = $pdo->prepare('SELECT * FROM quiz_attempts WHERE user_id=? AND quiz_id=? ORDER BY created_at DESC LIMIT 1');
      $st->execute([(int)$u['id'], $quizId]);
      $row = $st->fetch();
      if (!$row) json_error('Not found', 404);
      $row['answers'] = $row['answers_json'] ? json_decode($row['answers_json'], true) : [];
      unset($row['answers_json']);
      json_response($row);

    case 'list_attempts':
      $u = require_auth();
      $targetUser = ($u['role'] === 'admin' && isset($_GET['user_id'])) ? (int)$_GET['user_id'] : (int)$u['id'];
      $quizId = isset($_GET['quiz_id']) ? (int)$_GET['quiz_id'] : null;
      $sql = 'SELECT id, quiz_id, user_id, composite_score, duration_seconds, answers_json, created_at FROM quiz_attempts WHERE user_id=?';
      $params = [$targetUser];
      if ($quizId) { $sql .= ' AND quiz_id=?'; $params[] = $quizId; }
      $sql .= ' ORDER BY created_at DESC';
      $st = $pdo->prepare($sql); $st->execute($params);
      $rows = $st->fetchAll();
      foreach ($rows as &$r) { $r['answers'] = $r['answers_json'] ? json_decode($r['answers_json'], true) : []; unset($r['answers_json']); }
      json_response($rows);

    case 'ai_suggest_major':
      $u = require_auth();
      validate_required($input, ['gat_score', 'tahsili_score', 'certificate_base64']);
      $gpa = isset($input['gpa']) ? (float)$input['gpa'] : 0.0; // GPA assumed extracted from certificate later
      $gat = (float)$input['gat_score'];
      $tahsili = (float)$input['tahsili_score'];
      $subjects = is_array($input['subject_scores'] ?? null) ? $input['subject_scores'] : [];
      $certPath = save_certificate_image($u['id'], $input['certificate_base64']);
      $major = ai_recommend_major($gpa, $gat, $tahsili, $subjects, $certPath);
      $pdo->prepare('UPDATE users SET ai_recommendation=? WHERE id=?')->execute([$major, (int)$u['id']]);
      json_response($major);

    default:
      json_error('Route not found', 404);
  }
} catch (Throwable $e) {
  json_error('Server error', 500, $e->getMessage());
}

// --- AI helper functions ---
function save_certificate_image(int $userId, string $base64): ?string {
  if (!$base64) return null;
  $data = base64_decode($base64);
  if ($data === false) return null;
  $dir = __DIR__ . '/uploads';
  if (!is_dir($dir)) mkdir($dir, 0775, true);
  $file = $dir . '/cert_' . $userId . '_' . time() . '.png';
  file_put_contents($file, $data);
  return $file;
}

function ai_recommend_major(float $gpa, float $gat, float $tahsili, array $subjects, ?string $certPath): string {
  $apiKey = getenv('OPENROUTER_API_KEY');
  $guidelines = "حدود القبول التقريبية بالسعودية: طب (GPA>=95,GAT>=90,TAHSILI>=90)، أسنان (93/88/88)، صيدلة (92/85/85)، هندسة (85/80/80)، حاسب (85/80/75)، علوم (80/75/0)، إدارة أعمال (75/70/0)، إنسانيات (60/0/0). أمثلة للتخصصات السعودية المتوقعة: General Doctor, Dentistry, Pharmacy, Mechanical Engineer, Electrical Engineer, Civil Engineer, Computer Science, Cybersecurity, Data Science, Nursing, Business Administration, Finance, Accounting, English Literature, Law, Sharia, Design, Interior Design.";
  $subjectText = '';
  foreach ($subjects as $s) {
    if (!isset($s['subject'])) continue;
    $subjectText .= $s['subject'] . ':' . ($s['score'] ?? 'N/A') . ', ';
  }
  $prompt = "أنت مستشار قبول جامعي سعودي. لديك درجات طالب وشهادة ثانوي ممسوحة (اختياري). قدم تخصصاً واحداً فقط باللغة الإنجليزية بكلمة أو كلمتين (مثل General Doctor, Mechanical Engineer, Computer Science) بدون أي شرح أو JSON. إذا كان الطالب مناسباً للطب أجب بكلمة General Doctor.\n".
            "البيانات:\n- المعدل التراكمي من الشهادة (إن وجد): {$gpa}\n- قدرات: {$gat}\n- تحصيلي: {$tahsili}\n- درجات المواد من الشهادة: {$subjectText}\n".
            "$guidelines\n".
            "أجب بكلمة تخصص واحدة فقط مثل Doctor أو Pharmacy أو Computer-Science بدون أي نص آخر.";

  if (!$apiKey) {
    // Fallback heuristic if key missing
    return heuristic_reco($gpa, $gat, $tahsili);
  }

  $body = [
    'model' => 'nvidia/nemotron-nano-12b-v2-vl:free',
    'messages' => [
      ['role'=>'system','content'=>'انت خبير قبول جامعي سعودي دقيق وصارم بالنسب.'],
      ['role'=>'user','content'=>$prompt]
    ]
  ];

  $ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'Authorization: Bearer ' . $apiKey,
      'HTTP-Referer: http://localhost',
      'X-Title: EduPath AI'
    ],
    CURLOPT_POSTFIELDS => json_encode($body)
  ]);
  $resp = curl_exec($ch);
  if ($resp === false) {
    return heuristic_reco($gpa, $gat, $tahsili);
  }
  $decoded = json_decode($resp, true);
  $text = $decoded['choices'][0]['message']['content'] ?? '';
  $major = sanitize_major_output($text);
  if (!$major) {
    return heuristic_reco($gpa, $gat, $tahsili);
  }
  return $major;
}

function heuristic_reco(float $gpa, float $gat, float $tahsili): string {
  $options = [
    ['major'=>'General Doctor', 'gpa'=>95, 'gat'=>90, 'tahsili'=>90],
    ['major'=>'Dentistry', 'gpa'=>93, 'gat'=>88, 'tahsili'=>88],
    ['major'=>'Pharmacy', 'gpa'=>92, 'gat'=>85, 'tahsili'=>85],
    ['major'=>'Mechanical Engineer', 'gpa'=>85, 'gat'=>80, 'tahsili'=>80],
    ['major'=>'Electrical Engineer', 'gpa'=>85, 'gat'=>80, 'tahsili'=>80],
    ['major'=>'Computer Science', 'gpa'=>85, 'gat'=>80, 'tahsili'=>75],
    ['major'=>'Cybersecurity', 'gpa'=>85, 'gat'=>80, 'tahsili'=>75],
    ['major'=>'Data Science', 'gpa'=>85, 'gat'=>80, 'tahsili'=>75],
    ['major'=>'Nursing', 'gpa'=>80, 'gat'=>70, 'tahsili'=>0],
    ['major'=>'Business Administration', 'gpa'=>75, 'gat'=>70, 'tahsili'=>0],
    ['major'=>'Finance', 'gpa'=>75, 'gat'=>70, 'tahsili'=>0],
    ['major'=>'Accounting', 'gpa'=>75, 'gat'=>70, 'tahsili'=>0],
    ['major'=>'Law', 'gpa'=>70, 'gat'=>0, 'tahsili'=>0],
    ['major'=>'English Literature', 'gpa'=>70, 'gat'=>0, 'tahsili'=>0],
    ['major'=>'Sharia', 'gpa'=>65, 'gat'=>0, 'tahsili'=>0],
    ['major'=>'Humanities', 'gpa'=>60, 'gat'=>0, 'tahsili'=>0],
  ];
  foreach ($options as $opt) {
    if ($gpa >= $opt['gpa'] && $gat >= $opt['gat'] && $tahsili >= $opt['tahsili']) {
      return $opt['major'];
    }
  }
  return 'Humanities';
}

function sanitize_major_output(string $text): string {
  $clean = trim($text);
  $clean = preg_replace('/[\\r\\n]+/', ' ', $clean);
  $clean = preg_replace('/[^\\p{L}\\p{Nd}\\- ]+/u', '', $clean);
  $clean = trim($clean);
  if (!$clean) return '';
  $words = explode(' ', $clean);
  $clean = implode(' ', array_slice($words, 0, 3));
  if (stripos($clean, 'doctor') !== false || stripos($clean, 'medicin') !== false) {
    return 'General Doctor';
  }
  return $clean;
}
