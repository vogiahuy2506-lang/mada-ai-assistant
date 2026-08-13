/**
 * Product image mapping - fallback images for products without MADA thumbnails
 */

export const FALLBACK_IMAGES: Record<string, string> = {
  // Victor Reader & similar DAISY players - use a generic assistive device image
  'victor-reader-stratus4-m-daisy-and-mp3-player': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Media-player.svg/640px-Media-player.svg.png',
  
  // Generic assistive technology device icon (public domain)
  'default-assistive': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMTIwIDEyMCI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiNlNGU2ZjYiLz48dGV4dCB4PSI2MCIgeT0iNjUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkFBPC90ZXh0Pjwvc3ZnPg==',
};

// Check if URL is valid (starts with http)
export function isValidImageUrl(url: string | null | undefined): boolean {
  return !!url && (url.startsWith('http') || url.startsWith('data:'));
}

// Get fallback image URL for a product slug
export function getFallbackImageUrl(slug?: string | null): string | null {
  if (!slug) return null;
  return FALLBACK_IMAGES[slug] || FALLBACK_IMAGES['default-assistive'] || null;
}
