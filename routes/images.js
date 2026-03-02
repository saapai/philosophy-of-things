const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { supabase } = require('../db/supabase');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

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

// Upload an image (requires auth)
router.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid image file provided' });

  const postId = req.body.post_id ? parseInt(req.body.post_id) : null;
  const filePath = '/uploads/' + req.file.filename;

  const { data: image, error } = await supabase
    .from('images')
    .insert({
      user_id: req.user.id,
      post_id: postId,
      file_path: filePath,
      mode: 'initial'
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(image);
});

// Generate AI image (requires auth)
router.post('/generate', requireAuth, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    return res.status(422).json({
      error: 'OpenAI API key not configured. Add your key to .env to enable AI image generation.'
    });
  }

  try {
    const { image_id, prompt, mode, post_id } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const stylePrefix = 'Oil painting style using ONLY three colors: deep black (#1A1814), neon red (#E8222C), and electric blue (#1B4DFF) on a cream (#F5F4EF) background. Bold thick brushstrokes with visible paint texture, pixelated blocky feel like pixel art meets oil painting. Abstract expressionist. ';
    const fullPrompt = stylePrefix + prompt;

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    let result;

    if (image_id && (mode === 'blend' || mode === 'iterate')) {
      const { data: parentImage, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .eq('id', parseInt(image_id))
        .single();

      if (fetchError || !parentImage) {
        return res.status(404).json({ error: 'Parent image not found' });
      }

      const imagePath = path.join(__dirname, '..', parentImage.file_path);
      result = await openai.images.edit({
        image: fs.createReadStream(imagePath),
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024'
      });
    } else {
      result = await openai.images.generate({
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024'
      });
    }

    const imageUrl = result.data[0].url;

    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = Date.now() + '-ai-' + Math.round(Math.random() * 1e6) + '.png';
    const savePath = path.join(__dirname, '..', 'uploads', filename);
    fs.writeFileSync(savePath, buffer);

    const filePath = '/uploads/' + filename;

    const { data: image, error } = await supabase
      .from('images')
      .insert({
        user_id: req.user.id,
        post_id: post_id ? parseInt(post_id) : null,
        file_path: filePath,
        prompt: prompt,
        parent_image_id: image_id ? parseInt(image_id) : null,
        mode: mode || 'initial'
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(image);
  } catch (err) {
    console.error('Image generation error:', err.message);
    res.status(500).json({ error: 'Image generation failed: ' + err.message });
  }
});

// List images for a post (public for viewing posts)
router.get('/:postId', async (req, res) => {
  const { data: images, error } = await supabase
    .from('images')
    .select('*')
    .eq('post_id', parseInt(req.params.postId))
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(images);
});

module.exports = router;
