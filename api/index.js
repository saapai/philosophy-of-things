require('dotenv').config();
const express = require('express');
const path = require('path');
const { ready, query, queryOne, execute } = require('../db/init');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Wait for DB before handling requests
app.use(async (req, res, next) => {
  try {
    await ready;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database initialization failed' });
  }
});

app.use('/api/posts', require('../routes/posts'));
app.use('/api/images', require('../routes/images'));

// Serve HTML for dynamic routes
app.get('/draft', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'draft.html'));
});

app.get('/draft/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'draft.html'));
});

app.get('/post/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'post.html'));
});

module.exports = app;
