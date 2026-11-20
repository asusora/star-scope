function byName(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [
      path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.')),
      url,
    ]),
  )
}
export const sources = byName(
  import.meta.glob('../assets/textures/*', { eager: true, query: '?url', import: 'default' }),
)
export const detailSources = byName(
  import.meta.glob('../assets/planet-detail/*', { eager: true, query: '?url', import: 'default' }),
)
export const thumbs = byName(
  import.meta.glob('../assets/thumbnails/*', { eager: true, query: '?url', import: 'default' }),
)
export const archivePhotos = byName(
  import.meta.glob('../assets/archive/*', { eager: true, query: '?url', import: 'default' }),
)
export const probePhotoSources = byName(
  import.meta.glob('../assets/probe-photos/*', { eager: true, query: '?url', import: 'default' }),
)
export const surfaceSources = byName(
  import.meta.glob('../assets/surfaces/*', { eager: true, query: '?url', import: 'default' }),
)
