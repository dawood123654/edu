-- Minimal EduPath schema (same as root database-init.sql) for convenience
SET NAMES utf8mb4;
USE edupath;

SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS quiz_attempts;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS quizzes;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  birthdate DATE NULL,
  gender ENUM('male','female','other') NULL,
  education_level VARCHAR(100) NULL,
  role ENUM('student','admin') NOT NULL DEFAULT 'student',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO users (first_name, last_name, email, role, password_hash)
VALUES ('Admin','User','admin@example.com','admin','$2y$10$9Bq7qD91J6r3h6cvQeY3gO8oE3xN3Ta9J0eUQGOzVii.mqDNe2Goe')
ON DUPLICATE KEY UPDATE email=email;

CREATE TABLE quizzes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO quizzes (id, title, description, is_active)
VALUES (1, 'استبيان المسار الأكاديمي', 'أسئلة بسيطة لتجميع اهتمامات الطالب', 1)
ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), is_active=VALUES(is_active);

CREATE TABLE quiz_questions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT UNSIGNED NOT NULL,
  question_text VARCHAR(500) NOT NULL,
  question_type ENUM('text','choice','number','boolean') NOT NULL DEFAULT 'choice',
  options_json JSON NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qq_quiz (quiz_id),
  CONSTRAINT fk_qq_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, is_required) VALUES
(1,'ما نوع الثانوية التي تخرجت منها؟','choice',JSON_ARRAY('حكومية','أهلية','عالمية'),1),
(1,'ما هو المسار الدراسي في الثانوية؟','choice',JSON_ARRAY('علمي','أدبي','شرعي','إداري','حاسب آلي'),1),
(1,'ما هو معدلك التراكمي من 100؟','number',NULL,1),
(1,'هل أديت اختبار القدرات العامة؟','choice',JSON_ARRAY('نعم','لا'),1),
(1,'هل أديت الاختبار التحصيلي؟','choice',JSON_ARRAY('نعم','لا'),1),
(1,'اختر اهتماماتك الدراسية المفضلة','text',NULL,0),
(1,'اذكر أي اختبارات أخرى لديك (IELTS/SAT وغيرها)','text',NULL,0),
(1,'ما المجالات التي ترغب في دراستها؟','text',NULL,0),
(1,'هل تفضل الدراسة النظرية أم التطبيقية؟','choice',JSON_ARRAY('نظرية','تطبيقية','كلاهما'),0),
(1,'كم ساعة تدرس يومياً خارج الصف؟','number',NULL,0);

CREATE TABLE quiz_attempts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  composite_score DECIMAL(5,2) NULL,
  duration_seconds INT NULL,
  answers_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attempt_user (user_id),
  INDEX idx_attempt_quiz (quiz_id),
  CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
