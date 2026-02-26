const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../db/init');

// List published posts
router.get('/', (req, res) => {
  const posts = query(
    `SELECT id, title, body, cover_image, status, created_at, updated_at
     FROM posts WHERE status = 'published'
     ORDER BY created_at DESC`
  );
  res.json(posts);
});

// List drafts
router.get('/drafts', (req, res) => {
  const drafts = query(
    `SELECT id, title, body, cover_image, status, created_at, updated_at
     FROM posts WHERE status = 'draft'
     ORDER BY updated_at DESC`
  );
  res.json(drafts);
});

// Get single post
router.get('/:id', (req, res) => {
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [parseInt(req.params.id)]);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// Create post
router.post('/', (req, res) => {
  const { title, body, cover_image, status } = req.body;
  const result = execute(
    `INSERT INTO posts (title, body, cover_image, status) VALUES (?, ?, ?, ?)`,
    [title || 'Untitled', body || '', cover_image || null, status || 'draft']
  );
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(post);
});

// Update post
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const existing = queryOne('SELECT * FROM posts WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Post not found' });

  const { title, body, cover_image, status } = req.body;
  execute(
    `UPDATE posts SET title = ?, body = ?, cover_image = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      title !== undefined ? title : existing.title,
      body !== undefined ? body : existing.body,
      cover_image !== undefined ? cover_image : existing.cover_image,
      status !== undefined ? status : existing.status,
      id
    ]
  );
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [id]);
  res.json(post);
});

// Delete post
router.delete('/:id', (req, res) => {
  const result = execute('DELETE FROM posts WHERE id = ?', [parseInt(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Post not found' });
  res.json({ success: true });
});

module.exports = router;
