-- Schema for Around You (KaamSetu) Platform
-- Compatible with TiDB Cloud, Aiven, and other cloud MySQL providers
-- Note: Database is pre-created by cloud provider, no CREATE DATABASE needed

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('employer', 'worker') NOT NULL,
  skills VARCHAR(255) DEFAULT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  avg_rating DECIMAL(2,1) DEFAULT 0.0,
  total_jobs_completed INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employer_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'General',
  price DECIMAL(10, 2) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  status ENUM('pending', 'accepted', 'completed') DEFAULT 'pending',
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  assigned_worker_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employer_id) REFERENCES users(id),
  FOREIGN KEY (assigned_worker_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS applications (
  job_id INT NOT NULL,
  worker_id INT NOT NULL,
  status ENUM('applied', 'accepted', 'rejected') DEFAULT 'applied',
  PRIMARY KEY (job_id, worker_id),
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (worker_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_user_id INT NOT NULL,
  to_user_id INT NOT NULL,
  job_id INT NOT NULL,
  rating INT NOT NULL CHECK(rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- OTP codes for login and password reset
CREATE TABLE IF NOT EXISTS otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  purpose ENUM('login', 'reset_password') NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Q&A: Workers can ask questions before accepting
CREATE TABLE IF NOT EXISTS job_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  worker_id INT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT DEFAULT NULL,
  answered_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (worker_id) REFERENCES users(id)
);
