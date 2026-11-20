import * as T from 'three'
import { ringInner, ringOuter } from './planetSurfaces'
import type { PlanetBody, SurfacePixels } from './planetDetail'
import type { ScreenPoint } from './types'

const tau = 2 * Math.PI
const canvasRims: Record<string, [number, number, number]> = {
  Venus: [110, 90, 52],
  Earth: [36, 94, 175],
  Mars: [92, 50, 28],
  Jupiter: [58, 50, 40],
  Saturn: [58, 56, 44],
  Uranus: [46, 108, 118],
  Neptune: [28, 66, 140],
  Pluto: [74, 112, 152],
  Titan: [138, 86, 36],
  Triton: [82, 108, 134],
  Enceladus: [92, 128, 156],
  Chiron: [78, 124, 158],
  Orcus: [84, 118, 148],
  Eris: [94, 124, 156],
  Gonggong: [118, 68, 60],
  Sedna: [126, 62, 48],
}
function sample(map: ImageData, u: number, v: number) {
  const x = Math.floor((u - Math.floor(u)) * map.width)
  const y = Math.min(map.height - 1, Math.max(0, Math.floor(v * map.height)))
  return (y * map.width + x) * 4
}
function ringSample(map: ImageData, r: number) {
  return sample(
    map,
    Math.min(0.999999, Math.max(0, (r - ringInner) / (ringOuter - ringInner))),
    0.5,
  )
}

// Intersect screen rays with the tilted spheroid and ring plane in body coordinates.
// Only the close-up uses this raster. The overview keeps the inexpensive portraits.
export function createPlanetCanvas() {
  const canvas = document.createElement('canvas'),
    brush = canvas.getContext('2d')!
  const frame = new T.Matrix4(),
    localLight = new T.Vector3()
  let raster: ImageData | undefined
  return function draw(
    ctx: CanvasRenderingContext2D,
    body: PlanetBody,
    maps: SurfacePixels,
    camera: T.PerspectiveCamera,
    q: ScreenPoint,
    width: number,
    height: number,
    pixelRatio: number,
  ) {
    const surface = maps.surface
    if (!surface || (body.rings && !maps.ring)) return false
    const radius = body.r,
      extent = body.rings ? ringOuter * radius : radius
    const depthScale = q.z / Math.max(camera.near, q.z - extent)
    const extentX =
      extent * q.scale * depthScale * (1 + Math.abs(q.x - width / 2) / (q.scale * q.z))
    const extentY =
      extent * q.scale * depthScale * (1 + Math.abs(q.y - height / 2) / (q.scale * q.z))
    const left = Math.max(0, Math.floor(q.x - extentX - 1)),
      top = Math.max(0, Math.floor(q.y - extentY - 1))
    const w = Math.min(width, Math.ceil(q.x + extentX + 1)) - left,
      h = Math.min(height, Math.ceil(q.y + extentY + 1)) - top
    if (w <= 0 || h <= 0) return true
    const scale = Math.min(pixelRatio, 360 / Math.max(w, h))
    const sw = Math.max(1, Math.round(w * scale)),
      sh = Math.max(1, Math.round(h * scale))
    if (!raster || sw !== canvas.width || sh !== canvas.height) {
      canvas.width = sw
      canvas.height = sh
      raster = brush.createImageData(sw, sh)
    }
    const pixels = raster.data
    if (body.minorMoon?.quat) {
      frame.makeRotationFromQuaternion(body.minorMoon.quat).setPosition(body.pos).invert()
    } else {
      frame.extractRotation(body.mesh.matrixWorld).setPosition(body.pos).invert()
    }
    localLight.copy(body.pos).negate().transformDirection(frame)
    const lx = localLight.x,
      ly = localLight.y,
      lz = localLight.z
    const m = frame.multiply(camera.matrixWorld).elements,
      projection = camera.projectionMatrix.elements
    const ox = m[12] / radius,
      oy = m[13] / radius,
      oz = m[14] / radius
    const polar = body.minorMoon ? 1 : body.mesh.scale.y / radius,
      invP2 = 1 / (polar * polar)
    const c = ox * ox + oy * oy * invP2 + oz * oz - 1
    const cloudShift = ((body.clouds?.rotation.y ?? 0) - body.mesh.rotation.y) / tau
    const earth = body.id === 'Earth'
    const rimRgb = canvasRims[body.id]
    for (let row = 0; row < sh; row++) {
      const cy = (1 - (2 * (top + ((row + 0.5) * h) / sh)) / height + projection[9]) / projection[5]
      for (let col = 0; col < sw; col++) {
        const i = 4 * (row * sw + col)
        const cx =
          ((2 * (left + ((col + 0.5) * w) / sw)) / width - 1 + projection[8]) / projection[0]
        const dx = m[0] * cx + m[4] * cy - m[8],
          dy = m[1] * cx + m[5] * cy - m[9],
          dz = m[2] * cx + m[6] * cy - m[10]
        const a = dx * dx + dy * dy * invP2 + dz * dz,
          b = ox * dx + oy * dy * invP2 + oz * dz
        const disc = b * b - a * c
        const hit = disc >= 0 ? (-b - Math.sqrt(disc)) / a : Infinity
        const solid = hit > 0 && Number.isFinite(hit)
        let red = 0,
          green = 0,
          blue = 0,
          alpha = 0
        if (solid) {
          const x = ox + hit * dx,
            y = oy + hit * dy,
            z = oz + hit * dz
          const n = 1 / Math.sqrt(x * x + y * y * invP2 * invP2 + z * z)
          const nx = x * n,
            ny = y * invP2 * n,
            nz = z * n
          const cosine = nx * lx + ny * ly + nz * lz
          const u = Math.atan2(z, -x) / tau,
            v = Math.acos(Math.max(-1, Math.min(1, y / polar))) / Math.PI
          const j = sample(surface, u, v),
            rgb = surface.data
          let light = Math.sqrt((earth ? 0.008 : 0.044) + 0.92 * Math.max(0, cosine))
          if (maps.ring && Math.abs(ly) > 0.0001) {
            const t = -y / ly,
              r = Math.hypot(x + t * lx, z + t * lz)
            if (t > 0 && r >= ringInner && r <= ringOuter)
              light *= Math.sqrt(1 - (0.86 * maps.ring.data[ringSample(maps.ring, r) + 3]) / 255)
          }
          red = rgb[j] * light
          green = rgb[j + 1] * light
          blue = rgb[j + 2] * light
          alpha = 1
          if (earth) {
            const invView = 1 / Math.hypot(dx, dy, dz)
            const vx = -dx * invView,
              vy = -dy * invView,
              vz = -dz * invView
            const mu = Math.max(0, nx * vx + ny * vy + nz * vz)
            if (maps.water && cosine > 0) {
              const hx = lx + vx,
                hy = ly + vy,
                hz = lz + vz
              const spec =
                Math.max(0, (nx * hx + ny * hy + nz * hz) / (Math.hypot(hx, hy, hz) || 1)) ** 64
              const glint = spec * cosine * maps.water.data[sample(maps.water, u, v)] * 0.3
              red += glint
              green += glint
              blue += glint
            }
            if (maps.night && cosine < 0.12) {
              const n = sample(maps.night, u, v),
                dark = Math.min(1, (0.12 - cosine) / 0.34)
              red += maps.night.data[n] * dark
              green += maps.night.data[n + 1] * dark
              blue += maps.night.data[n + 2] * dark
            }
            if (maps.clouds) {
              const cloud = (0.84 * maps.clouds.data[sample(maps.clouds, u - cloudShift, v)]) / 255
              red += (245 * light - red) * cloud
              green += (249 * light - green) * cloud
              blue += (255 * light - blue) * cloud
            }
          }
          if (rimRgb) {
            const invView = 1 / Math.hypot(dx, dy, dz)
            const mu = Math.max(0, -(nx * dx + ny * dy + nz * dz) * invView)
            const rim = (1 - mu) ** 3.0 * Math.max(0, Math.min(1, (cosine + 0.22) / 0.77))
            red += rimRgb[0] * rim
            green += rimRgb[1] * rim
            blue += rimRgb[2] * rim
          }
        }
        if (maps.ring && Math.abs(dy) > 0.00001) {
          const t = -oy / dy
          if (t > 0 && (!solid || t < hit)) {
            const x = ox + t * dx,
              z = oz + t * dz,
              r = Math.hypot(x, z)
            if (r >= ringInner && r <= ringOuter) {
              const j = ringSample(maps.ring, r),
                opacity = maps.ring.data[j + 3] / 255
              const along = Math.max(0, -(x * lx + z * lz) / (lx * lx + ly * ly * invP2 + lz * lz))
              const shadow =
                Math.hypot(x + along * lx, (along * ly) / polar, z + along * lz) < 1 ? 0.35 : 1
              const brightness = Math.sqrt(0.32 + 0.68 * Math.sqrt(Math.abs(ly))) * shadow
              const out = opacity + alpha * (1 - opacity)
              if (out > 0) {
                const back = (alpha * (1 - opacity)) / out,
                  front = (brightness * opacity) / out
                red = red * back + maps.ring.data[j] * front
                green = green * back + maps.ring.data[j + 1] * front
                blue = blue * back + maps.ring.data[j + 2] * front
              }
              alpha = out
            }
          }
        }
        pixels[i] = red
        pixels[i + 1] = green
        pixels[i + 2] = blue
        pixels[i + 3] = 255 * alpha
      }
    }
    brush.putImageData(raster, 0, 0)
    ctx.drawImage(canvas, left, top, w, h)
    return true
  }
}
