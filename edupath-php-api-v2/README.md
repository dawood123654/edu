# EduPath PHP Backend — Complete (No Framework)
**Pure PHP + PDO + JWT (no Composer)**. Production-friendly structure with authentication, CRUD, pagination, filtering, validation, and error handling.

> Works with your MySQL dump: `/mnt/data/edupath (1).sql` (import it first), then run `schema_extra.sql` to add users/auth tables.

## Features
- JWT Auth (HS256): register, login, refresh, logout, get profile
- Users: password hashing (bcrypt), unique email
- Role-based (user/admin) middleware for protected endpoints
- CRUD for: universities, university_colleges, college_rules, quiz_questions
- Query helpers: pagination (`page`, `limit`), search (`q`), sorting (`sort`, `order`)
- Input validation with clear 400 errors
- Consistent JSON error format; exception handler
- CORS enabled; OPTIONS preflight
- Simple file-based rate-limiter (dev-friendly)
- Secure PDO prepared statements
- Built-in PHP server ready: `php -S 0.0.0.0:8080 -t public`

## Quick Start
1) **Create DB & import your dump**:
```sql
CREATE DATABASE edupath CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
-- replace root/password as appropriate
mysql -u root -p edupath < "/mnt/data/edupath (1).sql"
```

2) **Add auth tables**:
```bash
mysql -u root -p edupath < schema_extra.sql
```

3) **Configure DB** in `config.local.php` (optional override):
```php
<?php
return [
  'db' => [
    'host' => '127.0.0.1',
    'port' => '3306',
    'name' => 'edupath',
    'user' => 'root',
    'pass' => 'PASSWORD',
  ],
  'jwt' => [
    'secret' => 'change-this-secret',
    'issuer' => 'edupath.api',
    'access_ttl' => 3600,      // 1h
    'refresh_ttl' => 1209600,  // 14d
  ]
];
```
> If `config.local.php` exists, it overrides `config.php`

4) **Run**:
```bash
php -S 0.0.0.0:8080 -t public
```
Open: http://localhost:8080/health

## Auth Flow
- `POST /auth/register` → email, password, name
- `POST /auth/login` → email, password → returns `access_token` + `refresh_token`
- `POST /auth/refresh` → refresh token (body) → new tokens
- `POST /auth/logout` → invalidates refresh token
- `GET /me` → current user (requires `Authorization: Bearer <access>`)

## Main Endpoints (examples)
### Universities
- `GET /universities?page=1&limit=20&q=King&sort=uni_id&order=asc`
- `GET /universities/{id}`
- `POST /universities` (admin) → `{ "uni_name": "...", "location": "..." }`
- `PUT /universities/{id}` (admin)
- `DELETE /universities/{id}` (admin)

### University Colleges
- `GET /universities/{id}/colleges`
- `POST /universities/{id}/colleges` (admin) → `{ "college_name": "...", "majors": "..." }`
- `PUT /colleges/{id}` (admin)
- `DELETE /colleges/{id}` (admin)

### College Rules
- `GET /college-rules`
- `POST /college-rules` (admin) → `{ "college_name": "...", "min_percent": 85 }`
- `PUT /college-rules/{id}` (admin)
- `DELETE /college-rules/{id}` (admin)

### Quiz Questions
- `GET /quiz-questions`
- `POST /quiz-questions` (admin) → `{ "question_text": "..." }`
- `PUT /quiz-questions/{id}` (admin)
- `DELETE /quiz-questions/{id}` (admin)

### Utilities
- `GET /search?college=Computer`
- `POST /eligibility` → `{ "percent": 85 }`

## Response Format
Errors:
```json
{ "error": { "message": "Validation failed", "details": {"email": "required"} } }
```
Success:
```json
{ "data": [...], "pagination": {"page":1, "limit":20, "total": 120} }
```
