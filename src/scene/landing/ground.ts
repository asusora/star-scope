import * as T from 'three'
import { clamp } from '../math'
import { rgb, sunDirection, type Landscape, type Terrain } from './landscape'

export interface SurfaceMesh {
  position: Float32Array
  color: Float32Array
  uv: Float32Array
  index: Uint32Array
  shadowUv: Float32Array
  shadows: HTMLCanvasElement
}
const divisions = 156
const offsets = Array.from({ length: divisions + 1 }, (_, i) => {
  const t = (2 * i) / divisions - 1
  return Math.sign(t) * 12 * Math.expm1(Math.abs(t) * 5.32)
})
const cell = 8
function rockSeed(x: number, z: number, seed: number) {
  let hash = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ seed) >>> 0
  return () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0
    return hash / 4294967296
  }
}
function boulder(gx: number, gz: number, seed: number) {
  const rand = rockSeed(gx, gz, seed),
    x = (gx + rand()) * cell,
    z = (gz + rand()) * cell
  const radius = 0.09 + rand() ** 4 * 1.36
  const rx = radius * (0.8 + rand() * 0.65),
    ry = radius * (0.34 + rand() * 0.5),
    rz = radius * (0.68 + rand() * 0.48)
  return {
    x,
    z,
    radius,
    rx,
    ry,
    rz,
    angle: rand() * Math.PI * 2,
    tint: 0.59 + rand() * 0.45,
    phase: rand() * 9,
  }
}
export function walkable(x: number, z: number, seed: number) {
  const col = Math.floor(x / cell),
    row = Math.floor(z / cell)
  for (let gx = col - 1; gx <= col + 1; gx++)
    for (let gz = row - 1; gz <= row + 1; gz++) {
      const rock = boulder(gx, gz, seed)
      if (rock.ry < 0.48 || Math.hypot(rock.x, rock.z) < 2.2) continue
      const dx = x - rock.x,
        dz = z - rock.z,
        c = Math.cos(rock.angle),
        s = Math.sin(rock.angle)
      if (
        ((dx * c + dz * s) / (rock.rx + 0.18)) ** 2 + ((dz * c - dx * s) / (rock.rz + 0.18)) ** 2 <
        1
      )
        return false
    }
  return true
}
export function buildPatch(site: Landscape, terrain: Terrain, cx: number, cz: number): SurfaceMesh {
  const { height, noise } = terrain,
    cloud = site.kind === 'cloud',
    stride = divisions + 1,
    base = rgb(site.palette[0]),
    pale = rgb(site.palette[1])
  const position: number[] = [],
    color: number[] = [],
    uv: number[] = [],
    index: number[] = []
  const shadows = document.createElement('canvas')
  shadows.width = shadows.height = cloud ? 1 : 512
  const ink = shadows.getContext('2d')!
  ink.fillStyle = 'white'
  ink.fillRect(0, 0, shadows.width, shadows.height)
  function shadow(x: number, z: number, rx: number, ry: number, rz: number) {
    const reach = ry * 2.3,
      angle = Math.atan2(-sunDirection[2], -sunDirection[0])
    ink.save()
    ink.translate((0.5 + (x - cx) / 216) * 512, (0.5 + (z - cz) / 216) * 512)
    ink.rotate(angle)
    ink.translate((reach * 0.44 * 512) / 216, 0)
    ink.scale(((reach * 0.58 + rx) * 512) / 216, ((rz * 0.82 + rx * 0.18) * 512) / 216)
    const fade = ink.createRadialGradient(0, 0, 0, 0, 0, 1)
    fade.addColorStop(0, '#0009')
    fade.addColorStop(0.66, '#0007')
    fade.addColorStop(1, '#0000')
    ink.fillStyle = fade
    ink.fillRect(-1, -1, 2, 2)
    ink.restore()
  }
  for (const dz of offsets)
    for (const dx of offsets) {
      const x = cx + dx,
        z = cz + dz
      position.push(x, height(x, z), z)
      const tile = cloud ? 100 : 3.8
      uv.push((x * 0.86 + z * 0.5) / tile, (z * 0.86 - x * 0.5) / tile)
    }
  for (let iz = 0; iz < stride; iz++)
    for (let ix = 0; ix < stride; ix++) {
      const i = iz * stride + ix,
        j = i * 3
      const l = (ix ? i - 1 : i) * 3,
        r = (ix < divisions ? i + 1 : i) * 3,
        b = (iz ? i - stride : i) * 3,
        f = (iz < divisions ? i + stride : i) * 3
      const x = position[j],
        y = position[j + 1],
        z = position[j + 2]
      const nx = (position[l + 1] - position[r + 1]) / (position[r] - position[l]),
        nz = (position[b + 1] - position[f + 1]) / (position[f + 2] - position[b + 2])
      const length = Math.hypot(nx, 1, nz),
        dot = (nx * sunDirection[0] + sunDirection[1] + nz * sunDirection[2]) / length
      let shade = cloud
        ? 0.88 + 0.22 * dot
        : 0.63 + 0.49 * Math.max(0, dot) + 0.16 * Math.max(-0.8, dot)
      if (!cloud && Math.abs(x - cx) < 1400 && Math.abs(z - cz) < 1400) {
        let occlusion = 0
        for (const run of [14, 58, 160]) {
          const blocker =
            height(x + run * sunDirection[0], z + run * sunDirection[2]) - y - run * sunDirection[1]
          occlusion = Math.max(occlusion, clamp(blocker / (3 + run * 0.09), 0, 1))
        }
        shade *= 1 - 0.34 * occlusion
      }
      const n = noise(x * 0.029, z * 0.029),
        m = noise(x * 0.003, z * 0.003)
      let mix = clamp(0.12 + 0.53 * n + 0.28 * m + 0.06 * Math.sin(y * 0.7 + n * 2), 0, 1)
      if (site.kind === 'alpine') mix = clamp(mix + (y - 98) * 0.009, 0, 1)
      if (cloud) mix = clamp(0.2 + (y - 22) / 87 + 0.12 * n, 0, 1)
      if (site.kind === 'dust' || site.kind === 'lava')
        shade *= 0.94 + 0.065 * Math.sin(y * 1.8 + n * 2.8) + 0.065 * n
      for (let k = 0; k < 3; k++) {
        let tint = base[k] + (pale[k] - base[k]) * mix
        if (site.kind === 'alpine' && y > 120)
          tint += (0.93 - tint) * clamp((y - 120) / 85 + (0.9 - length) * 0.6, 0, 0.92)
        color.push(clamp(tint * shade, 0, 1))
      }
      if (ix < divisions && iz < divisions)
        index.push(i, i + stride, i + 1, i + 1, i + stride, i + stride + 1)
    }
  if (!cloud) {
    // Scatter rocks in world-space cells so revisiting a patch reproduces the same outcrops.
    const small = new T.IcosahedronGeometry(1, 0),
      large = new T.IcosahedronGeometry(1, 1)
    for (let gz = Math.floor(cz / cell) - 12; gz <= Math.floor(cz / cell) + 12; gz++)
      for (let gx = Math.floor(cx / cell) - 12; gx <= Math.floor(cx / cell) + 12; gx++) {
        const { x, z, radius, rx, ry, rz, angle, tint, phase } = boulder(gx, gz, site.seed)
        if (Math.hypot(x - cx, z - cz) > 92 || Math.hypot(x, z) < 2.2) continue
        const cs = Math.cos(angle),
          sn = Math.sin(angle),
          rockY = height(x, z) - ry * 0.17
        shadow(x, z, rx, ry, rz)
        const verts = (radius > 0.48 ? large : small).attributes.position
        const p = new T.Vector3(),
          a = new T.Vector3(),
          b = new T.Vector3(),
          normal = new T.Vector3()
        for (let v = 0; v < verts.count; v += 3) {
          const start = position.length / 3
          for (let n = 0; n < 3; n++) {
            p.fromBufferAttribute(verts, v + n)
            const rough =
              1 +
              0.13 * Math.sin(p.x * 4 + p.y * 5 + p.z * 7 + phase) +
              0.09 * Math.sin(p.x * 7 - p.y * 2 + phase)
            const dx = p.x * rx * rough,
              dz = p.z * rz * rough
            position.push(x + dx * cs - dz * sn, rockY + p.y * ry * rough, z + dx * sn + dz * cs)
            uv.push((dx + dz * 0.42 + p.y * 0.2) * 0.8, (p.y * ry + dz * 0.55) * 0.8)
          }
          a.fromArray(position, 3 * start)
          b.fromArray(position, 3 * (start + 1)).sub(a)
          normal
            .fromArray(position, 3 * (start + 2))
            .sub(a)
            .crossVectors(b, normal)
            .normalize()
          for (let n = 0; n < 3; n++) {
            const j = 3 * (start + n)
            p.set(
              (position[j] - x) / (rx * rx),
              (position[j + 1] - rockY) / (ry * ry),
              (position[j + 2] - z) / (rz * rz),
            )
              .normalize()
              .lerp(normal, 0.54)
              .normalize()
            const value =
              tint *
              (0.62 +
                0.49 *
                  Math.max(
                    0,
                    p.x * sunDirection[0] + p.y * sunDirection[1] + p.z * sunDirection[2],
                  )) *
              (0.79 + 0.21 * Math.max(0, p.y))
            for (let k = 0; k < 3; k++)
              color.push(Math.min(1, (base[k] * 0.55 + pale[k] * 0.45) * value))
          }
          index.push(start, start + 1, start + 2)
        }
      }
    small.dispose()
    large.dispose()
  }
  const shadowUv = new Float32Array((position.length / 3) * 2).fill(-1)
  if (!cloud)
    for (let i = 0; i < stride * stride; i++) {
      shadowUv[i * 2] = 0.5 + (position[i * 3] - cx) / 216
      shadowUv[i * 2 + 1] = 0.5 + (position[i * 3 + 2] - cz) / 216
    }
  return {
    shadows,
    shadowUv,
    position: new Float32Array(position),
    color: new Float32Array(color),
    uv: new Float32Array(uv),
    index: new Uint32Array(index),
  }
}
