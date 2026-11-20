import { synthesizePixels, type MapRequest } from './bodyDetail'

self.onmessage = ({ data }: MessageEvent<MapRequest>) => {
  const pixels = synthesizePixels(data)
  const transfer = Object.values(pixels).flatMap(image => image ? [image.data.buffer] : [])
  self.postMessage(pixels, { transfer })
}
