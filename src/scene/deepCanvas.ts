import * as T from 'three'
import { clamp, rad, tau, v3 } from './math'
import type { DeepBody, DeepModel, LightField, Surface } from './deepTypes'
import type { ScreenPoint } from './types'
export function createDeepCanvasRenderer(
  ctx: CanvasRenderingContext2D,
  camera: T.PerspectiveCamera,
  project: (pos: T.Vector3) => ScreenPoint | null,
  getSurface: (key: string) => Surface,
  glowMap: (color: string) => T.CanvasTexture,
) {
  // The software renderer projects the same 3D point clouds and sphere surfaces.
  const stampCache = new Map<number, HTMLCanvasElement>()
  function lightStamp(r: number, g: number, b: number) {
    const rr = Math.round(r * 31),
      gg = Math.round(g * 31),
      bb = Math.round(b * 31),
      key = (rr << 10) | (gg << 5) | bb
    if (stampCache.has(key)) return stampCache.get(key)!
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const k = c.getContext('2d')!,
      gradient = k.createRadialGradient(16, 16, 0, 16, 16, 16)
    const rgb = [rr, gg, bb].map((v) => Math.round((v * 255) / 31)).join(',')
    for (const [s, a] of [
      [0, 1],
      [0.3, 0.71],
      [0.6, 0.26],
      [0.85, 0.05],
      [1, 0],
    ])
      gradient.addColorStop(s, 'rgba(' + rgb + ',' + a + ')')
    k.fillStyle = gradient
    k.fillRect(0, 0, 32, 32)
    stampCache.set(key, c)
    return c
  }
  const localClip = new T.Matrix4()
  return function draw(
    d: DeepModel,
    width: number,
    height: number,
    pixelRatio: number,
    moving: boolean,
  ) {
    function drawSoftwareVolume(d: DeepModel) {
      const vol = d.voxels
      if (!vol) return

      const scale = Math.min(1, (moving ? 236 : 440) / width, (moving ? 240 : 400) / height)
      const w = Math.max(2, Math.round(width * scale)),
        h = Math.max(2, Math.round(height * scale))
      if (vol.canvas.width !== w || vol.canvas.height !== h || !vol.image) {
        vol.canvas.width = w
        vol.canvas.height = h
        vol.image = vol.ctx.createImageData(w, h)
      }
      const dst = vol.image.data,
        { nx, ny, nz, values } = vol
      const matrix = new T.Matrix4()
          .copy(d.root.matrixWorld)
          .invert()
          .multiply(camera.matrixWorld).elements,
        m = camera.projectionMatrix.elements
      const ox = matrix[12],
        oy = matrix[13],
        oz = matrix[14],
        kx = (nx - 1) / 32,
        ky = (ny - 1) / 26,
        kz = (nz - 1) / 42
      const exposure =
        clamp(
          (Math.abs(oy) / Math.hypot(ox, oy, oz) + 0.14) / (Math.sin(d.form!.pitch) + 0.14),
          0.14,
          1.12,
        ) ** 0.65
      for (let iy = 0; iy < h; iy++) {
        const cy = (1 - (2 * (iy + 0.5)) / h + m[9]) / m[5]
        for (let ix = 0; ix < w; ix++) {
          const out = (iy * w + ix) * 4,
            cx = ((2 * (ix + 0.5)) / w - 1 + m[8]) / m[0]
          const dx = matrix[0] * cx + matrix[4] * cy - matrix[8],
            dy = matrix[1] * cx + matrix[5] * cy - matrix[9],
            dz = matrix[2] * cx + matrix[6] * cy - matrix[10]
          const x1 = (-16 - ox) / dx,
            x2 = (16 - ox) / dx,
            y1 = (-13 - oy) / dy,
            y2 = (13 - oy) / dy,
            z1 = (-21 - oz) / dz,
            z2 = (21 - oz) / dz
          const begin = Math.max(0, Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2))
          const end = Math.min(Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2))
          if (begin >= end) {
            dst[out + 3] = 0
            continue
          }
          const n = moving ? 40 : 64,
            dt = (end - begin) / n,
            t = begin + dt * 0.5
          let vx = (ox + dx * t + 16) * kx,
            vy = (oy + dy * t + 13) * ky,
            vz = (oz + dz * t + 21) * kz
          const ax = dx * dt * kx,
            ay = dy * dt * ky,
            az = dz * dt * kz
          let red = 0,
            green = 0,
            blue = 0
          for (let j = 0; j < n; j++, vx += ax, vy += ay, vz += az) {
            const xx = Math.min(nx - 2, Math.max(0, vx | 0)),
              yy = Math.min(ny - 2, Math.max(0, vy | 0)),
              zz = Math.min(nz - 2, Math.max(0, vz | 0))
            const fx = vx - xx,
              fy = vy - yy,
              fz = vz - zz,
              base = ((zz * ny + yy) * nx + xx) * 3
            for (let iz = 0; iz < 2; iz++)
              for (let jy = 0; jy < 2; jy++) {
                const weight = (iz ? fz : 1 - fz) * (jy ? fy : 1 - fy),
                  at = base + 3 * nx * (iz * ny + jy)
                red += weight * (values[at] + fx * (values[at + 3] - values[at]))
                green += weight * (values[at + 1] + fx * (values[at + 4] - values[at + 1]))
                blue += weight * (values[at + 2] + fx * (values[at + 5] - values[at + 2]))
              }
          }
          const gain = exposure * dt * Math.sqrt(cx * cx + cy * cy + 1)
          dst[out] = 255 * (1 - Math.exp(-gain * red))
          dst[out + 1] = 255 * (1 - Math.exp(-gain * green))
          dst[out + 2] = 255 * (1 - Math.exp(-gain * blue))
          dst[out + 3] = 255
        }
      }
      vol.ctx.putImageData(vol.image, 0, 0)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.drawImage(vol.canvas, 0, 0, width, height)
      ctx.restore()
    }
    function drawPointCloud(field: LightField, frontDepth: number, front: boolean) {
      const data = field.geometry.attributes,
        p = data.position.array,
        colors = data.tint.array
      const sizes = data.diameter.array,
        alpha = data.strength.array,
        n = sizes.length
      const m = localClip
        .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        .multiply(field.matrixWorld).elements
      const f = (height * 0.5) / Math.tan(camera.fov * rad * 0.5),
        step = n > 19000 ? 5 : n > 8000 ? 3 : 1
      const eyeLocal = field.material.uniforms.localEye.value,
        dust = field.material.uniforms.dust.value
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < n; i += step) {
        const j = i * 3,
          x = p[j],
          y = p[j + 1],
          z = p[j + 2],
          w = m[3] * x + m[7] * y + m[11] * z + m[15]
        if (w <= camera.near || (front ? w >= frontDepth : w < frontDepth)) continue
        const sx = (1 + (m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * width * 0.5,
          sy = (1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * height * 0.5
        const size = Math.min(90, Math.max(0.65, (sizes[i] * f) / w))
        if (sx < -size || sx > width + size || sy < -size || sy > height + size) continue
        let opacity = alpha[i] * step
        if (dust && y * eyeLocal.y < 0) {
          const dx = eyeLocal.x - x,
            dy = eyeLocal.y - y,
            dz = eyeLocal.z - z,
            t = -y / dy,
            r = Math.hypot(x + t * dx, z + t * dz)
          const band = clamp((r - 2.3) / 2.7, 0, 1) * clamp((13.8 - r) / 3.3, 0, 1)
          opacity *= Math.exp((-dust * band) / (0.07 + Math.abs(dy) / Math.hypot(dx, dy, dz)))
        }
        ctx.globalAlpha = Math.min(1, opacity)
        ctx.drawImage(
          lightStamp(colors[j], colors[j + 1], colors[j + 2]),
          sx - size * 0.5,
          sy - size * 0.5,
          size,
          size,
        )
      }
      ctx.restore()
    }
    function softwareBody(b: DeepBody, q: ScreenPoint) {
      const r = b.r * q.scale,
        sz = Math.max(8, Math.min(320, Math.ceil(r * 2 * pixelRatio)))
      if (!b.raster) {
        b.raster = document.createElement('canvas')
        b.brush = b.raster.getContext('2d')!
      }
      if (b.raster.width !== sz || !b.rasterData) {
        b.raster.width = b.raster.height = sz
        b.rasterData = b.brush!.createImageData(sz, sz)
      }
      const basisZ = camera.position.clone().sub(b.pos).normalize()
      const basisX = v3(0, 1, 0).cross(basisZ).normalize(),
        basisY = basisZ.clone().cross(basisX)
      const light = b.look
        ? null
        : d.bodies
            .find((body) => body.key === 'host')!
            .pos.clone()
            .sub(b.pos)
            .normalize()
      const air = d.system?.rim || '#b8d1dc',
        atmo = [1, 3, 5].map((i) => parseInt(air.slice(i, i + 2), 16))
      const pixels = b.surface.pixels,
        emission =
          b.key === 'main' && d.entry.id === '55-cancri-e'
            ? getSurface('lava-emission').pixels
            : null
      const cos = Math.cos(b.mesh.rotation.y),
        sin = Math.sin(b.mesh.rotation.y),
        out = b.rasterData.data
      for (let y = 0; y < sz; y++) {
        const ny = 1 - (2 * (y + 0.5)) / sz
        for (let x = 0; x < sz; x++) {
          const nx = (2 * (x + 0.5)) / sz - 1,
            depth = 1 - nx * nx - ny * ny,
            i = (y * sz + x) * 4
          if (depth <= 0) {
            out[i + 3] = 0
            continue
          }
          const nz = Math.sqrt(depth)
          const wx = nx * basisX.x + ny * basisY.x + nz * basisZ.x,
            wy = nx * basisX.y + ny * basisY.y + nz * basisZ.y,
            wz = nx * basisX.z + ny * basisY.z + nz * basisZ.z
          const u = (1.5 - Math.atan2(wz * cos + wx * sin, wx * cos - wz * sin) / tau) % 1
          const v = 0.5 - Math.asin(clamp(wy, -1, 1)) / Math.PI
          const j = pixels
            ? 4 *
              (Math.min(pixels.height - 1, Math.floor(v * pixels.height)) * pixels.width +
                Math.floor(u * pixels.width))
            : 0
          if (b.look) {
            const n = pixels ? pixels.data[j] / 255 : 0.7,
              f = clamp((n - 0.2) / 0.79, 0, 1),
              mix = f * f * (3 - 2 * f)
            for (let k = 0; k < 3; k++)
              out[i + k] =
                (b.look.dark[k] + (b.look.hot[k] - b.look.dark[k]) * mix) *
                (0.6 + 0.4 * Math.sqrt(nz))
          } else {
            const sunward = wx * light!.x + wy * light!.y + wz * light!.z,
              lit = 0.17 + 0.99 * Math.sqrt(Math.max(0, sunward))
            const rim = (1 - nz) ** 3 * (0.08 + 0.39 * Math.max(0, sunward))
            for (let k = 0; k < 3; k++)
              out[i + k] =
                (pixels ? pixels.data[j + k] : 120) * lit +
                rim * atmo[k] +
                (emission ? emission.data[j + k] * 1.15 : 0)
          }
          out[i + 3] = 255 * clamp(depth * sz * 0.5, 0, 1)
        }
      }
      b.brush!.putImageData(b.rasterData, 0, 0)
      if (b.look) {
        const glow = glowMap(b.look.halo).image
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.drawImage(glow, q.x - r * 3.3, q.y - r * 3.3, r * 6.6, r * 6.6)
        ctx.restore()
      }
      const ry = (r * b.mesh.scale.y) / b.r
      ctx.drawImage(b.raster, q.x - r, q.y - ry, 2 * r, 2 * ry)
    }

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.fillStyle = '#060b12'
    ctx.fillRect(0, 0, width, height)
    const pos = v3(),
      background = d.background.geometry.attributes.position
    ctx.fillStyle = '#8494aa'
    for (let i = 0; i < background.count; i++) {
      const q = project(pos.fromBufferAttribute(background, i).add(camera.position))
      if (q && q.x >= 0 && q.x < width && q.y >= 0 && q.y < height) ctx.fillRect(q.x, q.y, 1, 1)
    }
    for (const orbit of d.orbits) {
      if (!orbit.visible) continue
      const points = orbit.geometry.attributes.position
      ctx.beginPath()
      ctx.strokeStyle = '#b6a99062'
      let prev = false
      for (let i = 0; i <= points.count; i++) {
        const q = project(pos.fromBufferAttribute(points, i % points.count))
        if (q) {
          if (prev) ctx.lineTo(q.x, q.y)
          else ctx.moveTo(q.x, q.y)
        }
        prev = !!q
      }
      ctx.stroke()
    }
    if (d.form) drawSoftwareVolume(d)
    const bodies = d.bodies
      .map((b) => ({ b, q: project(b.pos) }))
      .filter((o): o is { b: DeepBody; q: ScreenPoint } => o.q !== null)
      .sort((a, b) => b.q.z - a.q.z)
    const frontDepth = bodies.length ? bodies[bodies.length - 1].q.z : 0
    for (const field of d.fields) drawPointCloud(field, frontDepth, false)
    for (const { b, q } of bodies) {
      const r = q.scale * b.r
      if (q.x + r >= 0 && q.x - r <= width && q.y + r >= 0 && q.y - r <= height) softwareBody(b, q)
    }
    if (frontDepth) for (const field of d.fields) drawPointCloud(field, frontDepth, true)
  }
}
