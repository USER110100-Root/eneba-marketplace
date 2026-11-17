const productSlugs: Record<string, string> = {
  cyberpunk: 'cyberpunk-2077',
  elden: 'elden-ring',
  redead: 'red-dead-redemption-2',
}

const productIds = Object.fromEntries(
  Object.entries(productSlugs).map(([id, slug]) => [slug, id]),
)

export function productHref(id: string) {
  return '#/products/' + (productSlugs[id] || id)
}

export function resolveProductId(slug: string) {
  return productIds[slug] || slug
}

export function applyFallbackArtwork(image: HTMLImageElement, fallback?: string) {
  if (fallback && image.getAttribute('src') !== fallback) image.src = fallback
}
