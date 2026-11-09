export function extractPosts(root, username) {
  const posts = new Map();
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    const code = value.shortcode || value.code;
    const owner = value.owner?.username || value.user?.username;
    const coauthors = Array.isArray(value.coauthor_producers) ? value.coauthor_producers : [];
    const belongsToProfile = owner?.toLowerCase() === username.toLowerCase() ||
      coauthors.some(user => user.username?.toLowerCase() === username.toLowerCase());
    const seconds = Number(value.taken_at_timestamp || value.taken_at);
    const image = value.display_url || value.image_versions2?.candidates?.[0]?.url;
    const video = value.video_url || value.video_versions?.[0]?.url;
    if (belongsToProfile && /^[\w-]+$/.test(code || '') &&
        seconds > 1262304000 && seconds * 1000 <= Date.now() + 300000 && validMedia(image)) {
      posts.set(code, {
        id: String(value.id || value.pk || code), shortcode: code,
        username, author_username: owner, permalink: `https://www.instagram.com/p/${code}/`,
        timestamp: new Date(seconds * 1000).toISOString(),
        caption: value.caption?.text || value.edge_media_to_caption?.edges?.[0]?.node?.text || '',
        image_url: image, video_url: validMedia(video) ? video : null,
        media_type: value.is_video || value.media_type === 2 ? 'VIDEO' : 'IMAGE'
      });
    }
    for (const child of Object.values(value)) if (typeof child === 'object') walk(child);
  };
  walk(root);
  return [...posts.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function validMedia(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname);
  } catch { return false; }
}
