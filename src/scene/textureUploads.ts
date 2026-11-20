import * as T from 'three'

// Share the per-frame transfer budget across the sky and every channel of a planet.
export function createTextureUploads(renderer: T.WebGLRenderer) {
  const queue = new Set<() => void>()
  let frame = 0
  function tick() {
    frame = 0
    const first = queue.values().next().value
    first?.()
    if (queue.size) frame = requestAnimationFrame(tick)
  }

  return function loadTexture(
    url: string,
    signal: AbortSignal,
    { maxWidth = Infinity, colorSpace = T.SRGBColorSpace, anisotropy = 1, wrapS = T.ClampToEdgeWrapping }: {
      maxWidth?: number
      colorSpace?: T.ColorSpace
      anisotropy?: number
      wrapS?: T.Wrapping
    },
    onReady: (texture: T.Texture) => void,
    onError?: () => void,
  ) {
    const image = new Image()
    let pending: T.FramebufferTexture | null = null
    let copyStrip: (() => void) | undefined
    function cancelUpload() {
      if (copyStrip) queue.delete(copyStrip)
      copyStrip = undefined
      if (!queue.size) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      pending?.dispose()
      pending = null
    }
    signal.addEventListener('abort', () => {
      cancelUpload()
      image.onload = image.onerror = null
      image.removeAttribute('src')
    }, { once: true })

    function upload() {
      if (signal.aborted || renderer.getContext().isContextLost()) return
      const width = Math.min(image.naturalWidth, maxWidth)
      const height = Math.max(1, Math.round(image.naturalHeight * width / image.naturalWidth))
      const strip = document.createElement('canvas')
      const ctx = strip.getContext('2d', { willReadFrequently: true })
      if (!renderer.capabilities.isWebGL2 || Math.max(width, height) > renderer.capabilities.maxTextureSize || !ctx) {
        let source: HTMLImageElement | HTMLCanvasElement = image
        if (ctx && width !== image.naturalWidth) {
          strip.width = width
          strip.height = height
          ctx.drawImage(image, 0, 0, width, height)
          source = strip
        }
        const texture = new T.Texture(source)
        texture.colorSpace = colorSpace
        texture.anisotropy = anisotropy
        texture.wrapS = wrapS
        texture.needsUpdate = true
        onReady(texture)
        return
      }
      const target = new T.FramebufferTexture(width, height)
      target.colorSpace = colorSpace
      target.anisotropy = anisotropy
      target.wrapS = wrapS
      target.magFilter = T.LinearFilter
      target.minFilter = T.LinearMipmapLinearFilter
      pending = target
      strip.width = width
      strip.height = Math.min(height, Math.max(1, Math.floor(1024 * 1024 / width)))
      const source = new T.Texture(strip)
      const offset = new T.Vector2()
      let y = 0
      const copy = () => {
        const rows = Math.min(strip.height, height - y)
        if (strip.height !== rows) strip.height = rows
        // Draw the same scaled image in each clipped strip, including its filter footprint.
        ctx.globalCompositeOperation = 'copy'
        ctx.drawImage(image, 0, -y, width, height)
        y += rows
        offset.y = height - y
        target.generateMipmaps = y === height
        renderer.copyTextureToTexture(offset, source, target)
        if (y === height) {
          queue.delete(copy)
          copyStrip = undefined
          pending = null
          onReady(target)
        }
      }
      copyStrip = copy
      queue.add(copy)
      if (!frame) frame = requestAnimationFrame(tick)
    }

    image.onload = async () => {
      if (image.decode) await image.decode().catch(() => {})
      if (signal.aborted) return
      renderer.domElement.addEventListener('webglcontextlost', cancelUpload, { signal })
      renderer.domElement.addEventListener('webglcontextrestored', upload, { signal })
      upload()
    }
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onerror = () => { if (!signal.aborted) onError?.() }
    image.src = url
  }
}
export type TextureUpload = ReturnType<typeof createTextureUploads>
