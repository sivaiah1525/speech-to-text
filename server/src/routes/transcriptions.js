const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const COLUMNS = 'id, title, text, language, engine, duration_ms AS "durationMs", created_at AS "createdAt", updated_at AS "updatedAt"';

function validate(body, partial = false) {
  const errors = [];
  if (!partial || body.text !== undefined) {
    if (typeof body.text !== 'string' || !body.text.trim()) errors.push('text is required');
  }
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.length > 200)) {
    errors.push('title must be a string of at most 200 characters');
  }
  return errors;
}

// List with optional search and paging: GET /api/transcriptions?q=hello&page=1&pageSize=20
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const params = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE title ILIKE $1 OR text ILIKE $1`;
    }
    const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM transcriptions ${where}`, params)).rows[0].n;
    params.push(pageSize, (page - 1) * pageSize);
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM transcriptions ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ items: rows, total, page, pageSize });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${COLUMNS} FROM transcriptions WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const { title, text, language, engine, durationMs } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO transcriptions (title, text, language, engine, duration_ms)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
      [title?.trim() || defaultTitle(text), text.trim(), language || 'hi-IN', engine || 'browser', durationMs | 0],
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const errors = validate(req.body, true);
    if (errors.length) return res.status(400).json({ errors });
    const { rows } = await pool.query(
      `UPDATE transcriptions
         SET title = COALESCE($2, title), text = COALESCE($3, text), updated_at = NOW()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [req.params.id, req.body.title?.trim() || null, req.body.text?.trim() || null],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM transcriptions WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

function defaultTitle(text) {
  const words = text.trim().split(/\s+/).slice(0, 6).join(' ');
  return words.length > 60 ? words.slice(0, 60) + '…' : words;
}

module.exports = router;
