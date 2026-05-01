const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initDB() {
  try {
    // Connect without database first to create it if it doesn't exist
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });

    console.log('Connected to MySQL server.');

    // Create DB
    const dbName = process.env.DB_NAME || 'kaamsetu_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`Database ${dbName} created or already exists.`);

    await connection.query(`USE ${dbName}`);

    // Read schema.sql
    const schemaFile = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    
    // Quick parse: split by semicolon
    const statements = schemaFile.split(';').filter(stmt => stmt.trim() !== '');

    for (let stmt of statements) {
      await connection.query(stmt);
    }
    
    console.log('Schema imported successfully.');
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDB();
