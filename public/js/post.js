document.addEventListener('DOMContentLoaded', async () => {
  const postView = document.getElementById('postView');
  const pathMatch = window.location.pathname.match(/\/post\/(\d+)/);

  if (!pathMatch) {
    postView.innerHTML = '<p>Post not found.</p>';
    return;
  }

  const postId = pathMatch[1];

  try {
    const res = await fetch(`/api/posts/${postId}`);
    if (!res.ok) throw new Error('Not found');
    const post = await res.json();

    document.title = `${post.title} — Philosophy of Things`;

    const date = new Date(post.created_at + 'Z').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // Convert body text to paragraphs
    const bodyHtml = post.body
      .split(/\n\n+/)
      .filter(p => p.trim())
      .map(p => `<p>${escapeHtml(p.trim())}</p>`)
      .join('');

    postView.innerHTML = `
      <time class="post-view__date">${date}</time>
      <div class="post-view__rule"></div>
      ${post.cover_image ? `
        <div class="post-view__cover-wrap">
          <img class="post-view__cover" src="${post.cover_image}" alt="">
        </div>
      ` : ''}
      <h1 class="post-view__title">${escapeHtml(post.title)}</h1>
      <div class="post-view__body">${bodyHtml}</div>
      <div class="post-view__rule"></div>
      <a href="/" class="post-view__back">&larr; Back to Explore</a>
    `;
  } catch (err) {
    postView.innerHTML = `
      <div class="empty-state">
        <h2 class="empty-state__title">Post not found</h2>
        <p class="empty-state__text"><a href="/" class="post-view__back">&larr; Back to Explore</a></p>
      </div>
    `;
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
