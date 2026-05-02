const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kaamsetu_db',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
};

// Cloud databases (TiDB, Aiven, PlanetScale) require SSL
if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') {
  dbConfig.ssl = {
    rejectUnauthorized: true
  };
}

const pool = mysql.createPool(dbConfig);

module.exports = pool;
