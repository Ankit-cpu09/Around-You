/**
 * Cloud Database Initialization Script
 * Run this ONCE after setting up your cloud MySQL database
 * Usage: node database/init-cloud.js
 * 
 * Required env vars: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
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
    multipleStatements: true
  };

  if (process.env.DB_SSL === 'true') {
    config.ssl = { rejectUnauthorized: true };
  }

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to cloud database!\n');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await connection.execute(stmt);
        const tableName = stmt.match(/CREATE TABLE.*?(\w+)\s*\(/i);
        if (tableName) {
          console.log(`✅ Created table: ${tableName[1]}`);
        }
      } catch (err) {
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⏭️  Table already exists, skipping...`);
        } else {
          console.error(`❌ Error: ${err.message}`);
        }
      }
    }

    // Verify tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\n📋 Tables in database:');
    tables.forEach(t => {
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
