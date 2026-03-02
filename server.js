require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/posts', require('./routes/posts'));
app.use('/api/images', require('./routes/images'));

// Auth page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Draft editor (auth check happens client-side)
app.get('/draft', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'draft.html'));
});

app.get('/draft/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'draft.html'));
});

// View post
app.get('/post/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'post.html'));
});

// Local development: listen on port
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Philosophy of Things running at http://localhost:${PORT}`);
  });
}

// Vercel serverless: export the app
module.exports = app;
