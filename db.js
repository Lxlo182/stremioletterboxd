const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchlist_films (
      username TEXT NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      year TEXT,
      poster TEXT,
      position INTEGER NOT NULL,
      synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (username, slug)
    );

    CREATE TABLE IF NOT EXISTS cinemeta_cache (
      title TEXT NOT NULL,
      year TEXT NOT NULL,
      imdb_id TEXT NOT NULL,
      poster TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (title, year)
    );
  `);
}

module.exports = { pool, initDb };
