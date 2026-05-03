/**
 * Cloud Database Initialization Script
 * Run this ONCE after setting up your cloud MySQL database
 * Usage: node database/init-cloud.js
 * 
 * Required env vars: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function initCloudDB() {
  console.log('🔗 Connecting to cloud MySQL...');
  console.log(`   Host: ${process.env.DB_HOST}`);
  console.log(`   Port: ${process.env.DB_PORT || 3306}`);
  console.log(`   User: ${process.env.DB_USER}`);
  console.log(`   Database: ${process.env.DB_NAME}`);
  console.log(`   SSL: ${process.env.DB_SSL || 'false'}`);

  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (process.env.DB_SSL === 'true') {
    config.ssl = { rejectUnauthorized: true };
  }

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to cloud database!\n');

    // Create tables in dependency order (no foreign key issues)
    const tables = [
      {
        name: 'users',
        sql: `CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('employer', 'worker') NOT NULL,
          skills VARCHAR(255) DEFAULT NULL,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'jobs',
        sql: `CREATE TABLE IF NOT EXISTS jobs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          employer_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2) NOT NULL,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          status ENUM('pending', 'accepted', 'completed') DEFAULT 'pending',
          payment_status VARCHAR(20) DEFAULT 'unpaid',
          assigned_worker_id INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (employer_id) REFERENCES users(id),
          FOREIGN KEY (assigned_worker_id) REFERENCES users(id)
        )`
      },
      {
        name: 'applications',
        sql: `CREATE TABLE IF NOT EXISTS applications (
          job_id INT NOT NULL,
          worker_id INT NOT NULL,
          status ENUM('applied', 'accepted', 'rejected') DEFAULT 'applied',
          PRIMARY KEY (job_id, worker_id),
          FOREIGN KEY (job_id) REFERENCES jobs(id),
          FOREIGN KEY (worker_id) REFERENCES users(id)
        )`
      },
      {
        name: 'ratings',
        sql: `CREATE TABLE IF NOT EXISTS ratings (
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
        )`
      }
    ];

    // Execute each table creation in order
    for (const table of tables) {
      try {
        await connection.execute(table.sql);
        console.log(`✅ Created table: ${table.name}`);
      } catch (err) {
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⏭️  Table ${table.name} already exists, skipping...`);
        } else {
          console.error(`❌ Error creating ${table.name}: ${err.message}`);
        }
      }
    }

    // Verify tables
    const [rows] = await connection.execute('SHOW TABLES');
    console.log('\n📋 Tables in database:');
    rows.forEach(t => {
      const name = Object.values(t)[0];
      console.log(`   - ${name}`);
    });

    await connection.end();
    console.log('\n🎉 Cloud database initialized successfully!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nMake sure your .env file has the correct cloud database credentials.');
    process.exit(1);
  }
}

initCloudDB();
