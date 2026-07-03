const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

if (process.env.DATABASE_URL) {
  console.log('🔌 Connecting using DATABASE_URL (Railway/Prod mode)');
  pool = mysql.createPool(process.env.DATABASE_URL);
} else {
  console.log('🔌 Connecting using individual DB_Config variables (Local mode)');
  const dbConfig = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'traderdb',
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 30000,
    queueLimit: 0
  };

  // Use socketPath if provided (for XAMPP/MariaDB local connection)
  if (process.env.DB_SOCKET_PATH) {
    dbConfig.socketPath = process.env.DB_SOCKET_PATH;
  } else {
    dbConfig.host = process.env.DB_HOST || 'localhost';
    dbConfig.port = parseInt(process.env.DB_PORT || '3306');
  }

  pool = mysql.createPool(dbConfig);
}

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL Connected Successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ MySQL Connection Failed:', err.message);
  });

module.exports = pool;
