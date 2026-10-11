function getYoutubeId(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
    if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed') return parts[1] || null;
    }
  } catch {
    return null;
  }
  return null;
}

function getYoutubeEmbedUrl(value) {
  const id = getYoutubeId(value);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function getYoutubeThumbnailUrl(value) {
  const id = getYoutubeId(value);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

module.exports = { getYoutubeId, getYoutubeEmbedUrl, getYoutubeThumbnailUrl };