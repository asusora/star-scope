import { synthesizeBodyMapsAsync, texturesFromPixels, type MapRequest } from './bodyDetail'

// Each caller runs one sequential stream (overview maps or the current close-up).
export function createMapSynthesizer() {
  let worker: Worker | null = null
  let useWorker = typeof Worker !== 'undefined'
  function dispose() {
    worker?.terminate()
    worker = null
  }
  function run(...args: Parameters<typeof synthesizeBodyMapsAsync>) {
    if (!useWorker) return synthesizeBodyMapsAsync(...args)
    const [spec, width, height, options] = args
    let cancel = dispose
    try {
      worker ??= new Worker(new URL('./bodyMaps.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }: MessageEvent<Parameters<typeof texturesFromPixels>[0]>) => {
        cancel = () => {}
        worker!.onmessage = null
        worker!.onerror = null
        options.onDone(texturesFromPixels(data, options.maxAnisotropy ?? 4, !!options.keepPixels))
      }
      worker.onerror = (event) => {
        event.preventDefault()
        dispose()
        useWorker = false
        cancel = synthesizeBodyMapsAsync(...args)
      }
      const request: MapRequest = {
        spec, width, height, basePixels: options.basePixels ?? null,
        closeRelief: options.closeRelief,
        includeSpecular: options.includeSpecular ?? true,
      }
      worker.postMessage(request)
    } catch {
      dispose()
      useWorker = false
      return synthesizeBodyMapsAsync(...args)
    }
    return () => cancel()
  }
  return { run, dispose }
}
