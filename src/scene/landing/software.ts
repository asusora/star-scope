import type { Sprite } from 'three'
import { tau } from '../math'
import type { SurfaceMesh } from './ground'

export interface SurfacePose {
  x: number
  y: number
  z: number
  heading: number
  pitch: number
}
export const verticalFov = 66
export const focalFactor = 0.5 / Math.tan((verticalFov * Math.PI) / 360)
export function imagePixels(image: CanvasImageSource, size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size)
}
interface Vertex {
  x: number
  y: number
  z: number
  u: number
  v: number
  r: number
  g: number
  b: number
  s: number
  t: number
}
function vertex(): Vertex {
  return { x: 0, y: 0, z: 0, u: 0, v: 0, r: 0, g: 0, b: 0, s: 0, t: 0 }
}
const near = 0.12
function intersect(a: Vertex, b: Vertex): Vertex {
  const t = (near - a.z) / (b.z - a.z)
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    z: near,
    u: a.u + t * (b.u - a.u),
    v: a.v + t * (b.v - a.v),
    s: a.s + t * (b.s - a.s),
    t: a.t + t * (b.t - a.t),
    r: a.r + t * (b.r - a.r),
    g: a.g + t * (b.g - a.g),
    b: a.b + t * (b.b - a.b),
  }
}
export function createSoftwareLandscape(
  ctx: CanvasRenderingContext2D,
  sky: HTMLCanvasElement,
  fog: number[],
  distance: number,
  cloud: boolean,
) {
  const buffer = document.createElement('canvas'),
    brush = buffer.getContext('2d')!
  const env = sky.getContext('2d')!.getImageData(0, 0, sky.width, sky.height).data
  let frame: ImageData,
    depth: Float32Array,
    points: Vertex[] = []
  let mip: ImageData[] = []
  let mist: ImageData | undefined, shadow: ImageData | undefined, lastPatch: SurfaceMesh | undefined
  function texture(image: CanvasImageSource) {
    mip = [256, 64, 16].map((size) => imagePixels(image, size))
  }
  function draw(
    mesh: SurfaceMesh,
    pose: SurfacePose,
    width: number,
    height: number,
    wisps: Sprite[],
  ) {
    const scale = Math.min(1, 540 / width, 420 / height)
    const w = Math.max(1, Math.round(width * scale)),
      h = Math.max(1, Math.round(height * scale))
    if (!frame || buffer.width !== w || buffer.height !== h) {
      buffer.width = w
      buffer.height = h
      frame = brush.createImageData(w, h)
      depth = new Float32Array(w * h)
    }
    const out = frame.data,
      f = h * focalFactor,
      sy = Math.sin(pose.heading),
      cy = Math.cos(pose.heading),
      sp = Math.sin(pose.pitch),
      cp = Math.cos(pose.pitch)
    depth.fill(0)
    for (let y = 0; y < h; y++) {
      const ry = (h * 0.5 - y - 0.5) / f,
        ey = sp + ry * cp,
        front = cp - ry * sp
      for (let x = 0; x < w; x++) {
        const rx = (x + 0.5 - w * 0.5) / f,
          dx = cy * rx + sy * front,
          dz = sy * rx - cy * front
        const u = Math.atan2(dz, -dx) / tau
        const j =
          4 *
          (Math.min(
            sky.height - 1,
            Math.max(
              0,
              Math.floor((0.5 - Math.atan2(ey, Math.hypot(dx, dz)) / Math.PI) * sky.height),
            ),
          ) *
            sky.width +
            Math.floor((u - Math.floor(u)) * sky.width))
        const i = 4 * (y * w + x)
        out[i] = env[j]
        out[i + 1] = env[j + 1]
        out[i + 2] = env[j + 2]
        out[i + 3] = 255
      }
    }
    if (mesh !== lastPatch) {
      lastPatch = mesh
      shadow = cloud
        ? undefined
        : mesh.shadows.getContext('2d')!.getImageData(0, 0, mesh.shadows.width, mesh.shadows.height)
    }
    const count = mesh.position.length / 3
    while (points.length < count) points.push(vertex())
    for (let i = 0; i < count; i++) {
      const v = points[i],
        n = i * 3,
        dx = mesh.position[n] - pose.x,
        dy = mesh.position[n + 1] - pose.y,
        dz = mesh.position[n + 2] - pose.z,
        front = sy * dx - cy * dz
      v.x = cy * dx + sy * dz
      v.y = cp * dy - sp * front
      v.z = cp * front + sp * dy
      v.s = mesh.shadowUv[i * 2]
      v.t = mesh.shadowUv[i * 2 + 1]
      v.u = mesh.uv[i * 2]
      v.v = mesh.uv[i * 2 + 1]
      v.r = mesh.color[n]
      v.g = mesh.color[n + 1]
      v.b = mesh.color[n + 2]
    }
    function triangle(a: Vertex, b: Vertex, c: Vertex) {
      const da = 1 / a.z,
        db = 1 / b.z,
        dc = 1 / c.z
      const ax = w * 0.5 + f * a.x * da,
        ay = h * 0.5 - f * a.y * da,
        bx = w * 0.5 + f * b.x * db,
        by = h * 0.5 - f * b.y * db,
        cx = w * 0.5 + f * c.x * dc,
        cy = h * 0.5 - f * c.y * dc
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))),
        maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)))
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))),
        maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)))
      if (maxX < minX || maxY < minY) return
      const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
      if (area >= -0.000001) return
      const du = (by - cy) / area,
        dv = (cy - ay) / area
      for (let y = minY; y <= maxY; y++) {
        const dy = y + 0.5 - cy
        let aWeight = du * (minX + 0.5 - cx) + ((cx - bx) * dy) / area,
          bWeight = dv * (minX + 0.5 - cx) + ((ax - cx) * dy) / area
        for (let x = minX; x <= maxX; x++, aWeight += du, bWeight += dv) {
          const cWeight = 1 - aWeight - bWeight,
            i = y * w + x
          if (aWeight < 0 || bWeight < 0 || cWeight < 0) continue
          const d = aWeight * da + bWeight * db + cWeight * dc
          if (d <= depth[i]) continue
          depth[i] = d
          const z = 1 / d,
            wa = aWeight * da * z,
            wb = bWeight * db * z,
            wc = 1 - wa - wb
          let grain = 1
          if (mip.length) {
            const tex = mip[z > (cloud ? 600 : 110) ? 2 : z > (cloud ? 250 : 30) ? 1 : 0]
            const u = wa * a.u + wb * b.u + wc * c.u,
              v = wa * a.v + wb * b.v + wc * c.v
            const j =
              (Math.floor((1 - v + Math.floor(v)) * tex.height) % tex.height) * tex.width +
              Math.floor((u - Math.floor(u)) * tex.width)
            grain = 0.3 + tex.data[j * 4] / 255
          }
          if (shadow && a.s !== -1) {
            const s = wa * a.s + wb * b.s + wc * c.s,
              t = wa * a.t + wb * b.t + wc * c.t
            if (s >= 0 && t >= 0 && s < 1 && t < 1)
              grain *=
                shadow.data[
                  4 * (Math.floor(t * shadow.height) * shadow.width + Math.floor(s * shadow.width))
                ] / 255
          }
          const haze = 1 - Math.exp(-z / distance),
            gain = (1 - haze) * grain
          out[i * 4] = 255 * (gain * (wa * a.r + wb * b.r + wc * c.r) + fog[0] * haze)
          out[i * 4 + 1] = 255 * (gain * (wa * a.g + wb * b.g + wc * c.g) + fog[1] * haze)
          out[i * 4 + 2] = 255 * (gain * (wa * a.b + wb * b.b + wc * c.b) + fog[2] * haze)
        }
      }
    }
    for (let i = 0; i < mesh.index.length; i += 3) {
      const a = points[mesh.index[i]],
        b = points[mesh.index[i + 1]],
        c = points[mesh.index[i + 2]]
      if (a.z < near && b.z < near && c.z < near) continue
      if (a.z >= near && b.z >= near && c.z >= near) {
        triangle(a, b, c)
        continue
      }
      const clipped: Vertex[] = []
      let last = c
      for (const v of [a, b, c]) {
        if (v.z >= near !== last.z >= near) clipped.push(intersect(last, v))
        if (v.z >= near) clipped.push(v)
        last = v
      }
      for (let t = 1; t < clipped.length - 1; t++) triangle(clipped[0], clipped[t], clipped[t + 1])
    }
    if (mist) {
      const sprites = wisps
        .map((s) => {
          const dx = s.position.x - pose.x,
            dy = s.position.y - pose.y,
            dz = s.position.z - pose.z,
            front = sy * dx - cy * dz
          const z = cp * front + sp * dy
          return {
            z,
            x: w * 0.5 + (f * (cy * dx + sy * dz)) / z,
            y: h * 0.5 - (f * (cp * dy - sp * front)) / z,
            width: (f * s.scale.x) / z,
            height: (f * s.scale.y) / z,
          }
        })
        .filter((p) => p.z > near)
        .sort((a, b) => b.z - a.z)
      for (const p of sprites) {
        const left = p.x - p.width / 2,
          top = p.y - p.height / 2
        for (let y = Math.max(0, Math.ceil(top)); y < Math.min(h, top + p.height); y++)
          for (let x = Math.max(0, Math.ceil(left)); x < Math.min(w, left + p.width); x++) {
            const i = y * w + x
            if (depth[i] > 1 / p.z) continue
            const j =
              (Math.floor(((y - top) / p.height) * mist.height) * mist.width +
                Math.floor(((x - left) / p.width) * mist.width)) *
              4
            const alpha = (mist.data[j + 3] / 255) * 0.43
            for (let k = 0; k < 3; k++)
              out[i * 4 + k] += (mist.data[j] * Math.min(1, fog[k] + 0.12) - out[i * 4 + k]) * alpha
          }
      }
    }
    brush.putImageData(frame, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(buffer, 0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  return {
    texture,
    draw,
    setMist: (image: CanvasImageSource) => {
      mist = imagePixels(image, 128)
    },
  }
}
