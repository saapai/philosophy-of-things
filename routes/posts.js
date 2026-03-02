const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');

// Middleware to get user from auth header
async function getUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return user;
}

// Middleware to require authentication
async function requireAuth(req, res, next) {
  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  next();
}

// List published posts (public)
router.get('/', async (req, res) => {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, body, cover_image, status, created_at, updated_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(posts);
});

// List user's drafts (requires auth)
router.get('/drafts', requireAuth, async (req, res) => {
  const { data: drafts, error } = await supabase
    .from('posts')
    .select('id, title, body, cover_image, status, created_at, updated_at')
    .eq('status', 'draft')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(drafts);
});

// Get single post
router.get('/:id', async (req, res) => {
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', parseInt(req.params.id))
    .single();

  if (error || !post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// Create post (requires auth)
router.post('/', requireAuth, async (req, res) => {
  const { title, body, cover_image, status } = req.body;

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      user_id: req.user.id,
      title: title || 'Untitled',
      body: body || '',
      cover_image: cover_image || null,
      status: status || 'draft'
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(post);
});

// Update post (requires auth + ownership)
router.put('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);

  // Check ownership
  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Post not found or access denied' });
  }

  const { title, body, cover_image, status } = req.body;

  const { data: post, error } = await supabase
    .from('posts')
    .update({
      title: title !== undefined ? title : existing.title,
      body: body !== undefined ? body : existing.body,
      cover_image: cover_image !== undefined ? cover_image : existing.cover_image,
      status: status !== undefined ? status : existing.status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(post);
});

// Delete post (requires auth + ownership)
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
