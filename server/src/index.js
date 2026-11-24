require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { initSchema, pool } = require('./db');
const transcriptions = require('./routes/transcriptions');
const { attachGeminiLive } = require('./gemini-live');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', gemini: !!process.env.GEMINI_API_KEY });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

app.use('/api/transcriptions', transcriptions);

// Serve the built Angular app (client/dist) from the same server in production.
const webRoot = path.join(__dirname, '..', '..', 'client', 'dist', 'client', 'browser');
app.use(express.static(webRoot));
app.get(/^(?!\/api|\/ws).*/, (_req, res) => res.sendFile(path.join(webRoot, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
const server = http.createServer(app);
attachGeminiLive(server);

initSchema()
  .then(() => server.listen(port, () => console.log(`Server running on http://localhost:${port}`)))
  .catch((err) => {
    console.error('Could not initialise the database:', err.message);
    process.exit(1);
  });
