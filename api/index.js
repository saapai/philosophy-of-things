require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use('/api/posts', require('../routes/posts'));
app.use('/api/images', require('../routes/images'));

// Auth page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

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
