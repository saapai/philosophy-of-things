document.addEventListener('DOMContentLoaded', async () => {
  const feed = document.getElementById('feed');
  const feedWrap = document.getElementById('feedWrap');
  const hero = document.getElementById('hero');

  try {
    const res = await fetch('/api/posts');
    const posts = await res.json();

    if (posts.length === 0) {
      // Show the hero, hide feed
      hero.style.display = '';
      feedWrap.style.display = 'none';
      return;
    }

    // Has posts — hide hero, show feed
    hero.style.display = 'none';
    feedWrap.style.display = '';

    feed.innerHTML = posts.map(post => {
      const preview = (post.body || '').replace(/\n/g, ' ').slice(0, 150);
      const date = new Date(post.created_at + 'Z').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      return `
        <a href="/post/${post.id}" class="post-card">
          ${post.cover_image ? `<div class="post-card__image-wrap"><img class="post-card__image" src="${post.cover_image}" alt=""></div>` : ''}
          <h2 class="post-card__title">${escapeHtml(post.title)}</h2>
          ${preview ? `<p class="post-card__preview">${escapeHtml(preview)}${post.body.length > 150 ? '...' : ''}</p>` : ''}
          <time class="post-card__date">${date}</time>
        </a>
      `;
    }).join('');
  } catch (err) {
    hero.style.display = 'none';
    feedWrap.style.display = '';
    feed.innerHTML = `<div class="empty-state"><p class="empty-state__text">Failed to load posts.</p></div>`;
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
