<?php
declare(strict_types=1);
require __DIR__ . '/../bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';

// Health
if ($method==='GET' && $uri==='/health'){ ok(['status'=>'ok','time'=>date(DATE_ATOM)]); }

// ===== AUTH =====
if ($method==='POST' && $uri==='/auth/register'){
  $d = body_json(); v_required($d, ['email','password','name']);
  $pdo = db();
  $pdo->beginTransaction();
  try {
    $st = $pdo->prepare('SELECT id FROM users WHERE email=?'); $st->execute([$d['email']]);
    if ($st->fetch()) fail('Validation failed', ['email'=>'already exists'], 400);
    $hash = password_hash((string)$d['password'], PASSWORD_BCRYPT);
    $first = $d['first_name'] ?? ($d['name'] ?? '');
    $last = $d['last_name'] ?? null;
    $name = trim($d['name'] ?? ($first . ' ' . ($last ?? '')));
    $role = 'user';
    $st = $pdo->prepare('INSERT INTO users (name,first_name,last_name,email,phone,birthdate,gender,education_level,password_hash,role) VALUES (?,?,?,?,?,?,?,?,?,?)');
    $st->execute([
      $name,
      $first ?: null,
      $last,
      $d['email'],
      $d['phone'] ?? null,
      $d['birthdate'] ?? null,
      $d['gender'] ?? null,
      $d['education_level'] ?? null,
      $hash,
      $role
    ]);
    $uid = (int)$pdo->lastInsertId();
    $tokens = issue_tokens($uid, $role);
    $pdo->commit();
    ok([
      'access_token'=>$tokens['access'],
      'refresh_token'=>$tokens['refresh'],
      'user'=>fetch_user($uid, $pdo)
    ]);
  } catch (Throwable $e){
    $pdo->rollBack();
    throw $e;
  }
}
if ($method==='POST' && $uri==='/auth/login'){
  $d = body_json(); v_required($d, ['email','password']);
  $pdo = db();
  $st = $pdo->prepare('SELECT id,password_hash,role,name,email,first_name,last_name,phone,birthdate,gender,education_level FROM users WHERE email=?'); $st->execute([$d['email']]);
  $u = $st->fetch();
  if (!$u || !password_verify((string)$d['password'], $u['password_hash'])) fail('Invalid credentials', [], 401);
  $tokens = issue_tokens((int)$u['id'], $u['role']);
  ok([
    'access_token'=>$tokens['access'],
    'refresh_token'=>$tokens['refresh'],
    'user'=>fetch_user((int)$u['id'], $pdo)
  ]);
}
if ($method==='POST' && $uri==='/auth/refresh'){
  $d = body_json(); v_required($d, ['refresh_token']);
  $pdo = db();
  $p = jwt_verify($d['refresh_token']);
  if (!$p || ($p['type'] ?? '')!=='refresh') fail('Invalid refresh token', [], 401);
  // check stored
  $st = $pdo->prepare('SELECT id, revoked FROM refresh_tokens WHERE token=? AND expires_at>NOW()'); $st->execute([$d['refresh_token']]);
  $row = $st->fetch(); if (!$row || (int)$row['revoked']===1) fail('Invalid refresh token', [], 401);
  $roleStmt = $pdo->prepare('SELECT role FROM users WHERE id=?'); $roleStmt->execute([$p['user_id']]);
  $role = $roleStmt->fetchColumn() ?: 'user';
  $access = jwt_sign(['user_id'=>$p['user_id'], 'role'=>$role], $GLOBALS['config']['jwt']['access_ttl']);
  ok(['access_token'=>$access]);
}
if ($method==='POST' && $uri==='/auth/logout'){
  $d = body_json(); v_required($d, ['refresh_token']);
  $pdo = db();
  $st = $pdo->prepare('UPDATE refresh_tokens SET revoked=1 WHERE token=?'); $st->execute([$d['refresh_token']]);
  ok(['logged_out'=>true]);
}
if ($method==='GET' && $uri==='/me'){
  $auth = require_auth();
  $pdo = db();
  ok(fetch_user((int)$auth['user_id'], $pdo));
}

// ===== HELPERS =====
function list_with_pagination($sqlBase, $countSql, $params, $allowedSort, $defaultSort){
  [$page,$limit,$offset,$sort,$order]=pg_and_sort($allowedSort,$defaultSort);
  $pdo = db();
  $sql = $sqlBase . " ORDER BY $sort $order LIMIT :limit OFFSET :offset";
  $st = $pdo->prepare($sql);
  foreach ($params as $i=>$v){ is_int($i) ? $st->bindValue($i+1,$v) : $st->bindValue($i,$v); }
  $st->bindValue(':limit',$limit, PDO::PARAM_INT);
  $st->bindValue(':offset',$offset, PDO::PARAM_INT);
  $st->execute();
  $rows = $st->fetchAll();
  $tc = $pdo->prepare($countSql);
  foreach ($params as $i=>$v){ is_int($i) ? $tc->bindValue($i+1,$v) : $tc->bindValue($i,$v); }
  $tc->execute();
  $total = (int)$tc->fetchColumn();
  ok($rows, ['pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total]]);
}

function fetch_user(int $id, ?PDO $pdo=null): array {
  $pdo = $pdo ?: db();
  $st = $pdo->prepare('SELECT id,name,first_name,last_name,email,phone,birthdate,gender,education_level,role,created_at FROM users WHERE id=?');
  $st->execute([$id]);
  $u = $st->fetch();
  if (!$u) fail('User not found', [], 404);
  return $u;
}

function issue_tokens(int $userId, string $role): array {
  $access = jwt_sign(['user_id'=>$userId, 'role'=>$role], $GLOBALS['config']['jwt']['access_ttl']);
  $refresh = jwt_sign(['user_id'=>$userId, 'role'=>$role, 'type'=>'refresh'], $GLOBALS['config']['jwt']['refresh_ttl']);
  $pdo = db();
  $st = $pdo->prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?,?, FROM_UNIXTIME(?))');
  $st->execute([$userId, $refresh, time()+$GLOBALS['config']['jwt']['refresh_ttl']]);
  return ['access'=>$access, 'refresh'=>$refresh];
}

// ===== UNIVERSITIES =====
if ($method==='GET' && $uri==='/universities'){
  $q = $_GET['q'] ?? '';
  $params = []; $where = '';
  if ($q!==''){ $where = ' WHERE uni_name LIKE ? OR location LIKE ? '; $params = ['%'.$q.'%','%'.$q.'%']; }
  list_with_pagination(
    'SELECT uni_id, uni_name, location FROM universities' . $where,
    'SELECT COUNT(*) FROM universities' . $where,
    $params,
    ['uni_id','uni_name','location'],
    'uni_id'
  );
}
if ($method==='GET' && ($p = route_params('/universities/{id}', $uri))){
  [$id] = $p; $pdo = db();
  $st = $pdo->prepare('SELECT uni_id, uni_name, location FROM universities WHERE uni_id=?'); $st->execute([$id]);
  $row = $st->fetch(); if (!$row) fail('Not found', [], 404); ok($row);
}
if ($method==='POST' && $uri==='/universities'){
  $auth = require_auth(); require_admin($auth);
  $d = body_json(); v_required($d,['uni_name','location']);
  $pdo = db(); $st=$pdo->prepare('INSERT INTO universities (uni_name, location) VALUES (?,?)');
  $st->execute([$d['uni_name'],$d['location']]); ok(['uni_id'=>$pdo->lastInsertId()]);
}
if ($method==='PUT' && ($p = route_params('/universities/{id}', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $d = body_json(); v_required($d,['uni_name','location']);
  $pdo = db(); $st=$pdo->prepare('UPDATE universities SET uni_name=?, location=? WHERE uni_id=?');
  $st->execute([$d['uni_name'],$d['location'],$id]); ok(['updated'=>true]);
}
if ($method==='DELETE' && ($p = route_params('/universities/{id}', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $pdo = db(); $st=$pdo->prepare('DELETE FROM universities WHERE uni_id=?'); $st->execute([$id]); ok(['deleted'=>true]);
}

// ===== COLLEGES =====
if ($method==='GET' && ($p = route_params('/universities/{id}/colleges', $uri))){
  [$id] = $p; $pdo = db();
  $st = $pdo->prepare('SELECT id, college_name, majors FROM university_colleges WHERE uni_id=? ORDER BY id'); $st->execute([$id]);
  ok($st->fetchAll());
}
if ($method==='POST' && ($p = route_params('/universities/{id}/colleges', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $d = body_json(); v_required($d,['college_name','majors']);
  $pdo = db(); $st=$pdo->prepare('INSERT INTO university_colleges (uni_id,college_name,majors) VALUES (?,?,?)');
  $st->execute([$id,$d['college_name'],$d['majors']]); ok(['id'=>$pdo->lastInsertId()]);
}
if ($method==='PUT' && ($p = route_params('/colleges/{id}', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $d = body_json(); v_required($d,['college_name','majors']);
  $pdo = db(); $st=$pdo->prepare('UPDATE university_colleges SET college_name=?, majors=? WHERE id=?');
  $st->execute([$d['college_name'],$d['majors'],$id]); ok(['updated'=>true]);
}
if ($method==='DELETE' && ($p = route_params('/colleges/{id}', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $pdo = db(); $st=$pdo->prepare('DELETE FROM university_colleges WHERE id=?');
  $st->execute([$id]); ok(['deleted'=>true]);
}

// ===== COLLEGE RULES =====
if ($method==='GET' && $uri==='/college-rules'){
  $pdo = db(); $st=$pdo->query('SELECT rule_id, college_name, min_percent FROM college_rules ORDER BY rule_id');
  ok($st->fetchAll());
}
if ($method==='POST' && $uri==='/college-rules'){
  $auth = require_auth(); require_admin($auth);
  $d = body_json(); v_required($d, ['college_name','min_percent']);
  $pdo = db(); $st=$pdo->prepare('INSERT INTO college_rules (college_name,min_percent) VALUES (?,?)');
  $st->execute([$d['college_name'], (int)$d['min_percent']]); ok(['rule_id'=>$pdo->lastInsertId()]);
}
if ($method==='PUT' && ($p = route_params('/college-rules/{id}', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $d = body_json(); v_required($d, ['college_name','min_percent']);
  $pdo = db(); $st=$pdo->prepare('UPDATE college_rules SET college_name=?, min_percent=? WHERE rule_id=?');
  $st->execute([$d['college_name'], (int)$d['min_percent'], $id]); ok(['updated'=>true]);
}
if ($method==='DELETE' && ($p = route_params('/college-rules/{id}', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $pdo = db(); $st=$pdo->prepare('DELETE FROM college_rules WHERE rule_id=?'); $st->execute([$id]); ok(['deleted'=>true]);
}

// ===== QUIZ QUESTIONS =====
if ($method==='GET' && $uri==='/quiz-questions'){
  $pdo = db();
  $quizId = $_GET['quiz_id'] ?? null;
  $sql = 'SELECT question_id, quiz_id, question_text, question_type, options_json, is_required FROM quiz_questions';
  $params = [];
  if ($quizId!==null && $quizId!=='') { $sql .= ' WHERE quiz_id=?'; $params[] = (int)$quizId; }
  $sql .= ' ORDER BY question_id';
  $st=$pdo->prepare($sql); $st->execute($params);
  $rows = $st->fetchAll();
  foreach ($rows as &$row){
    $row['options'] = $row['options_json'] ? json_decode($row['options_json'], true) : [];
    unset($row['options_json']);
  }
  ok($rows);
}
if ($method==='POST' && $uri==='/quiz-questions'){
  $auth = require_auth(); require_admin($auth);
  $d = body_json(); v_required($d, ['question_text']);
  $quizId = (int)($d['quiz_id'] ?? 1);
  $type = $d['question_type'] ?? 'choice';
  $options = array_key_exists('options', $d) ? $d['options'] : null;
  $pdo = db(); $st=$pdo->prepare('INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, is_required) VALUES (?,?,?,?,?)');
  $st->execute([$quizId, $d['question_text'], $type, $options !== null ? json_encode($options) : null, (int)($d['is_required'] ?? 1)]);
  ok(['question_id'=>$pdo->lastInsertId()]);
}
if ($method==='PUT' && ($p = route_params('/quiz-questions/{id}', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $d = body_json();
  $pdo = db();
  $fields = [];
  $params = [];
  if (isset($d['question_text'])) { $fields[]='question_text=?'; $params[]=$d['question_text']; }
  if (isset($d['quiz_id'])) { $fields[]='quiz_id=?'; $params[]=(int)$d['quiz_id']; }
  if (isset($d['question_type'])) { $fields[]='question_type=?'; $params[]=$d['question_type']; }
  if (array_key_exists('options', $d)) { $fields[]='options_json=?'; $params[]=$d['options'] ? json_encode($d['options']) : null; }
  if (isset($d['is_required'])) { $fields[]='is_required=?'; $params[]=(int)$d['is_required']; }
  if (!$fields) fail('Nothing to update', [], 400);
  $params[] = $id;
  $sql = 'UPDATE quiz_questions SET '.implode(',', $fields).' WHERE question_id=?';
  $st=$pdo->prepare($sql);
  $st->execute($params); ok(['updated'=>true]);
}
if ($method==='DELETE' && ($p = route_params('/quiz-questions/{id}', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $pdo = db(); $st=$pdo->prepare('DELETE FROM quiz_questions WHERE question_id=?');
  $st->execute([$id]); ok(['deleted'=>true]);
}

// ===== QUIZZES & ATTEMPTS =====
if ($method==='GET' && $uri==='/quizzes'){
  $pdo = db();
  $st = $pdo->query('SELECT q.id, q.title, q.description, q.is_active, q.created_at, q.created_by, u.name AS created_by_name FROM quizzes q LEFT JOIN users u ON q.created_by=u.id ORDER BY q.id');
  ok($st->fetchAll());
}
if ($method==='POST' && $uri==='/quizzes'){
  $auth = require_auth(); require_admin($auth);
  $d = body_json(); v_required($d, ['title']);
  $pdo = db();
  $st = $pdo->prepare('INSERT INTO quizzes (title, description, is_active, created_by) VALUES (?,?,?,?)');
  $st->execute([$d['title'], $d['description'] ?? null, (int)($d['is_active'] ?? 1), $auth['user_id']]);
  ok(['quiz_id'=>$pdo->lastInsertId()]);
}
if ($method==='GET' && ($p = route_params('/quizzes/{id}', $uri))){
  [$id] = $p; $pdo = db();
  $st = $pdo->prepare('SELECT q.id, q.title, q.description, q.is_active, q.created_at, q.created_by, u.name AS created_by_name FROM quizzes q LEFT JOIN users u ON q.created_by=u.id WHERE q.id=?');
  $st->execute([$id]); $quiz = $st->fetch(); if (!$quiz) fail('Not found', [], 404);
  $qs = $pdo->prepare('SELECT question_id, quiz_id, question_text, question_type, options_json, is_required FROM quiz_questions WHERE quiz_id=? ORDER BY question_id');
  $qs->execute([$id]);
  $questions = $qs->fetchAll();
  foreach ($questions as &$qItem){
    $qItem['options'] = $qItem['options_json'] ? json_decode($qItem['options_json'], true) : [];
    unset($qItem['options_json']);
  }
  $quiz['questions'] = $questions;
  ok($quiz);
}
if ($method==='POST' && ($p = route_params('/quizzes/{id}/questions', $uri))){
  $auth = require_auth(); require_admin($auth);
  [$id] = $p; $d = body_json(); v_required($d, ['question_text']);
  $pdo = db();
  $options = array_key_exists('options', $d) ? $d['options'] : null;
  $st=$pdo->prepare('INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, is_required) VALUES (?,?,?,?,?)');
  $st->execute([$id, $d['question_text'], $d['question_type'] ?? 'choice', $options !== null ? json_encode($options) : null, (int)($d['is_required'] ?? 1)]);
  ok(['question_id'=>$pdo->lastInsertId()]);
}
if ($method==='POST' && $uri==='/quiz-attempts'){
  $auth = require_auth();
  $d = body_json();
  $quizId = (int)($d['quiz_id'] ?? 1);
  $score = isset($d['composite_score']) ? (float)$d['composite_score'] : null;
  $duration = isset($d['duration_seconds']) ? (int)$d['duration_seconds'] : null;
  $answers = $d['answers'] ?? [];
  $pdo = db();
  $st = $pdo->prepare('INSERT INTO quiz_attempts (quiz_id, user_id, composite_score, duration_seconds, answers_json) VALUES (?,?,?,?,?)');
  $st->execute([$quizId, $auth['user_id'], $score, $duration, json_encode($answers)]);
  ok(['attempt_id'=>$pdo->lastInsertId(), 'quiz_id'=>$quizId, 'composite_score'=>$score, 'answers'=>$answers]);
}
if ($method==='GET' && $uri==='/quiz-attempts/latest'){
  $auth = require_auth();
  $quizId = (int)($_GET['quiz_id'] ?? 1);
  $pdo = db();
  $st = $pdo->prepare('SELECT qa.*, u.name AS user_name, q.title AS quiz_title FROM quiz_attempts qa LEFT JOIN users u ON qa.user_id=u.id LEFT JOIN quizzes q ON qa.quiz_id=q.id WHERE qa.user_id=? AND qa.quiz_id=? ORDER BY qa.created_at DESC LIMIT 1');
  $st->execute([$auth['user_id'], $quizId]);
  $row = $st->fetch(); if (!$row) fail('Not found', [], 404);
  $row['answers'] = $row['answers_json'] ? json_decode($row['answers_json'], true) : null;
  unset($row['answers_json']);
  ok($row);
}
if ($method==='GET' && $uri==='/quiz-attempts'){
  $auth = require_auth();
  $pdo = db();
  $userId = ($auth['role'] ?? 'user')==='admin' && isset($_GET['user_id']) ? (int)$_GET['user_id'] : (int)$auth['user_id'];
  $st = $pdo->prepare('SELECT qa.*, u.name AS user_name, q.title AS quiz_title FROM quiz_attempts qa LEFT JOIN users u ON qa.user_id=u.id LEFT JOIN quizzes q ON qa.quiz_id=q.id WHERE qa.user_id=? ORDER BY qa.created_at DESC');
  $st->execute([$userId]);
  $rows = $st->fetchAll();
  foreach ($rows as &$row){ $row['answers'] = $row['answers_json'] ? json_decode($row['answers_json'], true) : null; unset($row['answers_json']); }
  ok($rows);
}
if ($method==='GET' && ($p = route_params('/quiz-attempts/{id}', $uri))){
  $auth = require_auth(); [$id] = $p;
  $pdo = db();
  $st=$pdo->prepare('SELECT qa.*, u.name AS user_name, q.title AS quiz_title FROM quiz_attempts qa LEFT JOIN users u ON qa.user_id=u.id LEFT JOIN quizzes q ON qa.quiz_id=q.id WHERE qa.id=?');
  $st->execute([$id]);
  $row = $st->fetch();
  if (!$row) fail('Not found', [], 404);
  if ((int)$row['user_id'] !== (int)$auth['user_id'] && ($auth['role'] ?? 'user') !== 'admin') fail('Forbidden', [], 403);
  $row['answers'] = $row['answers_json'] ? json_decode($row['answers_json'], true) : null;
  unset($row['answers_json']);
  ok($row);
}

// ===== SEARCH & ELIGIBILITY =====
if ($method==='GET' && $uri==='/search'){
  $qstr = $_GET['college'] ?? '';
  $pdo = db();
  $st = $pdo->prepare('SELECT id, uni_id, college_name, majors FROM university_colleges WHERE college_name LIKE ? ORDER BY id');
  $st->execute(['%'.$qstr.'%']); ok($st->fetchAll());
}
if ($method==='POST' && $uri==='/eligibility'){
  $d = body_json(); v_required($d, ['percent']);
  $pdo = db();
  $st = $pdo->prepare('SELECT college_name, min_percent FROM college_rules WHERE min_percent <= ? ORDER BY min_percent DESC, college_name');
  $st->execute([(int)$d['percent']]);
  ok(['input_percent'=>(int)$d['percent'], 'eligible_colleges'=>$st->fetchAll()]);
}

// Fallback
fail('Route not found', ['path'=>$uri,'method'=>$method], 404);
