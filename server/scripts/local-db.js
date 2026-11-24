// Dev helper: runs a real PostgreSQL 16 locally without Docker (npm run db).
const EmbeddedPostgres = require('embedded-postgres').default;
const path = require('path');

(async () => {
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(__dirname, '..', '.pgdata'),
    user: 'postgres', password: 'postgres', port: 5432, persistent: true,
  });
  const fs = require('fs');
  if (!fs.existsSync(path.join(__dirname, '..', '.pgdata', 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  try { await pg.createDatabase('speech_to_text'); } catch { /* already exists */ }
  console.log('PostgreSQL running on localhost:5432 (db: speech_to_text). Ctrl+C to stop.');
  process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
})();
