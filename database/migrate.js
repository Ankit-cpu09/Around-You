/**
 * Migration script for Around You platform upgrades.
 * Safely adds new tables and columns without breaking existing data.
 * Can be run multiple times (idempotent).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/db');

async function migrate() {
  console.log('🔄 Starting database migration...\n');

  const queries = [
    // 1. OTP codes table
    {
      name: 'Create otp_codes table',
      sql: `CREATE TABLE IF NOT EXISTS otp_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        code VARCHAR(6) NOT NULL,
        purpose ENUM('login', 'reset_password') NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    // 2. Job questions (Q&A) table
    {
      name: 'Create job_questions table',
      sql: `CREATE TABLE IF NOT EXISTS job_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_id INT NOT NULL,
        worker_id INT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT DEFAULT NULL,
        answered_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id),
        FOREIGN KEY (worker_id) REFERENCES users(id)
      )`
    },
    // 3. Add email column to users
    {
      name: 'Add email column to users',
      sql: `ALTER TABLE users ADD COLUMN email VARCHAR(255) DEFAULT NULL`
    },
    // 4. Add category column to jobs
    {
      name: 'Add category column to jobs',
      sql: `ALTER TABLE jobs ADD COLUMN category VARCHAR(50) DEFAULT 'General'`
    },
    // 5. Add avg_rating column to users
    {
      name: 'Add avg_rating column to users',
      sql: `ALTER TABLE users ADD COLUMN avg_rating DECIMAL(2,1) DEFAULT 0.0`
    },
    // 6. Add total_jobs_completed column to users
    {
      name: 'Add total_jobs_completed column to users',
      sql: `ALTER TABLE users ADD COLUMN total_jobs_completed INT DEFAULT 0`
    }
  ];

  for (const q of queries) {
    try {
      await pool.query(q.sql);
      console.log(`  ✅ ${q.name}`);
    } catch (err) {
      // Column/table already exists — that's fine
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR' || 
          err.message.includes('Duplicate column') || err.message.includes('already exists')) {
        console.log(`  ⏩ ${q.name} (already exists, skipping)`);
      } else {
        console.error(`  ❌ ${q.name}: ${err.message}`);
      }
    }
  }

  console.log('\n✅ Migration completed!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
