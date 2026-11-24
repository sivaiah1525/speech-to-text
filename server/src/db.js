const { Pool } = require('pg');

// DATABASE_URL example: postgres://postgres:postgres@localhost:5432/speech_to_text
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id          SERIAL PRIMARY KEY,
      title       VARCHAR(200) NOT NULL DEFAULT 'Untitled',
      text        TEXT         NOT NULL,
      language    VARCHAR(20)  NOT NULL DEFAULT 'hi-IN',
      engine      VARCHAR(30)  NOT NULL DEFAULT 'browser',
      duration_ms INTEGER      NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = { pool, initSchema };
