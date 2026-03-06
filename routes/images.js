const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { query, queryOne, execute } = require('../db/init');

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

// Upload an image
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid image file provided' });

  const postId = req.body.post_id ? parseInt(req.body.post_id) : null;
  const filePath = '/uploads/' + req.file.filename;

  const result = execute(
    `INSERT INTO images (post_id, file_path, mode) VALUES (?, ?, 'initial')`,
    [postId, filePath]
  );

  const image = queryOne('SELECT * FROM images WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(image);
});

// Generate AI image
router.post('/generate', async (req, res) => {
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
      const parentImage = queryOne('SELECT * FROM images WHERE id = ?', [parseInt(image_id)]);
      if (!parentImage) return res.status(404).json({ error: 'Parent image not found' });

      const imagePath = path.join(__dirname, '..', parentImage.file_path);
      result = await openai.images.edit({
        model: 'gpt-image-1',
        image: fs.createReadStream(imagePath),
        prompt: fullPrompt,
      });
    } else {
      result = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: fullPrompt,
        size: '1024x1024'
      });
    }

    const imageData = result.data[0];
    let buffer;
    if (imageData.url) {
      const response = await fetch(imageData.url);
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, 'base64');
    } else {
      throw new Error('No image data in API response');
    }
    const filename = Date.now() + '-ai-' + Math.round(Math.random() * 1e6) + '.png';
    const savePath = path.join(__dirname, '..', 'uploads', filename);
    fs.writeFileSync(savePath, buffer);

    const filePath = '/uploads/' + filename;
    const dbResult = execute(
      `INSERT INTO images (post_id, file_path, prompt, parent_image_id, mode) VALUES (?, ?, ?, ?, ?)`,
      [
        post_id ? parseInt(post_id) : null,
        filePath,
        prompt,
        image_id ? parseInt(image_id) : null,
        mode || 'initial'
      ]
    );

    const image = queryOne('SELECT * FROM images WHERE id = ?', [dbResult.lastInsertRowid]);
    res.status(201).json(image);
  } catch (err) {
    console.error('Image generation error:', err.message);
    res.status(500).json({ error: 'Image generation failed: ' + err.message });
  }
});

// Apply painterly filter
router.post('/filter', (req, res) => {
  try {
    const { image_id, style, post_id } = req.body;

    const validStyles = ['oil', 'icm', 'hybrid'];
    if (!image_id || !validStyles.includes(style)) {
      return res.status(400).json({ error: 'Valid image_id and style (oil, icm, hybrid) required' });
    }

    const sourceImage = queryOne('SELECT * FROM images WHERE id = ?', [parseInt(image_id)]);
    if (!sourceImage) return res.status(404).json({ error: 'Source image not found' });

    const inputPath = path.join(__dirname, '..', sourceImage.file_path);
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Source image file not found on disk' });
    }

    const outputFilename = Date.now() + '-' + style + '-' + Math.round(Math.random() * 1e6) + '.jpg';
    const outputPath = path.join(__dirname, '..', 'uploads', outputFilename);
    const scriptPath = path.join(__dirname, '..', 'scripts', 'painterly.py');

    execFileSync('python3', [scriptPath, inputPath, outputPath, style], {
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const filePath = '/uploads/' + outputFilename;
    const dbResult = execute(
      `INSERT INTO images (post_id, file_path, prompt, parent_image_id, mode) VALUES (?, ?, ?, ?, 'initial')`,
      [
        post_id ? parseInt(post_id) : null,
        filePath,
        'filter:' + style,
        parseInt(image_id)
      ]
    );

    const image = queryOne('SELECT * FROM images WHERE id = ?', [dbResult.lastInsertRowid]);
    res.status(201).json(image);
  } catch (err) {
    console.error('Filter error:', err.message);
    res.status(500).json({ error: 'Filter processing failed: ' + err.message });
  }
});

// Blend two images
router.post('/blend', (req, res) => {
  try {
    const { image_id_1, image_id_2, post_id } = req.body;

    if (!image_id_1 || !image_id_2) {
      return res.status(400).json({ error: 'Two image IDs required' });
    }

    const img1 = queryOne('SELECT * FROM images WHERE id = ?', [parseInt(image_id_1)]);
    const img2 = queryOne('SELECT * FROM images WHERE id = ?', [parseInt(image_id_2)]);
    if (!img1 || !img2) return res.status(404).json({ error: 'Image not found' });

    const inputPath1 = path.join(__dirname, '..', img1.file_path);
    const inputPath2 = path.join(__dirname, '..', img2.file_path);
    if (!fs.existsSync(inputPath1) || !fs.existsSync(inputPath2)) {
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    const outputFilename = Date.now() + '-blend-' + Math.round(Math.random() * 1e6) + '.jpg';
    const outputPath = path.join(__dirname, '..', 'uploads', outputFilename);
    const scriptPath = path.join(__dirname, '..', 'scripts', 'painterly.py');

    execFileSync('python3', [scriptPath, inputPath1, inputPath2, outputPath, 'blend'], {
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const filePath = '/uploads/' + outputFilename;
    const dbResult = execute(
      `INSERT INTO images (post_id, file_path, prompt, parent_image_id, mode) VALUES (?, ?, ?, ?, 'initial')`,
      [
        post_id ? parseInt(post_id) : null,
        filePath,
        'blend:' + image_id_1 + '+' + image_id_2,
        parseInt(image_id_1)
      ]
    );

    const image = queryOne('SELECT * FROM images WHERE id = ?', [dbResult.lastInsertRowid]);
    res.status(201).json(image);
  } catch (err) {
    console.error('Blend error:', err.message);
    res.status(500).json({ error: 'Blend failed: ' + err.message });
  }
});

// List images for a post
router.get('/:postId', (req, res) => {
  const images = query(
    `SELECT * FROM images WHERE post_id = ? ORDER BY created_at ASC`,
    [parseInt(req.params.postId)]
  );
  res.json(images);
});

module.exports = router;
