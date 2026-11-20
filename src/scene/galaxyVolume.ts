import { clamp } from './math'
import type { GalaxyForm, DeepModel } from './deepTypes'
// Each image column has an assumed line-of-sight density profile.
// Conditioning a 3D ellipsoid on its sky projection supplies its depth and thickness.
export function galaxyProfile(f: GalaxyForm, x: number, v: number) {
  const s = Math.sin(f.pitch),
    c = Math.cos(f.pitch)
  let h = f.height + f.bulge * Math.exp((-x * x) / 17 - (v * v) / 12)
  if (f.pitch < 0.29 && f.type !== 3) {
    const t = clamp((Math.abs(v) - 0.9) / 2.9, 0, 1)
    h += 2.7 * t * t * (3 - 2 * t)
  }
  if (f.type === 1) h += 1.25 * Math.exp(-((x - 11.7) ** 2 + (v - 3.1) ** 2) / 6)
  if (f.type === 3) h += 2.15 * Math.min(1, Math.abs(v) / 4)
  const varV = h * h * c * c + f.depth * f.depth * s * s
  return {
    mean: (v * s * c * (h * h - f.depth * f.depth)) / varV,
    sigma: (h * f.depth) / Math.sqrt(varV),
  }
}
export function buildSoftwareVolume(d: DeepModel, pixels: ImageData) {
  const nx = 112,
    ny = 68,
    nz = 132,
    values = new Float32Array(nx * ny * nz * 3)
  const f = d.form!,
    s = Math.sin(f.pitch),
    c = Math.cos(f.pitch),
    w = pixels.width,
    h = pixels.height
  const mean = new Float32Array(w * h),
    invSigma = new Float32Array(w * h),
    tauLut = new Float32Array(256)
  for (let i = 0; i < 256; i++) tauLut[i] = -Math.log(Math.max(0.012, 1 - i / 255))
  for (let i = 0; i < w * h; i++) {
    const ell = galaxyProfile(
      f,
      (((i % w) + 0.5) / w - 0.5) * 32,
      (0.5 - (Math.floor(i / w) + 0.5) / h) * 24,
    )
    mean[i] = ell.mean
    invSigma[i] = 1 / ell.sigma
  }
  for (let iz = 0; iz < nz; iz++)
    for (let iy = 0; iy < ny; iy++)
      for (let ix = 0; ix < nx; ix++) {
        const x = (32 * ix) / (nx - 1) - 16,
          y = (26 * iy) / (ny - 1) - 13,
          z = (42 * iz) / (nz - 1) - 21
        const u = x / 32 + 0.5,
          v = 0.5 - (c * y - s * z) / 24
        if (v <= 0 || v >= 1 || u >= 1) continue
        const j = Math.floor(v * h) * w + Math.floor(u * w),
          q = (s * y + c * z - mean[j]) * invSigma[j]
        if (Math.abs(q) > 4) continue
        const edge = clamp((Math.hypot(x, z) - 12.6) / 3.8, 0, 1)
        const a =
          0.39894 * Math.exp(-0.5 * q * q) * invSigma[j] * (1 - edge * edge * (3 - 2 * edge))
        const at = ((iz * ny + iy) * nx + ix) * 3
        for (let k = 0; k < 3; k++) values[at + k] = tauLut[pixels.data[4 * j + k]] * a
      }
  const canvas = document.createElement('canvas')
  d.voxels = { nx, ny, nz, values, canvas, ctx: canvas.getContext('2d')! }
}
