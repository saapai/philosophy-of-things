document.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.getElementById('title');
  const bodyEl = document.getElementById('body');
  const saveDraftBtn = document.getElementById('saveDraft');
  const publishBtn = document.getElementById('publish');
  const deleteBtn = document.getElementById('deletePost');
  const statusEl = document.getElementById('status');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const previewArea = document.getElementById('previewArea');
  const previewImg = document.getElementById('previewImg');
  const promptEl = document.getElementById('prompt');
  const generateBtn = document.getElementById('generate');
  const setCoverBtn = document.getElementById('setCover');
  const uploadAnotherBtn = document.getElementById('uploadAnother');
  const galleryEl = document.getElementById('gallery');
  const studioError = document.getElementById('studioError');

  let postId = null;
  let currentImageId = null;
  let currentImagePath = null;
  let autoSaveTimer = null;

  // Check for existing post ID in URL
  const pathMatch = window.location.pathname.match(/\/draft\/(\d+)/);
  const urlParams = new URLSearchParams(window.location.search);
  if (pathMatch) {
    postId = parseInt(pathMatch[1]);
    loadPost(postId);
  } else if (urlParams.get('id')) {
    postId = parseInt(urlParams.get('id'));
    loadPost(postId);
  }

  async function loadPost(id) {
    try {
      const res = await fetch(`/api/posts/${id}`);
      if (!res.ok) return;
      const post = await res.json();
      titleEl.value = post.title || '';
      bodyEl.value = post.body || '';
      if (post.cover_image) {
        currentImagePath = post.cover_image;
        showPreview(post.cover_image);
      }
      deleteBtn.style.display = '';
      statusEl.textContent = post.status === 'published' ? 'Published' : 'Draft';
      loadImages(id);
    } catch (err) {
      console.error('Failed to load post:', err);
    }
  }

  async function loadImages(id) {
    try {
      const res = await fetch(`/api/images/${id}`);
      const images = await res.json();
      renderGallery(images);
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  }

  function renderGallery(images) {
    galleryEl.innerHTML = images.map(img => `
      <img class="studio__gallery-item ${img.file_path === currentImagePath ? 'selected' : ''}"
           src="${img.file_path}" alt=""
           data-id="${img.id}" data-path="${img.file_path}">
    `).join('');

    galleryEl.querySelectorAll('.studio__gallery-item').forEach(el => {
      el.addEventListener('click', () => {
        currentImageId = parseInt(el.dataset.id);
        currentImagePath = el.dataset.path;
        showPreview(el.dataset.path);
        galleryEl.querySelectorAll('.studio__gallery-item').forEach(g => g.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  }

  function showPreview(src) {
    previewImg.src = src;
    previewArea.style.display = '';
  }

  function hideError() {
    studioError.style.display = 'none';
  }

  function showError(msg) {
    studioError.textContent = msg;
    studioError.style.display = '';
  }

  // Auto-save
  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => savePost('draft', true), 3000);
  }

  titleEl.addEventListener('input', scheduleAutoSave);
  bodyEl.addEventListener('input', scheduleAutoSave);

  async function savePost(status, silent = false) {
    const title = titleEl.value.trim() || 'Untitled';
    const body = bodyEl.value;
    const payload = { title, body, status, cover_image: currentImagePath };

    try {
      let res;
      if (postId) {
        res = await fetch(`/api/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const post = await res.json();
      postId = post.id;
      deleteBtn.style.display = '';

      if (!silent) {
        statusEl.textContent = status === 'published' ? 'Published!' : 'Saved';
        if (status === 'published') {
          setTimeout(() => { window.location.href = `/post/${postId}`; }, 500);
        }
      } else {
        statusEl.textContent = 'Auto-saved';
      }

      // Update URL without reload
      if (!pathMatch) {
        history.replaceState(null, '', `/draft/${postId}`);
      }

      setTimeout(() => { statusEl.textContent = ''; }, 2000);
    } catch (err) {
      statusEl.textContent = 'Save failed';
    }
  }

  saveDraftBtn.addEventListener('click', () => savePost('draft'));
  publishBtn.addEventListener('click', () => savePost('published'));

  deleteBtn.addEventListener('click', async () => {
    if (!postId) return;
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    window.location.href = '/';
  });

  // File upload
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadFile(fileInput.files[0]);
  });

  async function uploadFile(file) {
    hideError();
    // Ensure post exists first
    if (!postId) await savePost('draft', true);

    const form = new FormData();
    form.append('image', file);
    form.append('post_id', postId);

    try {
      const res = await fetch('/api/images/upload', { method: 'POST', body: form });
      const image = await res.json();
      currentImageId = image.id;
      currentImagePath = image.file_path;
      showPreview(image.file_path);
      loadImages(postId);
    } catch (err) {
      showError('Upload failed');
    }
  }

  uploadAnotherBtn.addEventListener('click', () => fileInput.click());

  // AI Generation
  generateBtn.addEventListener('click', async () => {
    hideError();
    const prompt = promptEl.value.trim();
    if (!prompt) {
      showError('Enter a prompt to generate an image');
      return;
    }

    if (!postId) await savePost('draft', true);

    const mode = document.querySelector('input[name="mode"]:checked').value;
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode,
          post_id: postId,
          image_id: currentImageId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error);
        return;
      }

      currentImageId = data.id;
      currentImagePath = data.file_path;
      showPreview(data.file_path);
      promptEl.value = '';
      loadImages(postId);
    } catch (err) {
      showError('Generation failed');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate';
    }
  });

  // Set as cover
  setCoverBtn.addEventListener('click', async () => {
    if (!currentImagePath) return;
    currentImagePath = currentImagePath;
    await savePost('draft', true);
    statusEl.textContent = 'Cover set';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });

  // Binary Art Feature
  const binaryArtBtn = document.getElementById('binaryArt');
  const asciiModal = document.getElementById('asciiModal');
  const closeAsciiBtn = document.getElementById('closeAscii');
  const asciiOutput = document.getElementById('asciiOutput');
  const asciiWidthSlider = document.getElementById('asciiWidth');
  const asciiWidthValue = document.getElementById('asciiWidthValue');
  const asciiCharsSelect = document.getElementById('asciiChars');
  const asciiInvertCheckbox = document.getElementById('asciiInvert');
  const copyAsciiBtn = document.getElementById('copyAscii');
  const downloadAsciiBtn = document.getElementById('downloadAscii');

  let currentAsciiImage = null;

  function imageToAscii(img, width, charSet, invert) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Calculate height to maintain aspect ratio (characters are ~2x taller than wide)
    const aspectRatio = img.height / img.width;
    const height = Math.floor(width * aspectRatio * 0.5);

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    const chars = charSet.split('');
    let ascii = '';

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Convert to grayscale
        let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Handle transparency as white
        if (a < 128) brightness = 1;

        if (invert) brightness = 1 - brightness;

        // Map brightness to character
        const charIndex = Math.floor(brightness * (chars.length - 1));
        ascii += chars[charIndex];
      }
      ascii += '\n';
    }

    return ascii;
  }

  function generateAscii() {
    if (!currentAsciiImage) return;

    const width = parseInt(asciiWidthSlider.value);
    const charSet = asciiCharsSelect.value;
    const invert = asciiInvertCheckbox.checked;

    const ascii = imageToAscii(currentAsciiImage, width, charSet, invert);
    asciiOutput.textContent = ascii;
  }

  binaryArtBtn.addEventListener('click', () => {
    if (!currentImagePath) {
      showError('Select an image first');
      return;
    }

    // Load the image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      currentAsciiImage = img;
      generateAscii();
      asciiModal.style.display = '';
    };
    img.onerror = () => {
      showError('Failed to load image for conversion');
    };
    img.src = currentImagePath;
  });

  closeAsciiBtn.addEventListener('click', () => {
    asciiModal.style.display = 'none';
  });

  asciiModal.addEventListener('click', (e) => {
    if (e.target === asciiModal) {
      asciiModal.style.display = 'none';
    }
  });

  asciiWidthSlider.addEventListener('input', () => {
    asciiWidthValue.textContent = asciiWidthSlider.value;
    generateAscii();
  });

  asciiCharsSelect.addEventListener('change', generateAscii);
  asciiInvertCheckbox.addEventListener('change', generateAscii);

  copyAsciiBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(asciiOutput.textContent);
    copyAsciiBtn.textContent = 'Copied!';
    setTimeout(() => { copyAsciiBtn.textContent = 'Copy to Clipboard'; }, 2000);
  });

  downloadAsciiBtn.addEventListener('click', () => {
    const blob = new Blob([asciiOutput.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'binary-art.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
});
