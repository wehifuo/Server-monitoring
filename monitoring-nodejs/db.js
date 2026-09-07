const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

const initDb = async () => {
  const queryText = `
    create table if not exists server_logs (
      id SERIAL PRIMARY KEY,
      service_name VARCHAR(100) NOT NULL,
      service_url VARCHAR(255) NOT NULL,
      status_code INTEGER,
      response_time_ms REAL NOT NULL,
      is_available SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(queryText);
    console.log(' Таблица server_metrics готова в PostgreSQL');
  } catch (err) {
    console.error('Ошибка создания таблицы в БД:', err.message);
  }
};

initDb();

module.exports = pool;
