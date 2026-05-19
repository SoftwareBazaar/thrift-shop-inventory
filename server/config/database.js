const { Pool } = require('pg');
const MockDatabase = require('./mock-database');
require('dotenv').config();

let pool;

// Check if we should use mock database
if (process.env.USE_MOCK_DB === 'true') {
  console.log('📝 Using mock database for development');
  pool = new MockDatabase();
} else {
  // Try to connect to PostgreSQL
  try {
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'thrift_shop',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Test database connection
    pool.on('connect', () => {
      console.log('Connected to PostgreSQL database');
    });

    pool.on('error', (err) => {
      console.error('Database connection error:', err);
      console.log('📝 Falling back to mock database');
      pool = new MockDatabase();
    });
  } catch (error) {
    console.log('📝 PostgreSQL not available, using mock database');
    pool = new MockDatabase();
  }
}

module.exports = pool;
