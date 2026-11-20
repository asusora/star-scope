import * as T from 'three'
import { seeded } from './math'

export type DetailTier = 'mid' | 'close'

export interface CraterDef {
  dir: [number, number, number]
  radius: number
  depth: number
  peak?: number
  rim?: number
  floorTint?: [number, number, number]
  rays?: number
  rings?: number
}

export interface LineaeDef {
  normal: [number, number, number]
  width: number
  depth: number
  color: [number, number, number]
  doubleRidge?: boolean
  arcCenter?: [number, number, number]
  arcLimit?: number
  wobble?: number
  seed?: number
}

export interface PatchDef {
  dir: [number, number, number]
  radius: number
  softness: number
  color: [number, number, number]
  height?: number
  gloss?: number
  noiseMix?: number
}

export interface CoronaDef {
  dir: [number, number, number]
  radius: number
  freq: number
  tint: [number, number, number]
}

export interface BodyDetailSpec {
  id: string
  seed: number
  /** Whether the body needs custom 3D vertex displacement instead of a smooth sphere. */
  customShape: boolean
  scaleXYZ: [number, number, number]
  /** Bilobed contact-binary waist pinch (0 = none). */
  bilobed?: number
  /** Macro irregular rock bumpiness. */
  roughness: number
  /** Sharp polygonal rock facet intensity (e.g. Proteus, Juno, minor moons). */
  facetStrength?: number
  /** Equatorial ridge height and width (e.g. Iapetus, Pan). */
  equatorialRidge?: { height: number; width: number; tint?: [number, number, number] }
  /** Equatorial groove belt (e.g. Vesta Divalia Fossae, Phobos grooves). */
  grooves?: {
    axis: [number, number, number]
    freq: number
    depth: number
    latBand: [number, number]
  }
  /** 3D geometry craters (large craters that alter silhouette). */
  geoCraterCount: number
  specialCraters: CraterDef[]
  /** Texture-level crater field (medium + small craters baked into albedo & normal). */
  texCraterCount: number
  craterMinRad: number
  craterMaxRad: number
  craterDepthScale: number
  brightCraterFloor?: number
  darkCraterFloor?: number
  brightRayFraction?: number
  /** Surface color palette (sRGB 0..1). */
  baseColor: [number, number, number]
  highColor: [number, number, number]
  lowColor: [number, number, number]
  accentColor?: [number, number, number]
  /** Noise layering weights. */
  macroFreq: number
  detailFreq: number
  ridgeMix: number
  noiseContrast: number
  microRoughness: number
  /** Normal map strength. */
  normalStrength: number
  /** Base specular / ice gloss (0..1). */
  baseGloss: number
  iceGlossBoost?: number
  /** Specialized planetary features. */
  plutoFeatures?: boolean
  titanBands?: boolean
  ioVolcanism?: boolean
  tritonCantaloupe?: boolean
  iapetusDichotomy?: boolean
  ganymedeSulci?: boolean
  enceladusStripes?: boolean
  europaChaos?: boolean
  lineae?: LineaeDef[]
  patches?: PatchDef[]
  coronae?: CoronaDef[]
  /** Blend ratio with existing loaded base image when available (0 = pure procedural, 0.7 = strong base). */
  baseImageMix?: number
}

export function hashString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h || 1
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

// Fast deterministic 3D lattice value noise with quintic interpolation (zero allocations).
function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let n =
    (Math.imul(ix, 374761393) +
      Math.imul(iy, 668265263) +
      Math.imul(iz, 2147483647) +
      Math.imul(seed, 1597334677)) |
    0
  n = (n ^ (n >>> 13)) | 0
  n = Math.imul(n, 1274126177) | 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10)

  const n000 = hash3(ix, iy, iz, seed)
  const n100 = hash3(ix + 1, iy, iz, seed)
  const n010 = hash3(ix, iy + 1, iz, seed)
  const n110 = hash3(ix + 1, iy + 1, iz, seed)
  const n001 = hash3(ix, iy, iz + 1, seed)
  const n101 = hash3(ix + 1, iy, iz + 1, seed)
  const n011 = hash3(ix, iy + 1, iz + 1, seed)
  const n111 = hash3(ix + 1, iy + 1, iz + 1, seed)

  const nx00 = n000 + (n100 - n000) * ux
  const nx10 = n010 + (n110 - n010) * ux
  const nx01 = n001 + (n101 - n001) * ux
  const nx11 = n011 + (n111 - n011) * ux
  const nxy0 = nx00 + (nx10 - nx00) * uy
  const nxy1 = nx01 + (nx11 - nx01) * uy
  return nxy0 + (nxy1 - nxy0) * uz
}

function fbm3(x: number, y: number, z: number, seed: number, octaves: number): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq, seed + i * 97)
    norm += amp
    amp *= 0.5
    freq *= 2.04
  }
  return sum / norm
}

function ridged3(x: number, y: number, z: number, seed: number, octaves: number): number {
  let sum = 0
  let amp = 0.55
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = noise3(x * freq, y * freq, z * freq, seed + i * 131)
    const r = 1 - Math.abs(n * 2 - 1)
    sum += amp * r * r
    norm += amp
    amp *= 0.48
    freq *= 2.09
  }
  return sum / norm
}

// Cheap 3D Voronoi cell distance for cantaloupe terrain / rocky facets.
function voronoi3(x: number, y: number, z: number, seed: number): [number, number] {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  let d1 = 9
  let d2 = 9
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx
        const cy = iy + dy
        const cz = iz + dz
        const px = cx + hash3(cx, cy, cz, seed + 17)
        const py = cy + hash3(cx, cy, cz, seed + 53)
        const pz = cz + hash3(cx, cy, cz, seed + 89)
        const dist = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2
        if (dist < d1) {
          d2 = d1
          d1 = dist
        } else if (dist < d2) {
          d2 = dist
        }
      }
    }
  }
  return [Math.sqrt(d1), Math.sqrt(d2)]
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function makeLineaeSet(
  seed: number,
  count: number,
  widthRange: [number, number],
  depthRange: [number, number],
  color: [number, number, number],
  doubleRidge = false,
): LineaeDef[] {
  const rand = seeded(seed)
  const out: LineaeDef[] = []
  for (let i = 0; i < count; i++) {
    const z = rand() * 2 - 1
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    const n = norm3(Math.cos(a) * r, z, Math.sin(a) * r)
    // Pick an arc center perpendicular to normal
    const az = rand() * 2 - 1
    const aa = rand() * Math.PI * 2
    const ar = Math.sqrt(Math.max(0, 1 - az * az))
    let cx = Math.cos(aa) * ar
    let cy = az
    let cz = Math.sin(aa) * ar
    const d = cx * n[0] + cy * n[1] + cz * n[2]
    cx -= d * n[0]
    cy -= d * n[1]
    cz -= d * n[2]
    const arcCenter = norm3(cx, cy, cz)
    out.push({
      normal: n,
      width: widthRange[0] + rand() * (widthRange[1] - widthRange[0]),
      depth: depthRange[0] + rand() * (depthRange[1] - depthRange[0]),
      color,
      doubleRidge,
      arcCenter,
      arcLimit: -0.25 + rand() * 0.72,
      wobble: 0.025 + rand() * 0.04,
      seed: Math.floor(rand() * 10000),
    })
  }
  return out
}

const curatedSpecs: Record<string, BodyDetailSpec> = {
  // ======================= DWARF PLANETS & ASTEROIDS =======================
  Pluto: {
    id: 'Pluto',
    seed: 1001,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.008,
    geoCraterCount: 0,
    specialCraters: [
      { dir: [-0.4, 0.25, 0.88], radius: 0.14, depth: 0.28, rim: 0.3 },
      { dir: [0.55, 0.42, -0.72], radius: 0.12, depth: 0.24, rim: 0.25 },
      { dir: [-0.82, -0.35, -0.45], radius: 0.16, depth: 0.3, rim: 0.28 },
    ],
    texCraterCount: 55,
    craterMinRad: 0.022,
    craterMaxRad: 0.11,
    craterDepthScale: 0.24,
    baseColor: [0.76, 0.68, 0.61],
    highColor: [0.95, 0.91, 0.85],
    lowColor: [0.36, 0.2, 0.15],
    accentColor: [0.54, 0.31, 0.22],
    macroFreq: 2.3,
    detailFreq: 9.5,
    ridgeMix: 0.38,
    noiseContrast: 0.62,
    microRoughness: 0.18,
    normalStrength: 1.35,
    baseGloss: 0.12,
    iceGlossBoost: 0.35,
    plutoFeatures: true,
    baseImageMix: 0.48,
  },
  Ceres: {
    id: 'Ceres',
    seed: 1002,
    customShape: true,
    scaleXYZ: [1.02, 0.94, 1.02],
    roughness: 0.014,
    geoCraterCount: 16,
    specialCraters: [
      // Occator crater (Cerealia Facula bright salt dome!)
      {
        dir: norm3(0.76, 0.34, 0.55),
        radius: 0.19,
        depth: 0.036,
        peak: 0.012,
        rim: 0.36,
        floorTint: [0.96, 0.98, 1.0],
        rays: 0.35,
      },
      // Kerwan basin
      { dir: norm3(-0.35, -0.18, 0.92), radius: 0.34, depth: 0.028, rim: 0.18 },
      // Yalode basin
      { dir: norm3(-0.62, -0.66, -0.42), radius: 0.32, depth: 0.032, rim: 0.22 },
      // Haulani bright-rayed crater
      {
        dir: norm3(0.24, 0.1, -0.96),
        radius: 0.12,
        depth: 0.024,
        rim: 0.34,
        floorTint: [0.74, 0.78, 0.82],
        rays: 0.55,
      },
    ],
    texCraterCount: 140,
    craterMinRad: 0.018,
    craterMaxRad: 0.14,
    craterDepthScale: 0.34,
    brightCraterFloor: 0.16,
    brightRayFraction: 0.08,
    baseColor: [0.43, 0.42, 0.4],
    highColor: [0.58, 0.57, 0.55],
    lowColor: [0.27, 0.26, 0.25],
    macroFreq: 3.1,
    detailFreq: 13.0,
    ridgeMix: 0.3,
    noiseContrast: 0.42,
    microRoughness: 0.28,
    normalStrength: 1.65,
    baseGloss: 0.04,
    patches: [
      // Cerealia Facula bright sodium carbonate center
      { dir: norm3(0.76, 0.34, 0.55), radius: 0.042, softness: 0.5, color: [0.97, 0.98, 1.0], height: 0.22, gloss: 0.45 },
      // Vinalia Faculae secondary salt spots
      { dir: norm3(0.81, 0.33, 0.48), radius: 0.025, softness: 0.55, color: [0.9, 0.92, 0.96], height: 0.12, gloss: 0.35 },
      // Ahuna Mons cryovolcanic dome
      { dir: norm3(0.22, -0.18, 0.96), radius: 0.055, softness: 0.4, color: [0.64, 0.65, 0.68], height: 0.52, gloss: 0.15 },
    ],
    baseImageMix: 0.32,
  },
  Vesta: {
    id: 'Vesta',
    seed: 1003,
    customShape: true,
    scaleXYZ: [1.09, 0.86, 1.03],
    roughness: 0.058,
    facetStrength: 0.035,
    grooves: { axis: [0.06, 0.99, 0.08], freq: 24, depth: 0.022, latBand: [-0.36, 0.22] },
    geoCraterCount: 18,
    specialCraters: [
      // Rheasilvia south polar mega-basin with towering 22km central peak
      { dir: norm3(0.05, -0.99, 0.08), radius: 0.78, depth: 0.165, peak: 0.068, rim: 0.42 },
      // Veneneia overlapping older south basin
      { dir: norm3(-0.34, -0.84, 0.42), radius: 0.52, depth: 0.082, rim: 0.25 },
      // Marcia / Calpurnia / Minucia "Snowman" triple craters in northern hemisphere
      { dir: norm3(0.68, 0.22, 0.7), radius: 0.18, depth: 0.042, rim: 0.35, floorTint: [0.34, 0.32, 0.3] },
      { dir: norm3(0.75, 0.38, 0.53), radius: 0.15, depth: 0.036, rim: 0.32 },
      { dir: norm3(0.78, 0.5, 0.36), radius: 0.12, depth: 0.028, rim: 0.3 },
      // Cornelia bright-rayed crater
      { dir: norm3(-0.78, -0.15, -0.61), radius: 0.13, depth: 0.03, rim: 0.35, floorTint: [0.82, 0.8, 0.76], rays: 0.65 },
    ],
    texCraterCount: 135,
    craterMinRad: 0.018,
    craterMaxRad: 0.15,
    craterDepthScale: 0.36,
    brightCraterFloor: 0.14,
    darkCraterFloor: 0.18,
    brightRayFraction: 0.1,
    baseColor: [0.58, 0.56, 0.53],
    highColor: [0.76, 0.74, 0.7],
    lowColor: [0.32, 0.31, 0.29],
    macroFreq: 2.8,
    detailFreq: 12.5,
    ridgeMix: 0.44,
    noiseContrast: 0.56,
    microRoughness: 0.32,
    normalStrength: 1.85,
    baseGloss: 0.05,
    baseImageMix: 0.22,
  },
  Pallas: {
    id: 'Pallas',
    seed: 1004,
    customShape: true,
    scaleXYZ: [1.09, 0.89, 0.99],
    roughness: 0.068,
    facetStrength: 0.045,
    geoCraterCount: 28, // "Golf-ball" heavily battered surface
    specialCraters: [
      { dir: norm3(0.74, 0.18, 0.64), radius: 0.44, depth: 0.095, rim: 0.38 },
      { dir: norm3(-0.62, 0.45, -0.64), radius: 0.38, depth: 0.082, rim: 0.34 },
      { dir: norm3(0.18, -0.78, -0.6), radius: 0.35, depth: 0.075, rim: 0.32 },
      { dir: norm3(-0.52, -0.35, 0.78), radius: 0.32, depth: 0.07, rim: 0.3 },
    ],
    texCraterCount: 165,
    craterMinRad: 0.02,
    craterMaxRad: 0.17,
    craterDepthScale: 0.4,
    brightCraterFloor: 0.12,
    baseColor: [0.47, 0.49, 0.52],
    highColor: [0.64, 0.66, 0.7],
    lowColor: [0.27, 0.29, 0.32],
    macroFreq: 3.4,
    detailFreq: 13.5,
    ridgeMix: 0.48,
    noiseContrast: 0.48,
    microRoughness: 0.34,
    normalStrength: 1.9,
    baseGloss: 0.05,
    baseImageMix: 0.2,
  },
  Juno: {
    id: 'Juno',
    seed: 1005,
    customShape: true,
    scaleXYZ: [1.19, 0.83, 0.95],
    roughness: 0.088,
    facetStrength: 0.08,
    geoCraterCount: 20,
    specialCraters: [
      // Huge 100km impact bite on Juno
      { dir: norm3(0.66, -0.15, 0.73), radius: 0.56, depth: 0.135, rim: 0.35 },
      { dir: norm3(-0.72, 0.36, -0.58), radius: 0.38, depth: 0.085, rim: 0.32 },
    ],
    texCraterCount: 120,
    craterMinRad: 0.022,
    craterMaxRad: 0.16,
    craterDepthScale: 0.38,
    baseColor: [0.58, 0.54, 0.49],
    highColor: [0.74, 0.7, 0.64],
    lowColor: [0.35, 0.32, 0.29],
    macroFreq: 3.0,
    detailFreq: 14.0,
    ridgeMix: 0.52,
    noiseContrast: 0.52,
    microRoughness: 0.36,
    normalStrength: 1.95,
    baseGloss: 0.06,
    baseImageMix: 0.2,
  },
  Hygiea: {
    id: 'Hygiea',
    seed: 1006,
    customShape: true,
    scaleXYZ: [1.03, 0.96, 1.0],
    roughness: 0.032,
    facetStrength: 0.02,
    geoCraterCount: 16,
    specialCraters: [
      { dir: norm3(0.55, 0.45, 0.7), radius: 0.26, depth: 0.048, rim: 0.28 },
      { dir: norm3(-0.68, -0.22, -0.7), radius: 0.24, depth: 0.042, rim: 0.26 },
    ],
    texCraterCount: 130,
    craterMinRad: 0.018,
    craterMaxRad: 0.13,
    craterDepthScale: 0.3,
    baseColor: [0.34, 0.33, 0.32],
    highColor: [0.47, 0.46, 0.44],
    lowColor: [0.2, 0.19, 0.19],
    macroFreq: 3.2,
    detailFreq: 14.5,
    ridgeMix: 0.34,
    noiseContrast: 0.4,
    microRoughness: 0.32,
    normalStrength: 1.55,
    baseGloss: 0.03,
    baseImageMix: 0.22,
  },
  Haumea: {
    id: 'Haumea',
    seed: 1007,
    customShape: false, // Ellipsoid scaling is applied on p.mesh.scale
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      { dir: norm3(-0.62, 0.28, 0.73), radius: 0.18, depth: 0.22, rim: 0.25 },
    ],
    texCraterCount: 65,
    craterMinRad: 0.02,
    craterMaxRad: 0.11,
    craterDepthScale: 0.22,
    baseColor: [0.85, 0.88, 0.91],
    highColor: [0.96, 0.98, 1.0],
    lowColor: [0.68, 0.72, 0.78],
    macroFreq: 2.6,
    detailFreq: 11.0,
    ridgeMix: 0.32,
    noiseContrast: 0.34,
    microRoughness: 0.16,
    normalStrength: 1.15,
    baseGloss: 0.42,
    iceGlossBoost: 0.35,
    patches: [
      // Famous Dark Red Spot on Haumea (mineral-rich impact scar)
      {
        dir: norm3(0.76, 0.18, 0.62),
        radius: 0.48,
        softness: 0.55,
        color: [0.56, 0.31, 0.26],
        height: -0.14,
        gloss: 0.08,
        noiseMix: 0.45,
      },
      {
        dir: norm3(0.84, 0.06, 0.54),
        radius: 0.24,
        softness: 0.5,
        color: [0.44, 0.22, 0.19],
        height: -0.2,
        gloss: 0.05,
        noiseMix: 0.35,
      },
    ],
    lineae: makeLineaeSet(701, 5, [0.008, 0.016], [0.1, 0.18], [0.76, 0.82, 0.9]),
    baseImageMix: 0.35,
  },
  Makemake: {
    id: 'Makemake',
    seed: 1008,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      { dir: norm3(0.54, 0.36, 0.76), radius: 0.17, depth: 0.26, rim: 0.28 },
      { dir: norm3(-0.7, -0.32, 0.63), radius: 0.15, depth: 0.24, rim: 0.24 },
    ],
    texCraterCount: 75,
    craterMinRad: 0.02,
    craterMaxRad: 0.12,
    craterDepthScale: 0.25,
    baseColor: [0.72, 0.48, 0.38],
    highColor: [0.89, 0.73, 0.62],
    lowColor: [0.46, 0.26, 0.2],
    macroFreq: 2.5,
    detailFreq: 10.5,
    ridgeMix: 0.35,
    noiseContrast: 0.5,
    microRoughness: 0.2,
    normalStrength: 1.25,
    baseGloss: 0.16,
    iceGlossBoost: 0.25,
    patches: [
      // Methane frost bright plains
      { dir: norm3(-0.35, 0.62, 0.7), radius: 0.45, softness: 0.65, color: [0.88, 0.78, 0.7], gloss: 0.36, noiseMix: 0.55 },
      { dir: norm3(0.45, -0.58, -0.68), radius: 0.42, softness: 0.65, color: [0.85, 0.72, 0.64], gloss: 0.32, noiseMix: 0.5 },
    ],
    baseImageMix: 0.42,
  },
  Eris: {
    id: 'Eris',
    seed: 1009,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.008,
    geoCraterCount: 0,
    specialCraters: [
      { dir: norm3(0.42, -0.38, 0.82), radius: 0.16, depth: 0.22, rim: 0.24 },
    ],
    texCraterCount: 60,
    craterMinRad: 0.02,
    craterMaxRad: 0.11,
    craterDepthScale: 0.2,
    baseColor: [0.86, 0.88, 0.9],
    highColor: [0.97, 0.98, 1.0],
    lowColor: [0.7, 0.73, 0.77],
    macroFreq: 2.4,
    detailFreq: 10.0,
    ridgeMix: 0.28,
    noiseContrast: 0.32,
    microRoughness: 0.16,
    normalStrength: 1.05,
    baseGloss: 0.36,
    iceGlossBoost: 0.32,
    patches: [
      { dir: norm3(-0.5, 0.42, 0.75), radius: 0.55, softness: 0.7, color: [0.95, 0.96, 0.99], gloss: 0.52, noiseMix: 0.45 },
      { dir: norm3(0.65, -0.25, -0.71), radius: 0.46, softness: 0.65, color: [0.76, 0.74, 0.74], gloss: 0.22, noiseMix: 0.5 },
    ],
    baseImageMix: 0.4,
  },

  // ======================= MARS MOONS =======================
  Phobos: {
    id: 'Phobos',
    seed: 2001,
    customShape: true,
    scaleXYZ: [1.24, 0.86, 1.0],
    roughness: 0.088,
    facetStrength: 0.055,
    grooves: { axis: norm3(0.45, 0.72, -0.52), freq: 34, depth: 0.018, latBand: [-0.82, 0.82] },
    geoCraterCount: 14,
    specialCraters: [
      // Stickney Crater (iconic giant crater facing Mars!)
      { dir: norm3(0.84, 0.08, 0.53), radius: 0.6, depth: 0.185, rim: 0.42, floorTint: [0.58, 0.52, 0.48] },
      // Limtoc inside Stickney
      { dir: norm3(0.86, -0.08, 0.49), radius: 0.17, depth: 0.045, rim: 0.34 },
      // Hall crater near south pole
      { dir: norm3(-0.18, -0.88, 0.44), radius: 0.28, depth: 0.068, rim: 0.32 },
      // Roche crater near north pole
      { dir: norm3(0.12, 0.92, -0.36), radius: 0.22, depth: 0.052, rim: 0.3 },
    ],
    texCraterCount: 150,
    craterMinRad: 0.016,
    craterMaxRad: 0.14,
    craterDepthScale: 0.38,
    baseColor: [0.5, 0.44, 0.39],
    highColor: [0.66, 0.6, 0.54],
    lowColor: [0.28, 0.24, 0.21],
    macroFreq: 3.2,
    detailFreq: 14.5,
    ridgeMix: 0.45,
    noiseContrast: 0.46,
    microRoughness: 0.36,
    normalStrength: 1.95,
    baseGloss: 0.03,
    patches: [
      // Blue-ish fresher ejecta unit around Stickney rim
      { dir: norm3(0.8, 0.28, 0.53), radius: 0.32, softness: 0.6, color: [0.58, 0.59, 0.62], noiseMix: 0.5 },
    ],
  },
  Deimos: {
    id: 'Deimos',
    seed: 2002,
    customShape: true,
    scaleXYZ: [1.26, 0.87, 0.95],
    roughness: 0.064,
    facetStrength: 0.04,
    geoCraterCount: 9,
    specialCraters: [
      { dir: norm3(0.45, -0.62, 0.64), radius: 0.34, depth: 0.065, rim: 0.22 }, // Voltaire / Swift
      { dir: norm3(-0.7, 0.24, -0.66), radius: 0.26, depth: 0.048, rim: 0.2 },
    ],
    texCraterCount: 85,
    craterMinRad: 0.018,
    craterMaxRad: 0.13,
    craterDepthScale: 0.24, // Regolith-blanketed softer craters
    baseColor: [0.56, 0.5, 0.44],
    highColor: [0.7, 0.64, 0.58],
    lowColor: [0.36, 0.31, 0.27],
    macroFreq: 2.6,
    detailFreq: 12.0,
    ridgeMix: 0.26,
    noiseContrast: 0.38,
    microRoughness: 0.24,
    normalStrength: 1.35,
    baseGloss: 0.03,
  },

  // ======================= JUPITER MOONS =======================
  Io: {
    id: 'Io',
    seed: 3001,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.008,
    geoCraterCount: 0,
    specialCraters: [], // Io has virtually NO impact craters — only volcanic paterae!
    texCraterCount: 0,
    craterMinRad: 0.02,
    craterMaxRad: 0.06,
    craterDepthScale: 0.15,
    baseColor: [0.89, 0.78, 0.36],
    highColor: [0.97, 0.94, 0.76], // SO2 white/pale-yellow frost
    lowColor: [0.72, 0.42, 0.14], // Orange/rust sulfur plains
    accentColor: [0.68, 0.64, 0.22], // Olive-yellow sulfur
    macroFreq: 3.1,
    detailFreq: 12.0,
    ridgeMix: 0.32,
    noiseContrast: 0.65,
    microRoughness: 0.22,
    normalStrength: 1.35,
    baseGloss: 0.08,
    ioVolcanism: true,
  },
  Europa: {
    id: 'Europa',
    seed: 3002,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.004,
    geoCraterCount: 0,
    specialCraters: [
      // Pwyll bright-rayed young crater
      { dir: norm3(0.55, -0.44, 0.71), radius: 0.075, depth: 0.22, rim: 0.3, floorTint: [0.96, 0.98, 1.0], rays: 0.9 },
      // Tyre multi-ring impact structure
      { dir: norm3(-0.62, 0.56, -0.55), radius: 0.12, depth: 0.16, rim: 0.2, rings: 3 },
    ],
    texCraterCount: 16, // Very young resurfaced ice shell
    craterMinRad: 0.015,
    craterMaxRad: 0.055,
    craterDepthScale: 0.16,
    brightRayFraction: 0.25,
    baseColor: [0.87, 0.83, 0.77],
    highColor: [0.96, 0.95, 0.93],
    lowColor: [0.68, 0.56, 0.46],
    accentColor: [0.58, 0.35, 0.23], // Hydrated salt/sulfuric acid reddish-brown cracks
    macroFreq: 2.5,
    detailFreq: 11.5,
    ridgeMix: 0.22,
    noiseContrast: 0.34,
    microRoughness: 0.12,
    normalStrength: 1.45,
    baseGloss: 0.55,
    iceGlossBoost: 0.35,
    europaChaos: true,
    lineae: [
      ...makeLineaeSet(3021, 26, [0.006, 0.016], [0.18, 0.34], [0.56, 0.34, 0.22], true),
      ...makeLineaeSet(3029, 20, [0.003, 0.008], [0.1, 0.22], [0.64, 0.45, 0.33], true),
    ],
  },
  Ganymede: {
    id: 'Ganymede',
    seed: 3003,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.008,
    geoCraterCount: 0,
    specialCraters: [
      // Osiris bright ray crater
      { dir: norm3(0.45, -0.62, 0.64), radius: 0.1, depth: 0.28, rim: 0.34, floorTint: [0.94, 0.96, 0.98], rays: 0.85 },
      // Tros bright ray crater
      { dir: norm3(-0.78, 0.18, 0.6), radius: 0.09, depth: 0.26, rim: 0.34, floorTint: [0.92, 0.95, 0.98], rays: 0.78 },
      // Phocis / Kittu
      { dir: norm3(0.62, 0.36, -0.7), radius: 0.11, depth: 0.26, rim: 0.3, floorTint: [0.84, 0.86, 0.88], rays: 0.55 },
    ],
    texCraterCount: 115,
    craterMinRad: 0.016,
    craterMaxRad: 0.11,
    craterDepthScale: 0.3,
    brightCraterFloor: 0.32,
    brightRayFraction: 0.14,
    baseColor: [0.64, 0.6, 0.56],
    highColor: [0.85, 0.83, 0.8], // Young grooved terrain (Sulci)
    lowColor: [0.35, 0.31, 0.28], // Ancient dark Galileo Regio
    macroFreq: 2.4,
    detailFreq: 12.0,
    ridgeMix: 0.45,
    noiseContrast: 0.65,
    microRoughness: 0.22,
    normalStrength: 1.55,
    baseGloss: 0.2,
    iceGlossBoost: 0.32,
    ganymedeSulci: true,
    patches: [
      // Galileo Regio dark ancient region
      { dir: norm3(0.55, 0.52, 0.65), radius: 0.58, softness: 0.42, color: [0.34, 0.3, 0.27], height: -0.08, gloss: 0.06, noiseMix: 0.48 },
      // Marius Regio
      { dir: norm3(-0.62, 0.14, -0.77), radius: 0.54, softness: 0.45, color: [0.36, 0.32, 0.28], height: -0.06, gloss: 0.06, noiseMix: 0.5 },
      // Polar frost hoods
      { dir: [0, 1, 0], radius: 0.68, softness: 0.5, color: [0.86, 0.88, 0.91], gloss: 0.38, noiseMix: 0.35 },
      { dir: [0, -1, 0], radius: 0.66, softness: 0.5, color: [0.85, 0.87, 0.9], gloss: 0.38, noiseMix: 0.35 },
    ],
  },
  Callisto: {
    id: 'Callisto',
    seed: 3004,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      // Valhalla giant multi-ring basin!
      {
        dir: norm3(0.76, 0.28, 0.58),
        radius: 0.22,
        depth: 0.22,
        rim: 0.32,
        floorTint: [0.82, 0.8, 0.74],
        rings: 5,
      },
      // Asgard multi-ring basin
      {
        dir: norm3(-0.46, 0.52, -0.72),
        radius: 0.16,
        depth: 0.2,
        rim: 0.28,
        floorTint: [0.78, 0.77, 0.72],
        rings: 4,
      },
      // Burr & Lofn bright ice craters
      { dir: norm3(-0.64, -0.42, 0.64), radius: 0.08, depth: 0.26, rim: 0.35, floorTint: [0.95, 0.96, 0.98], rays: 0.7 },
    ],
    texCraterCount: 220, // Most heavily cratered body in the Solar System!
    craterMinRad: 0.012,
    craterMaxRad: 0.095,
    craterDepthScale: 0.34,
    brightCraterFloor: 0.55, // Iconic glittery bright ice pits on dark surface
    brightRayFraction: 0.16,
    baseColor: [0.36, 0.33, 0.29],
    highColor: [0.52, 0.48, 0.43],
    lowColor: [0.22, 0.2, 0.18],
    macroFreq: 3.0,
    detailFreq: 14.0,
    ridgeMix: 0.3,
    noiseContrast: 0.42,
    microRoughness: 0.28,
    normalStrength: 1.75,
    baseGloss: 0.08,
    iceGlossBoost: 0.45,
  },
  Amalthea: {
    id: 'Amalthea',
    seed: 3005,
    customShape: true,
    scaleXYZ: [1.46, 0.78, 0.88],
    roughness: 0.1,
    facetStrength: 0.07,
    geoCraterCount: 14,
    specialCraters: [
      { dir: norm3(0.65, 0.42, 0.63), radius: 0.52, depth: 0.16, rim: 0.38 }, // Pan crater
      { dir: norm3(-0.35, -0.82, 0.45), radius: 0.48, depth: 0.15, rim: 0.36 }, // Gaea crater
    ],
    texCraterCount: 110,
    craterMinRad: 0.02,
    craterMaxRad: 0.16,
    craterDepthScale: 0.4,
    baseColor: [0.58, 0.3, 0.22], // Reddest object in the Solar System (Io sulfur dust)
    highColor: [0.76, 0.48, 0.34],
    lowColor: [0.32, 0.14, 0.11],
    macroFreq: 3.1,
    detailFreq: 13.5,
    ridgeMix: 0.48,
    noiseContrast: 0.55,
    microRoughness: 0.34,
    normalStrength: 1.85,
    baseGloss: 0.04,
    patches: [
      // Bright greenish-yellow slope patches (Ida & Lyctos Faculae)
      { dir: norm3(0.42, 0.2, 0.88), radius: 0.22, softness: 0.55, color: [0.78, 0.74, 0.55], noiseMix: 0.4 },
    ],
  },

  // ======================= SATURN MOONS =======================
  Titan: {
    id: 'Titan',
    seed: 4001,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.002,
    geoCraterCount: 0,
    specialCraters: [],
    texCraterCount: 0,
    craterMinRad: 0.01,
    craterMaxRad: 0.02,
    craterDepthScale: 0,
    baseColor: [0.85, 0.62, 0.28],
    highColor: [0.95, 0.78, 0.44],
    lowColor: [0.64, 0.42, 0.16],
    accentColor: [0.42, 0.38, 0.32], // Polar vortex hood
    macroFreq: 2.2,
    detailFreq: 7.5,
    ridgeMix: 0.12,
    noiseContrast: 0.25,
    microRoughness: 0.04,
    normalStrength: 0.22,
    baseGloss: 0.08,
    titanBands: true,
  },
  Enceladus: {
    id: 'Enceladus',
    seed: 4002,
    customShape: false,
    scaleXYZ: [1.02, 0.98, 1.0],
    roughness: 0.005,
    geoCraterCount: 0,
    specialCraters: [
      { dir: norm3(0.42, 0.58, 0.69), radius: 0.12, depth: 0.24, rim: 0.28 }, // Ali Baba
      { dir: norm3(0.28, 0.72, 0.63), radius: 0.11, depth: 0.22, rim: 0.26 }, // Aladdin
    ],
    texCraterCount: 55, // Mostly northern/equatorial craters; south pole is fresh!
    craterMinRad: 0.016,
    craterMaxRad: 0.095,
    craterDepthScale: 0.22,
    baseColor: [0.91, 0.94, 0.97],
    highColor: [0.98, 0.99, 1.0],
    lowColor: [0.76, 0.83, 0.9],
    accentColor: [0.44, 0.72, 0.89], // Blue-cyan Tiger Stripes!
    macroFreq: 2.6,
    detailFreq: 11.5,
    ridgeMix: 0.34,
    noiseContrast: 0.26,
    microRoughness: 0.12,
    normalStrength: 1.35,
    baseGloss: 0.62,
    iceGlossBoost: 0.34,
    enceladusStripes: true,
    lineae: makeLineaeSet(4021, 10, [0.006, 0.013], [0.12, 0.22], [0.78, 0.86, 0.94], true),
  },
  Mimas: {
    id: 'Mimas',
    seed: 4003,
    customShape: true,
    scaleXYZ: [1.04, 0.97, 0.99],
    roughness: 0.016,
    geoCraterCount: 16,
    specialCraters: [
      // Iconic "Death Star" Herschel Crater — 1/3 the diameter of Mimas!
      {
        dir: norm3(0.91, 0.06, 0.41),
        radius: 0.44,
        depth: 0.115,
        peak: 0.044,
        rim: 0.46,
        floorTint: [0.74, 0.77, 0.8],
      },
      { dir: norm3(-0.62, 0.48, -0.62), radius: 0.19, depth: 0.042, rim: 0.32 },
      { dir: norm3(-0.42, -0.65, 0.63), radius: 0.17, depth: 0.036, rim: 0.3 },
    ],
    texCraterCount: 165,
    craterMinRad: 0.016,
    craterMaxRad: 0.13,
    craterDepthScale: 0.36,
    baseColor: [0.74, 0.76, 0.79],
    highColor: [0.87, 0.89, 0.92],
    lowColor: [0.54, 0.56, 0.6],
    macroFreq: 3.0,
    detailFreq: 13.5,
    ridgeMix: 0.28,
    noiseContrast: 0.3,
    microRoughness: 0.24,
    normalStrength: 1.75,
    baseGloss: 0.24,
    iceGlossBoost: 0.22,
  },
  Iapetus: {
    id: 'Iapetus',
    seed: 4004,
    customShape: true,
    scaleXYZ: [1.03, 0.96, 1.01],
    roughness: 0.018,
    // Iconic 20km-high equatorial walnut ridge!
    equatorialRidge: { height: 0.052, width: 0.085, tint: [0.24, 0.18, 0.15] },
    geoCraterCount: 14,
    specialCraters: [
      // Turgis mega-basin (580km across) in the dark Cassini Regio
      { dir: norm3(0.68, 0.32, 0.66), radius: 0.36, depth: 0.072, rim: 0.35 },
      // Engelier basin in the bright south
      { dir: norm3(-0.55, -0.64, -0.53), radius: 0.34, depth: 0.068, rim: 0.34 },
      // Falsaron basin
      { dir: norm3(0.74, 0.52, -0.42), radius: 0.28, depth: 0.054, rim: 0.3 },
    ],
    texCraterCount: 150,
    craterMinRad: 0.016,
    craterMaxRad: 0.13,
    craterDepthScale: 0.34,
    baseColor: [0.84, 0.83, 0.8],
    highColor: [0.94, 0.94, 0.93],
    lowColor: [0.16, 0.12, 0.1], // Pitch-dark Cassini Regio leading hemisphere
    macroFreq: 2.8,
    detailFreq: 12.5,
    ridgeMix: 0.34,
    noiseContrast: 0.42,
    microRoughness: 0.24,
    normalStrength: 1.7,
    baseGloss: 0.18,
    iceGlossBoost: 0.36,
    iapetusDichotomy: true,
  },
  Tethys: {
    id: 'Tethys',
    seed: 4005,
    customShape: true,
    scaleXYZ: [1.02, 0.98, 1.0],
    roughness: 0.012,
    geoCraterCount: 12,
    specialCraters: [
      // Odysseus giant 450km crater
      { dir: norm3(0.7, 0.54, 0.46), radius: 0.42, depth: 0.074, peak: 0.022, rim: 0.36 },
      { dir: norm3(-0.55, -0.25, 0.8), radius: 0.2, depth: 0.036, rim: 0.28 },
    ],
    texCraterCount: 140,
    craterMinRad: 0.016,
    craterMaxRad: 0.12,
    craterDepthScale: 0.3,
    baseColor: [0.85, 0.87, 0.9],
    highColor: [0.95, 0.96, 0.98],
    lowColor: [0.66, 0.69, 0.74],
    macroFreq: 2.8,
    detailFreq: 12.5,
    ridgeMix: 0.3,
    noiseContrast: 0.28,
    microRoughness: 0.18,
    normalStrength: 1.55,
    baseGloss: 0.34,
    iceGlossBoost: 0.28,
    // Ithaca Chasma — giant canyon spanning 3/4 of Tethys circumference
    lineae: [
      {
        normal: norm3(0.95, 0.14, -0.28),
        width: 0.048,
        depth: 0.55,
        color: [0.64, 0.68, 0.74],
        doubleRidge: false,
        arcCenter: norm3(-0.2, -0.1, -0.97),
        arcLimit: -0.45,
        wobble: 0.035,
        seed: 4055,
      },
      ...makeLineaeSet(4059, 6, [0.008, 0.016], [0.14, 0.24], [0.74, 0.78, 0.84]),
    ],
  },
  Dione: {
    id: 'Dione',
    seed: 4006,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      { dir: norm3(0.68, -0.24, 0.69), radius: 0.16, depth: 0.28, rim: 0.32, floorTint: [0.88, 0.9, 0.93] },
      { dir: norm3(-0.45, 0.42, 0.78), radius: 0.15, depth: 0.26, rim: 0.3 },
    ],
    texCraterCount: 135,
    craterMinRad: 0.016,
    craterMaxRad: 0.11,
    craterDepthScale: 0.3,
    brightCraterFloor: 0.22,
    baseColor: [0.79, 0.81, 0.84],
    highColor: [0.94, 0.96, 0.98],
    lowColor: [0.46, 0.48, 0.52], // Darker trailing hemisphere
    macroFreq: 2.6,
    detailFreq: 12.5,
    ridgeMix: 0.34,
    noiseContrast: 0.38,
    microRoughness: 0.2,
    normalStrength: 1.55,
    baseGloss: 0.3,
    iceGlossBoost: 0.32,
    patches: [
      // Darker trailing hemisphere backdrop for bright wispy ice cliffs
      { dir: norm3(-0.88, 0.05, -0.47), radius: 1.15, softness: 0.6, color: [0.48, 0.5, 0.54], gloss: 0.15, noiseMix: 0.4 },
    ],
    // Bright braided ice cliffs (Eurotas / Padua Chasmata wispy terrain)
    lineae: makeLineaeSet(4061, 18, [0.008, 0.022], [0.22, 0.38], [0.95, 0.97, 1.0], true),
  },
  Rhea: {
    id: 'Rhea',
    seed: 4007,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      // Tirawa & Mamaldi ancient basins + Inktomi bright rayed young crater
      { dir: norm3(0.65, 0.52, 0.55), radius: 0.22, depth: 0.3, rim: 0.34 },
      { dir: norm3(-0.74, -0.22, 0.63), radius: 0.09, depth: 0.26, rim: 0.35, floorTint: [0.97, 0.98, 1.0], rays: 0.88 },
    ],
    texCraterCount: 175,
    craterMinRad: 0.015,
    craterMaxRad: 0.12,
    craterDepthScale: 0.34,
    brightCraterFloor: 0.25,
    brightRayFraction: 0.12,
    baseColor: [0.78, 0.8, 0.82],
    highColor: [0.92, 0.94, 0.96],
    lowColor: [0.54, 0.56, 0.59],
    macroFreq: 2.9,
    detailFreq: 13.0,
    ridgeMix: 0.3,
    noiseContrast: 0.34,
    microRoughness: 0.22,
    normalStrength: 1.65,
    baseGloss: 0.26,
    iceGlossBoost: 0.28,
    lineae: makeLineaeSet(4071, 10, [0.006, 0.015], [0.16, 0.28], [0.94, 0.96, 0.99], true),
  },
  Hyperion: {
    id: 'Hyperion',
    seed: 4008,
    customShape: true,
    scaleXYZ: [1.38, 0.74, 1.02],
    roughness: 0.11,
    facetStrength: 0.06,
    geoCraterCount: 44, // Iconic sponge-like honeycomb deep craters!
    specialCraters: [
      { dir: norm3(0.75, 0.12, 0.65), radius: 0.44, depth: 0.165, rim: 0.45 },
      { dir: norm3(-0.62, -0.35, 0.7), radius: 0.38, depth: 0.145, rim: 0.42 },
      { dir: norm3(-0.35, 0.78, -0.52), radius: 0.34, depth: 0.13, rim: 0.4 },
    ],
    texCraterCount: 190,
    craterMinRad: 0.022,
    craterMaxRad: 0.16,
    craterDepthScale: 0.55,
    darkCraterFloor: 0.6, // Dark organic material pooled inside sponge pores
    baseColor: [0.7, 0.64, 0.56],
    highColor: [0.85, 0.8, 0.72],
    lowColor: [0.28, 0.23, 0.19],
    macroFreq: 3.8,
    detailFreq: 15.0,
    ridgeMix: 0.62,
    noiseContrast: 0.55,
    microRoughness: 0.38,
    normalStrength: 2.1,
    baseGloss: 0.06,
  },
  Phoebe: {
    id: 'Phoebe',
    seed: 4009,
    customShape: true,
    scaleXYZ: [1.06, 0.94, 1.02],
    roughness: 0.055,
    facetStrength: 0.04,
    geoCraterCount: 22,
    specialCraters: [
      // Jason crater (101km wide)
      { dir: norm3(0.78, 0.28, 0.55), radius: 0.46, depth: 0.12, rim: 0.38, floorTint: [0.46, 0.48, 0.52] },
      { dir: norm3(-0.64, -0.42, -0.64), radius: 0.32, depth: 0.08, rim: 0.32, floorTint: [0.54, 0.56, 0.6] },
    ],
    texCraterCount: 155,
    craterMinRad: 0.018,
    craterMaxRad: 0.14,
    craterDepthScale: 0.38,
    brightCraterFloor: 0.22, // Exposed subsurface water ice streaks in crater walls
    baseColor: [0.24, 0.23, 0.23],
    highColor: [0.39, 0.39, 0.41],
    lowColor: [0.13, 0.13, 0.14],
    macroFreq: 3.3,
    detailFreq: 14.5,
    ridgeMix: 0.42,
    noiseContrast: 0.46,
    microRoughness: 0.34,
    normalStrength: 1.85,
    baseGloss: 0.05,
  },
  Pan: {
    id: 'Pan',
    seed: 4010,
    customShape: true,
    scaleXYZ: [1.18, 0.62, 1.14],
    roughness: 0.024,
    equatorialRidge: { height: 0.22, width: 0.2, tint: [0.84, 0.83, 0.8] }, // Ravioli / flying saucer skirt!
    geoCraterCount: 6,
    specialCraters: [],
    texCraterCount: 45,
    craterMinRad: 0.025,
    craterMaxRad: 0.11,
    craterDepthScale: 0.2,
    baseColor: [0.8, 0.78, 0.75],
    highColor: [0.9, 0.89, 0.87],
    lowColor: [0.64, 0.62, 0.59],
    macroFreq: 2.5,
    detailFreq: 11.0,
    ridgeMix: 0.24,
    noiseContrast: 0.25,
    microRoughness: 0.18,
    normalStrength: 1.2,
    baseGloss: 0.22,
  },
  Janus: {
    id: 'Janus',
    seed: 4011,
    customShape: true,
    scaleXYZ: [1.14, 0.86, 1.03],
    roughness: 0.068,
    facetStrength: 0.05,
    geoCraterCount: 18,
    specialCraters: [
      { dir: norm3(0.6, 0.35, 0.72), radius: 0.34, depth: 0.08, rim: 0.32 },
    ],
    texCraterCount: 120,
    craterMinRad: 0.02,
    craterMaxRad: 0.15,
    craterDepthScale: 0.34,
    baseColor: [0.76, 0.76, 0.78],
    highColor: [0.88, 0.89, 0.91],
    lowColor: [0.56, 0.57, 0.6],
    macroFreq: 3.1,
    detailFreq: 13.0,
    ridgeMix: 0.36,
    noiseContrast: 0.36,
    microRoughness: 0.24,
    normalStrength: 1.6,
    baseGloss: 0.22,
  },

  // ======================= URANUS MOONS =======================
  Miranda: {
    id: 'Miranda',
    seed: 5001,
    customShape: true,
    scaleXYZ: [1.03, 0.98, 1.0],
    roughness: 0.024,
    geoCraterCount: 12,
    specialCraters: [
      { dir: norm3(0.24, 0.64, 0.73), radius: 0.18, depth: 0.036, rim: 0.3 },
    ],
    texCraterCount: 95,
    craterMinRad: 0.016,
    craterMaxRad: 0.11,
    craterDepthScale: 0.3,
    baseColor: [0.68, 0.7, 0.72],
    highColor: [0.86, 0.88, 0.91],
    lowColor: [0.44, 0.46, 0.49],
    macroFreq: 3.0,
    detailFreq: 13.0,
    ridgeMix: 0.46,
    noiseContrast: 0.45,
    microRoughness: 0.24,
    normalStrength: 1.8,
    baseGloss: 0.22,
    iceGlossBoost: 0.24,
    // Iconic chevron & ovoid Coronae (Inverness, Arden, Elsinore)
    coronae: [
      { dir: norm3(0.22, -0.78, 0.58), radius: 0.52, freq: 34, tint: [0.88, 0.9, 0.93] }, // Inverness chevron
      { dir: norm3(0.84, -0.18, -0.51), radius: 0.58, freq: 28, tint: [0.56, 0.59, 0.63] }, // Arden Corona
      { dir: norm3(-0.78, -0.22, 0.58), radius: 0.54, freq: 30, tint: [0.6, 0.63, 0.67] }, // Elsinore Corona
    ],
    // Verona Rupes — tallest known cliff in the Solar System (20km high!)
    lineae: [
      {
        normal: norm3(0.62, 0.42, 0.66),
        width: 0.038,
        depth: 0.62,
        color: [0.46, 0.5, 0.56],
        arcCenter: norm3(-0.7, 0.4, 0.58),
        arcLimit: 0.15,
        wobble: 0.03,
        seed: 5012,
      },
      ...makeLineaeSet(5015, 8, [0.008, 0.018], [0.22, 0.36], [0.52, 0.56, 0.6]),
    ],
  },
  Ariel: {
    id: 'Ariel',
    seed: 5002,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      { dir: norm3(0.45, 0.52, 0.72), radius: 0.11, depth: 0.24, rim: 0.32, floorTint: [0.93, 0.96, 0.99], rays: 0.6 },
    ],
    texCraterCount: 95,
    craterMinRad: 0.015,
    craterMaxRad: 0.095,
    craterDepthScale: 0.28,
    brightCraterFloor: 0.28,
    baseColor: [0.78, 0.81, 0.84],
    highColor: [0.92, 0.95, 0.98],
    lowColor: [0.56, 0.6, 0.64],
    macroFreq: 2.8,
    detailFreq: 12.0,
    ridgeMix: 0.38,
    noiseContrast: 0.36,
    microRoughness: 0.2,
    normalStrength: 1.65,
    baseGloss: 0.3,
    iceGlossBoost: 0.3,
    // Broad tectonic graben canyons (Kachina & Kewpie Chasmata)
    lineae: makeLineaeSet(5021, 16, [0.014, 0.032], [0.28, 0.48], [0.64, 0.69, 0.75], true),
  },
  Umbriel: {
    id: 'Umbriel',
    seed: 5003,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      // Wunda Crater — famous solitary bright white ring on the darkest Uranian moon!
      {
        dir: norm3(0.84, -0.1, 0.53),
        radius: 0.14,
        depth: 0.28,
        rim: 0.38,
        floorTint: [0.9, 0.93, 0.96],
      },
      { dir: norm3(-0.6, 0.42, 0.68), radius: 0.16, depth: 0.28, rim: 0.3 },
    ],
    texCraterCount: 165,
    craterMinRad: 0.016,
    craterMaxRad: 0.12,
    craterDepthScale: 0.34,
    baseColor: [0.33, 0.34, 0.36],
    highColor: [0.46, 0.47, 0.5],
    lowColor: [0.2, 0.21, 0.23],
    macroFreq: 3.1,
    detailFreq: 13.5,
    ridgeMix: 0.3,
    noiseContrast: 0.34,
    microRoughness: 0.28,
    normalStrength: 1.65,
    baseGloss: 0.08,
    patches: [
      { dir: norm3(0.84, -0.1, 0.53), radius: 0.095, softness: 0.35, color: [0.89, 0.92, 0.96], gloss: 0.45 },
    ],
  },
  Titania: {
    id: 'Titania',
    seed: 5004,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      // Gertrude mega-crater (326km)
      { dir: norm3(0.54, -0.28, 0.79), radius: 0.2, depth: 0.3, rim: 0.34 },
      { dir: norm3(-0.68, 0.42, -0.6), radius: 0.14, depth: 0.26, rim: 0.3, floorTint: [0.86, 0.85, 0.84], rays: 0.45 },
    ],
    texCraterCount: 145,
    craterMinRad: 0.015,
    craterMaxRad: 0.11,
    craterDepthScale: 0.32,
    brightCraterFloor: 0.18,
    baseColor: [0.68, 0.67, 0.66],
    highColor: [0.83, 0.82, 0.81],
    lowColor: [0.47, 0.45, 0.45],
    macroFreq: 2.9,
    detailFreq: 13.0,
    ridgeMix: 0.36,
    noiseContrast: 0.36,
    microRoughness: 0.22,
    normalStrength: 1.6,
    baseGloss: 0.2,
    // Messina Chasma — 1,500km fault canyon
    lineae: [
      {
        normal: norm3(0.45, 0.82, -0.35),
        width: 0.032,
        depth: 0.52,
        color: [0.54, 0.53, 0.54],
        doubleRidge: true,
        arcCenter: norm3(0.76, -0.2, 0.62),
        arcLimit: -0.1,
        wobble: 0.032,
        seed: 5044,
      },
      ...makeLineaeSet(5047, 9, [0.009, 0.018], [0.2, 0.34], [0.6, 0.59, 0.6], true),
    ],
  },
  Oberon: {
    id: 'Oberon',
    seed: 5005,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      // Hamlet crater with dark carbon-rich floor + bright icy rays!
      {
        dir: norm3(0.62, -0.45, 0.64),
        radius: 0.18,
        depth: 0.32,
        rim: 0.36,
        floorTint: [0.24, 0.22, 0.21],
        rays: 0.72,
      },
      {
        dir: norm3(-0.52, 0.38, -0.76),
        radius: 0.15,
        depth: 0.28,
        rim: 0.34,
        floorTint: [0.26, 0.24, 0.23],
        rays: 0.55,
      },
    ],
    texCraterCount: 175,
    craterMinRad: 0.015,
    craterMaxRad: 0.12,
    craterDepthScale: 0.34,
    darkCraterFloor: 0.26,
    brightRayFraction: 0.14,
    baseColor: [0.58, 0.54, 0.52],
    highColor: [0.76, 0.73, 0.7],
    lowColor: [0.35, 0.32, 0.31],
    macroFreq: 3.0,
    detailFreq: 13.5,
    ridgeMix: 0.32,
    noiseContrast: 0.38,
    microRoughness: 0.26,
    normalStrength: 1.7,
    baseGloss: 0.14,
  },

  // ======================= NEPTUNE MOONS =======================
  Triton: {
    id: 'Triton',
    seed: 6001,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.006,
    geoCraterCount: 0,
    specialCraters: [
      { dir: norm3(0.42, 0.35, 0.84), radius: 0.07, depth: 0.2, rim: 0.25 },
    ],
    texCraterCount: 24, // Very young geologically active cryovolcanic surface
    craterMinRad: 0.014,
    craterMaxRad: 0.055,
    craterDepthScale: 0.18,
    baseColor: [0.78, 0.75, 0.73],
    highColor: [0.94, 0.88, 0.85], // Pinkish-cream nitrogen south polar cap
    lowColor: [0.56, 0.57, 0.56], // Grey-greenish cantaloupe terrain
    accentColor: [0.3, 0.28, 0.29], // Dark nitrogen geyser wind streaks
    macroFreq: 2.8,
    detailFreq: 12.0,
    ridgeMix: 0.36,
    noiseContrast: 0.42,
    microRoughness: 0.18,
    normalStrength: 1.5,
    baseGloss: 0.32,
    iceGlossBoost: 0.34,
    tritonCantaloupe: true,
    lineae: makeLineaeSet(6011, 12, [0.007, 0.015], [0.16, 0.28], [0.68, 0.66, 0.65], true),
  },
  Proteus: {
    id: 'Proteus',
    seed: 6002,
    customShape: true,
    scaleXYZ: [1.08, 0.94, 1.02],
    roughness: 0.064,
    facetStrength: 0.11, // Iconic boxy / polyhedral irregular moon!
    geoCraterCount: 16,
    specialCraters: [
      // Pharos Crater — massive 250km crater (more than half Proteus's diameter!)
      { dir: norm3(0.82, -0.18, 0.54), radius: 0.58, depth: 0.155, rim: 0.4 },
      { dir: norm3(-0.62, 0.52, -0.58), radius: 0.34, depth: 0.08, rim: 0.32 },
    ],
    texCraterCount: 145,
    craterMinRad: 0.018,
    craterMaxRad: 0.14,
    craterDepthScale: 0.38,
    baseColor: [0.34, 0.34, 0.35],
    highColor: [0.49, 0.49, 0.51],
    lowColor: [0.19, 0.19, 0.21],
    macroFreq: 3.3,
    detailFreq: 14.5,
    ridgeMix: 0.48,
    noiseContrast: 0.44,
    microRoughness: 0.34,
    normalStrength: 1.9,
    baseGloss: 0.04,
  },
  Nereid: {
    id: 'Nereid',
    seed: 6003,
    customShape: true,
    scaleXYZ: [1.14, 0.89, 0.98],
    roughness: 0.062,
    facetStrength: 0.06,
    geoCraterCount: 16,
    specialCraters: [
      { dir: norm3(-0.55, 0.45, 0.7), radius: 0.34, depth: 0.075, rim: 0.32 },
    ],
    texCraterCount: 125,
    craterMinRad: 0.018,
    craterMaxRad: 0.14,
    craterDepthScale: 0.34,
    baseColor: [0.54, 0.55, 0.57],
    highColor: [0.7, 0.72, 0.75],
    lowColor: [0.34, 0.35, 0.38],
    macroFreq: 3.1,
    detailFreq: 13.5,
    ridgeMix: 0.4,
    noiseContrast: 0.42,
    microRoughness: 0.3,
    normalStrength: 1.7,
    baseGloss: 0.12,
  },

  // ======================= PLUTO & KUIPER BELT MOONS =======================
  Charon: {
    id: 'Charon',
    seed: 7001,
    customShape: false,
    scaleXYZ: [1, 1, 1],
    roughness: 0.01,
    geoCraterCount: 0,
    specialCraters: [
      // Organa bright-rayed crater (ammonia ice!)
      { dir: norm3(0.64, 0.25, 0.72), radius: 0.08, depth: 0.26, rim: 0.34, floorTint: [0.92, 0.94, 0.96], rays: 0.65 },
      // Skywalker / Dorothy
      { dir: norm3(-0.58, 0.48, -0.65), radius: 0.17, depth: 0.28, rim: 0.32 },
    ],
    texCraterCount: 125,
    craterMinRad: 0.016,
    craterMaxRad: 0.11,
    craterDepthScale: 0.32,
    brightCraterFloor: 0.18,
    baseColor: [0.67, 0.65, 0.64],
    highColor: [0.82, 0.81, 0.8],
    lowColor: [0.46, 0.44, 0.43],
    macroFreq: 2.8,
    detailFreq: 13.0,
    ridgeMix: 0.38,
    noiseContrast: 0.38,
    microRoughness: 0.24,
    normalStrength: 1.65,
    baseGloss: 0.16,
    patches: [
      // Iconic Mordor Macula — dark reddish-brown tholin north polar cap!
      {
        dir: [0, 1, 0],
        radius: 0.68,
        softness: 0.45,
        color: [0.44, 0.24, 0.19],
        height: -0.05,
        gloss: 0.06,
        noiseMix: 0.48,
      },
      {
        dir: norm3(0.18, 0.96, 0.2),
        radius: 0.42,
        softness: 0.48,
        color: [0.33, 0.16, 0.13],
        height: -0.08,
        gloss: 0.04,
        noiseMix: 0.4,
      },
      // Vulcan Planitia smoother southern plain
      {
        dir: norm3(0.45, -0.45, 0.77),
        radius: 0.56,
        softness: 0.5,
        color: [0.7, 0.69, 0.68],
        height: -0.04,
        gloss: 0.22,
        noiseMix: 0.3,
      },
    ],
    // Serenity & Mandjet Chasma — massive equatorial tectonic canyon belt!
    lineae: [
      {
        normal: norm3(0.12, 0.98, 0.15),
        width: 0.044,
        depth: 0.6,
        color: [0.4, 0.38, 0.38],
        doubleRidge: true,
        arcCenter: norm3(0.75, -0.1, 0.65),
        arcLimit: -0.2,
        wobble: 0.045,
        seed: 7011,
      },
      ...makeLineaeSet(7015, 7, [0.008, 0.018], [0.18, 0.32], [0.5, 0.48, 0.48]),
    ],
  },
  Nix: {
    id: 'Nix',
    seed: 7002,
    customShape: true,
    scaleXYZ: [1.38, 0.78, 0.92],
    roughness: 0.08,
    facetStrength: 0.055,
    geoCraterCount: 12,
    specialCraters: [
      // Reddish-tinted impact crater observed by New Horizons
      { dir: norm3(0.62, 0.34, 0.71), radius: 0.36, depth: 0.09, rim: 0.34, floorTint: [0.72, 0.48, 0.4] },
    ],
    texCraterCount: 85,
    craterMinRad: 0.022,
    craterMaxRad: 0.15,
    craterDepthScale: 0.32,
    baseColor: [0.84, 0.85, 0.87],
    highColor: [0.95, 0.96, 0.98],
    lowColor: [0.64, 0.65, 0.68],
    macroFreq: 3.1,
    detailFreq: 13.0,
    ridgeMix: 0.36,
    noiseContrast: 0.34,
    microRoughness: 0.24,
    normalStrength: 1.55,
    baseGloss: 0.34,
    patches: [
      { dir: norm3(0.62, 0.34, 0.71), radius: 0.34, softness: 0.55, color: [0.74, 0.52, 0.44], noiseMix: 0.4 },
    ],
  },
  Hydra: {
    id: 'Hydra',
    seed: 7003,
    customShape: true,
    scaleXYZ: [1.44, 0.74, 0.88],
    bilobed: 0.24,
    roughness: 0.085,
    facetStrength: 0.06,
    geoCraterCount: 14,
    specialCraters: [
      { dir: norm3(-0.54, 0.42, 0.73), radius: 0.34, depth: 0.09, rim: 0.32 },
    ],
    texCraterCount: 90,
    craterMinRad: 0.022,
    craterMaxRad: 0.15,
    craterDepthScale: 0.32,
    baseColor: [0.88, 0.9, 0.93],
    highColor: [0.97, 0.98, 1.0],
    lowColor: [0.68, 0.7, 0.74],
    macroFreq: 3.2,
    detailFreq: 13.5,
    ridgeMix: 0.38,
    noiseContrast: 0.32,
    microRoughness: 0.22,
    normalStrength: 1.55,
    baseGloss: 0.42,
  },
  Kerberos: {
    id: 'Kerberos',
    seed: 7004,
    customShape: true,
    scaleXYZ: [1.48, 0.72, 0.84],
    bilobed: 0.42, // Double-lobed contact binary!
    roughness: 0.075,
    facetStrength: 0.05,
    geoCraterCount: 10,
    specialCraters: [],
    texCraterCount: 80,
    craterMinRad: 0.022,
    craterMaxRad: 0.15,
    craterDepthScale: 0.32,
    baseColor: [0.76, 0.77, 0.79],
    highColor: [0.89, 0.9, 0.92],
    lowColor: [0.56, 0.57, 0.6],
    macroFreq: 3.2,
    detailFreq: 13.5,
    ridgeMix: 0.36,
    noiseContrast: 0.34,
    microRoughness: 0.24,
    normalStrength: 1.55,
    baseGloss: 0.28,
  },
  Styx: {
    id: 'Styx',
    seed: 7005,
    customShape: true,
    scaleXYZ: [1.34, 0.76, 0.9],
    roughness: 0.085,
    facetStrength: 0.065,
    geoCraterCount: 10,
    specialCraters: [],
    texCraterCount: 75,
    craterMinRad: 0.024,
    craterMaxRad: 0.16,
    craterDepthScale: 0.32,
    baseColor: [0.8, 0.81, 0.84],
    highColor: [0.92, 0.93, 0.96],
    lowColor: [0.6, 0.62, 0.66],
    macroFreq: 3.2,
    detailFreq: 13.5,
    ridgeMix: 0.38,
    noiseContrast: 0.34,
    microRoughness: 0.25,
    normalStrength: 1.6,
    baseGloss: 0.3,
  },
  'Hiʻiaka': {
    id: 'Hiʻiaka',
    seed: 7006,
    customShape: true,
    scaleXYZ: [1.05, 0.95, 1.0],
    roughness: 0.025,
    geoCraterCount: 10,
    specialCraters: [],
    texCraterCount: 85,
    craterMinRad: 0.02,
    craterMaxRad: 0.13,
    craterDepthScale: 0.26,
    baseColor: [0.88, 0.91, 0.95],
    highColor: [0.97, 0.99, 1.0],
    lowColor: [0.7, 0.75, 0.81],
    macroFreq: 2.8,
    detailFreq: 12.0,
    ridgeMix: 0.32,
    noiseContrast: 0.3,
    microRoughness: 0.18,
    normalStrength: 1.35,
    baseGloss: 0.44,
    iceGlossBoost: 0.3,
  },
  Namaka: {
    id: 'Namaka',
    seed: 7007,
    customShape: true,
    scaleXYZ: [1.18, 0.86, 0.96],
    roughness: 0.055,
    facetStrength: 0.045,
    geoCraterCount: 12,
    specialCraters: [],
    texCraterCount: 90,
    craterMinRad: 0.022,
    craterMaxRad: 0.14,
    craterDepthScale: 0.3,
    baseColor: [0.84, 0.87, 0.91],
    highColor: [0.95, 0.97, 1.0],
    lowColor: [0.65, 0.7, 0.76],
    macroFreq: 3.1,
    detailFreq: 13.0,
    ridgeMix: 0.36,
    noiseContrast: 0.34,
    microRoughness: 0.22,
    normalStrength: 1.5,
    baseGloss: 0.38,
  },
  'MK 2': {
    id: 'MK 2',
    seed: 7008,
    customShape: true,
    scaleXYZ: [1.22, 0.82, 0.94],
    roughness: 0.075,
    facetStrength: 0.065,
    geoCraterCount: 12,
    specialCraters: [],
    texCraterCount: 100,
    craterMinRad: 0.022,
    craterMaxRad: 0.15,
    craterDepthScale: 0.35,
    baseColor: [0.22, 0.21, 0.21], // Charcoal-black surface
    highColor: [0.34, 0.33, 0.33],
    lowColor: [0.11, 0.11, 0.12],
    macroFreq: 3.3,
    detailFreq: 14.0,
    ridgeMix: 0.44,
    noiseContrast: 0.42,
    microRoughness: 0.34,
    normalStrength: 1.75,
    baseGloss: 0.03,
  },
  Dysnomia: {
    id: 'Dysnomia',
    seed: 7009,
    customShape: true,
    scaleXYZ: [1.04, 0.96, 1.01],
    roughness: 0.024,
    geoCraterCount: 12,
    specialCraters: [
      { dir: norm3(0.55, 0.42, 0.72), radius: 0.22, depth: 0.044, rim: 0.3 },
    ],
    texCraterCount: 120,
    craterMinRad: 0.018,
    craterMaxRad: 0.13,
    craterDepthScale: 0.32,
    baseColor: [0.36, 0.37, 0.4],
    highColor: [0.52, 0.54, 0.58],
    lowColor: [0.21, 0.22, 0.25],
    macroFreq: 3.0,
    detailFreq: 13.5,
    ridgeMix: 0.36,
    noiseContrast: 0.4,
    microRoughness: 0.28,
    normalStrength: 1.6,
    baseGloss: 0.08,
  },
}

const dynamicSpecCache = new Map<string, BodyDetailSpec>()

/** Returns a curated or deterministically generated geological spec for any minor planet or moon. */
export function getBodyDetailSpec(
  id: string,
  parentId?: string,
  semiMajorKm?: number,
): BodyDetailSpec {
  if (curatedSpecs[id]) return curatedSpecs[id]
  const cacheKey = `${parentId ?? ''}:${id}`
  const cached = dynamicSpecCache.get(cacheKey)
  if (cached) return cached

  const seed = hashString(cacheKey)
  const rand = seeded(seed)
  // Classify minor moon geology by host planet and orbital distance:
  // Inner regular satellites around Saturn/Uranus/Neptune are icy; outer irregulars are dark carbonaceous/reddish rocks.
  const isInnerIcy =
    (parentId === 'Saturn' && (semiMajorKm ?? 9e9) < 600000) ||
    (parentId === 'Uranus' && (semiMajorKm ?? 9e9) < 200000) ||
    (parentId === 'Neptune' && (semiMajorKm ?? 9e9) < 150000) ||
    parentId === 'Haumea'
  const isReddish = !isInnerIcy && rand() < 0.42
  const isBilobed = rand() < 0.22

  const sx = 1.08 + rand() * 0.36
  const sy = 0.72 + rand() * 0.22
  const sz = 0.84 + rand() * 0.24

  let baseColor: [number, number, number]
  let highColor: [number, number, number]
  let lowColor: [number, number, number]
  let baseGloss = 0.04

  if (isInnerIcy) {
    const b = 0.68 + rand() * 0.16
    baseColor = [b * 0.96, b * 0.98, b * 1.02]
    highColor = [Math.min(0.96, b + 0.16), Math.min(0.98, b + 0.17), Math.min(1, b + 0.19)]
    lowColor = [b * 0.66, b * 0.69, b * 0.74]
    baseGloss = 0.26
  } else if (isReddish) {
    const b = 0.32 + rand() * 0.2
    baseColor = [b * 1.15, b * 0.92, b * 0.8]
    highColor = [b * 1.48, b * 1.24, b * 1.08]
    lowColor = [b * 0.62, b * 0.48, b * 0.42]
  } else {
    const b = 0.28 + rand() * 0.22
    const cool = 0.96 + rand() * 0.08
    baseColor = [b, b * 0.99, b * cool]
    highColor = [b * 1.42, b * 1.41, b * 1.44]
    lowColor = [b * 0.56, b * 0.56, b * 0.58]
  }

  const specialCraters: CraterDef[] = []
  const bigCount = 1 + Math.floor(rand() * 3)
  for (let i = 0; i < bigCount; i++) {
    const z = rand() * 2 - 1
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    const rad = 0.28 + rand() * 0.24
    specialCraters.push({
      dir: [Math.cos(a) * r, z, Math.sin(a) * r],
      radius: rad,
      depth: rad * (0.22 + rand() * 0.1),
      rim: 0.34,
    })
  }

  const spec: BodyDetailSpec = {
    id,
    seed,
    customShape: true,
    scaleXYZ: [sx, sy, sz],
    bilobed: isBilobed ? 0.22 + rand() * 0.2 : 0,
    roughness: 0.065 + rand() * 0.045,
    facetStrength: 0.045 + rand() * 0.055,
    geoCraterCount: 12 + Math.floor(rand() * 12),
    specialCraters,
    texCraterCount: 105 + Math.floor(rand() * 55),
    craterMinRad: 0.018,
    craterMaxRad: 0.15,
    craterDepthScale: 0.36,
    brightCraterFloor: isInnerIcy ? 0.24 : 0.08,
    baseColor,
    highColor,
    lowColor,
    macroFreq: 2.9 + rand() * 1.0,
    detailFreq: 12.5 + rand() * 3.0,
    ridgeMix: 0.4 + rand() * 0.2,
    noiseContrast: 0.44 + rand() * 0.12,
    microRoughness: 0.3 + rand() * 0.08,
    normalStrength: 1.75,
    baseGloss,
  }
  dynamicSpecCache.set(cacheKey, spec)
  return spec
}

export function hasCustomShape(id: string, parentId?: string): boolean {
  const curated = curatedSpecs[id]
  if (curated) return curated.customShape
  // Unknown IDs (minor moons) always have irregular asteroid shapes
  return parentId !== undefined
}

export function isProceduralDetailBody(id: string): boolean {
  return id in curatedSpecs
}

/** Builds a sculpted 3D geometry with multi-scale craters, ridges, canyons, facets, and bilobed contours. */
export function buildDetailedBodyGeometry(
  id: string,
  tier: DetailTier = 'mid',
  parentId?: string,
  semiMajorKm?: number,
): T.BufferGeometry {
  const spec = getBodyDetailSpec(id, parentId, semiMajorKm)
  const segs: [number, number] =
    tier === 'close' ? [128, 88] : spec.customShape ? [56, 38] : [64, 44]
  const geo = new T.SphereGeometry(1, segs[0], segs[1])
  if (!spec.customShape) return geo

  const rand = seeded(spec.seed + 17)
  const craters: {
    cx: number
    cy: number
    cz: number
    radius: number
    depth: number
    peak: number
    rim: number
  }[] = spec.specialCraters.map((c) => {
    const [cx, cy, cz] = norm3(c.dir[0], c.dir[1], c.dir[2])
    return {
      cx,
      cy,
      cz,
      radius: c.radius,
      depth: c.depth,
      peak: c.peak ?? 0,
      rim: c.rim ?? 0.28,
    }
  })

  for (let i = 0; i < spec.geoCraterCount; i++) {
    const z = rand() * 2 - 1
    const a = rand() * Math.PI * 2
    const rr = Math.sqrt(Math.max(0, 1 - z * z))
    const rad = 0.1 + rand() * 0.24
    craters.push({
      cx: Math.cos(a) * rr,
      cy: z,
      cz: Math.sin(a) * rr,
      radius: rad,
      depth: rad * (0.14 + rand() * 0.14),
      peak: 0,
      rim: 0.26,
    })
  }

  // Precompute polyhedral facet planes for boxy / jagged bodies (e.g. Proteus, Juno, minor moons)
  const facetPlanes: { nx: number; ny: number; nz: number; cut: number }[] = []
  if (spec.facetStrength && spec.facetStrength > 0.001) {
    const fRand = seeded(spec.seed + 911)
    const count = 10
    for (let i = 0; i < count; i++) {
      const z = fRand() * 2 - 1
      const a = fRand() * Math.PI * 2
      const rr = Math.sqrt(Math.max(0, 1 - z * z))
      facetPlanes.push({
        nx: Math.cos(a) * rr,
        ny: z,
        nz: Math.sin(a) * rr,
        cut: 0.74 + fRand() * 0.16,
      })
    }
  }

  const pos = geo.attributes.position
  const [sx, sy, sz] = spec.scaleXYZ
  const grooveAxis = spec.grooves ? norm3(...spec.grooves.axis) : null
  const octaves = tier === 'close' ? 4 : 3

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i)
    const ny = pos.getY(i)
    const nz = pos.getZ(i)

    const nBase = fbm3(nx * 2.1 + 3.7, ny * 2.1 - 1.9, nz * 2.1 + 5.3, spec.seed, octaves) - 0.5
    const nRidge =
      ridged3(nx * 3.6 - 2.4, ny * 3.6 + 4.1, nz * 3.6 - 3.2, spec.seed + 41, octaves - 1) - 0.5
    let disp = 1 + spec.roughness * (nBase * 1.45 + nRidge * 0.72)

    // Bilobed waist pinch along X axis
    if (spec.bilobed && spec.bilobed > 0) {
      const waist = Math.exp(-nx * nx * 7.5)
      disp *= 1 - spec.bilobed * waist
    }

    // Faceted rock planes
    if (facetPlanes.length && spec.facetStrength) {
      let flatten = 0
      for (let f = 0; f < facetPlanes.length; f++) {
        const fp = facetPlanes[f]
        const d = nx * fp.nx + ny * fp.ny + nz * fp.nz
        if (d > fp.cut) {
          const excess = d - fp.cut
          flatten += excess * excess
        }
      }
      disp -= flatten * spec.facetStrength * 4.5
    }

    // Equatorial ridge (Iapetus walnut ridge / Pan saucer skirt)
    if (spec.equatorialRidge) {
      const { height, width } = spec.equatorialRidge
      const q = ny / width
      const band = Math.exp(-q * q)
      const mod = 0.65 + 0.55 * ridged3(nx * 5.2, ny * 5.2, nz * 5.2, spec.seed + 303, 2)
      disp += height * band * mod
    }

    // Parallel equatorial / tidal grooves (Vesta, Phobos)
    if (spec.grooves && grooveAxis) {
      const lat = nx * grooveAxis[0] + ny * grooveAxis[1] + nz * grooveAxis[2]
      const [lo, hi] = spec.grooves.latBand
      if (lat > lo && lat < hi) {
        const env = smoothstep(lo, lo + 0.14, lat) * (1 - smoothstep(hi - 0.14, hi, lat))
        const w = fbm3(nx * 3.2, ny * 3.2, nz * 3.2, spec.seed + 55, 2) * 0.12
        const g = Math.sin((lat + w) * spec.grooves.freq)
        const trough = Math.pow(Math.max(0, -g), 1.6)
        disp -= spec.grooves.depth * env * trough
      }
    }

    // Major 3D craters
    for (let c = 0; c < craters.length; c++) {
      const cr = craters[c]
      const dot = nx * cr.cx + ny * cr.cy + nz * cr.cz
      // Fast cosine rejection (max angle is 1.48 * radius)
      const maxAng = cr.radius * 1.48
      if (maxAng < 3.1 && dot < Math.cos(maxAng)) continue
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
      const q = angle / cr.radius
      if (q < 1.48) {
        if (q < 1.0) {
          const bowl = (1 - q * q) * (1 - 0.18 * q)
          disp -= cr.depth * bowl
          if (cr.peak > 0 && q < 0.36) {
            const pq = q / 0.36
            disp += cr.peak * (1 - pq * pq) ** 2
          }
        }
        if (q > 0.74) {
          const rq = (q - 1.04) / 0.18
          disp += cr.depth * cr.rim * Math.exp(-rq * rq)
        }
      }
    }

    // Major canyons carved into 3D mesh for close tier (e.g. Tethys Ithaca Chasma, Miranda Verona Rupes)
    if (tier === 'close' && spec.lineae) {
      for (let l = 0; l < spec.lineae.length; l++) {
        const ln = spec.lineae[l]
        if (ln.width < 0.03) continue
        const dotN = nx * ln.normal[0] + ny * ln.normal[1] + nz * ln.normal[2]
        if (Math.abs(dotN) > ln.width * 2.5) continue
        if (ln.arcCenter && ln.arcLimit !== undefined) {
          const arcDot = nx * ln.arcCenter[0] + ny * ln.arcCenter[1] + nz * ln.arcCenter[2]
          if (arcDot < ln.arcLimit) continue
        }
        const wobble = ln.wobble
          ? (noise3(nx * 5, ny * 5, nz * 5, (ln.seed ?? 1) + 7) - 0.5) * ln.wobble
          : 0
        const q = Math.abs(dotN + wobble) / ln.width
        if (q < 1.3) {
          disp -= 0.028 * ln.depth * Math.exp(-q * q * 2.2)
        }
      }
    }

    disp = Math.max(0.45, disp)
    pos.setXYZ(i, nx * disp * sx, ny * disp * sy, nz * disp * sz)
  }

  geo.computeVertexNormals()
  return geo
}

/** Builds an improved base geometry for the minor-moon InstancedMesh. */
export function buildMinorInstancedGeometry(): T.BufferGeometry {
  const rand = seeded(91823)
  const geo = new T.SphereGeometry(1, 24, 16)
  const pos = geo.attributes.position
  const craters: { cx: number; cy: number; cz: number; r: number; d: number }[] = []
  for (let i = 0; i < 9; i++) {
    const z = rand() * 2 - 1
    const a = rand() * Math.PI * 2
    const rr = Math.sqrt(Math.max(0, 1 - z * z))
    const r = 0.22 + rand() * 0.24
    craters.push({ cx: Math.cos(a) * rr, cy: z, cz: Math.sin(a) * rr, r, d: r * 0.22 })
  }
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i)
    const ny = pos.getY(i)
    const nz = pos.getZ(i)
    let disp =
      1 +
      0.085 * (fbm3(nx * 2.4 + 1.2, ny * 2.4 - 2.7, nz * 2.4 + 4.1, 91823, 3) - 0.5) * 2 +
      0.038 * (ridged3(nx * 4.2, ny * 4.2, nz * 4.2, 91889, 2) - 0.5) * 2
    for (const c of craters) {
      const dot = nx * c.cx + ny * c.cy + nz * c.cz
      if (dot < Math.cos(c.r * 1.4)) continue
      const q = Math.acos(Math.min(1, dot)) / c.r
      if (q < 1.0) disp -= c.d * (1 - q * q)
      else if (q < 1.4) {
        const rq = (q - 1.05) / 0.18
        disp += c.d * 0.26 * Math.exp(-rq * rq)
      }
    }
    pos.setXYZ(i, nx * disp, ny * disp, nz * disp)
  }
  geo.computeVertexNormals()
  return geo
}

export interface SynthesizedMaps {
  albedo: T.CanvasTexture
  normal: T.CanvasTexture
  specular: T.CanvasTexture | null
  emissive: T.CanvasTexture | null
  albedoPixels?: ImageData
  dispose: () => void
}

interface TexCrater {
  cx: number
  cy: number
  cz: number
  radius: number
  cosMax: number
  depth: number
  peak: number
  rim: number
  rays: number
  rings: number
  floorTint: [number, number, number] | null
  brightFloor: number
  darkFloor: number
  ux: number
  uy: number
  uz: number
  vx: number
  vy: number
  vz: number
}

interface IoVolcano {
  cx: number
  cy: number
  cz: number
  radius: number
  cosMax: number
  ringRad: number
  ringTint: [number, number, number]
  lavaGlow: number
}

interface TritonStreak {
  cx: number
  cy: number
  cz: number
  len: number
  width: number
}

interface SynthesisContext {
  spec: BodyDetailSpec
  width: number
  height: number
  albedoData: Uint8ClampedArray
  heightField: Float32Array
  specData: Uint8ClampedArray | null
  emissiveData: Uint8ClampedArray | null
  basePixels: ImageData | null
  cratersByBand: TexCrater[][]
  bandCount: number
  volcanoes: IoVolcano[]
  tritonStreaks: TritonStreak[]
  chaosPatches: { cx: number; cy: number; cz: number; rad: number }[]
  sinLon: Float32Array
  cosLon: Float32Array
  nextRow: number
}

function createSynthesisContext(
  spec: BodyDetailSpec,
  width: number,
  height: number,
  basePixels: ImageData | null,
  includeSpecular: boolean,
): SynthesisContext {
  const rand = seeded(spec.seed + 777)
  const bandCount = 16
  const cratersByBand: TexCrater[][] = Array.from({ length: bandCount }, () => [])

  function registerCrater(cr: TexCrater) {
    const lat = Math.asin(Math.max(-1, Math.min(1, cr.cy)))
    const reach = cr.radius * (cr.rays > 0 ? 3.2 : cr.rings > 0 ? 2.4 : 1.55)
    const minLat = Math.max(-Math.PI / 2, lat - reach)
    const maxLat = Math.min(Math.PI / 2, lat + reach)
    const b0 = Math.max(0, Math.min(bandCount - 1, Math.floor(((0.5 - maxLat / Math.PI) * bandCount))))
    const b1 = Math.max(0, Math.min(bandCount - 1, Math.floor(((0.5 - minLat / Math.PI) * bandCount))))
    for (let b = b0; b <= b1; b++) cratersByBand[b].push(cr)
  }

  function makeBasis(cx: number, cy: number, cz: number): [number, number, number, number, number, number] {
    const upx = Math.abs(cy) < 0.9 ? 0 : 1
    const upy = Math.abs(cy) < 0.9 ? 1 : 0
    const upz = 0
    const ux0 = upy * cz - upz * cy
    const uy0 = upz * cx - upx * cz
    const uz0 = upx * cy - upy * cx
    const [ux, uy, uz] = norm3(ux0, uy0, uz0)
    const vx = cy * uz - cz * uy
    const vy = cz * ux - cx * uz
    const vz = cx * uy - cy * ux
    return [ux, uy, uz, vx, vy, vz]
  }

  for (const sc of spec.specialCraters) {
    const [cx, cy, cz] = norm3(sc.dir[0], sc.dir[1], sc.dir[2])
    const rays = sc.rays ?? 0
    const rings = sc.rings ?? 0
    const reach = sc.radius * (rays > 0 ? 3.2 : rings > 0 ? 2.4 : 1.55)
    const [ux, uy, uz, vx, vy, vz] = makeBasis(cx, cy, cz)
    registerCrater({
      cx,
      cy,
      cz,
      radius: sc.radius,
      cosMax: reach >= Math.PI ? -1 : Math.cos(reach),
      depth: Math.max(0.24, sc.depth * 2.4),
      peak: sc.peak ? Math.min(0.45, sc.peak * 6) : 0,
      rim: sc.rim ?? 0.34,
      rays,
      rings,
      floorTint: sc.floorTint ?? null,
      brightFloor: 0,
      darkFloor: 0,
      ux,
      uy,
      uz,
      vx,
      vy,
      vz,
    })
  }

  // Scale crater count subtly with resolution so 256px mid-tier stays super fast
  const countScale = width <= 320 ? 0.55 : 1.0
  const texCount = Math.round(spec.texCraterCount * countScale)
  for (let i = 0; i < texCount; i++) {
    let z = rand() * 2 - 1
    // Enceladus south polar terrain is fresh & almost crater-free
    if (spec.enceladusStripes && z < -0.35) z = -0.35 + rand() * 1.35
    const a = rand() * Math.PI * 2
    const rr = Math.sqrt(Math.max(0, 1 - z * z))
    const cx = Math.cos(a) * rr
    const cy = z
    const cz = Math.sin(a) * rr
    // Power-law size distribution (many small craters, fewer big craters)
    const t = rand() ** 2.4
    const radius = spec.craterMinRad + t * (spec.craterMaxRad - spec.craterMinRad)
    const hasRays = spec.brightRayFraction && rand() < spec.brightRayFraction ? 0.35 + rand() * 0.45 : 0
    const reach = radius * (hasRays > 0 ? 2.9 : 1.52)
    const [ux, uy, uz, vx, vy, vz] = makeBasis(cx, cy, cz)
    registerCrater({
      cx,
      cy,
      cz,
      radius,
      cosMax: Math.cos(reach),
      depth: spec.craterDepthScale * (0.55 + 0.85 * Math.sqrt(radius / spec.craterMaxRad)),
      peak: radius > 0.085 && rand() < 0.45 ? 0.14 : 0,
      rim: 0.28 + rand() * 0.12,
      rays: hasRays,
      rings: 0,
      floorTint: null,
      brightFloor: spec.brightCraterFloor && rand() < spec.brightCraterFloor ? 0.45 + rand() * 0.5 : 0,
      darkFloor: spec.darkCraterFloor && rand() < spec.darkCraterFloor ? 0.45 + rand() * 0.5 : 0,
      ux,
      uy,
      uz,
      vx,
      vy,
      vz,
    })
  }

  // Io volcanic paterae & sulfur deposition rings
  const volcanoes: IoVolcano[] = []
  if (spec.ioVolcanism) {
    const vRand = seeded(spec.seed + 3141)
    // Curated iconic volcanoes (Pele with huge red ring, Loki Patera, Prometheus, Tvashtar)
    const curatedVolcanoes: [number, number, number, number, number, [number, number, number], number][] = [
      [0.74, 0.22, 0.63, 0.055, 0.38, [0.76, 0.22, 0.1], 1.0], // Pele red ring!
      [-0.56, -0.34, 0.75, 0.068, 0.24, [0.85, 0.52, 0.16], 0.95], // Loki Patera
      [0.18, 0.64, -0.74, 0.048, 0.3, [0.78, 0.28, 0.12], 0.9], // Tvashtar
      [-0.82, 0.14, -0.55, 0.052, 0.26, [0.92, 0.88, 0.72], 0.85], // Prometheus white SO2 ring
      [0.32, -0.54, -0.78, 0.044, 0.22, [0.8, 0.34, 0.14], 0.8],
    ]
    for (const [x, y, z, rad, ringRad, ringTint, glow] of curatedVolcanoes) {
      const [cx, cy, cz] = norm3(x, y, z)
      volcanoes.push({
        cx,
        cy,
        cz,
        radius: rad,
        cosMax: Math.cos(Math.max(rad * 1.8, ringRad * 1.25)),
        ringRad,
        ringTint,
        lavaGlow: glow,
      })
    }
    for (let i = 0; i < 36; i++) {
      const z = vRand() * 2 - 1
      const a = vRand() * Math.PI * 2
      const rr = Math.sqrt(Math.max(0, 1 - z * z))
      const rad = 0.018 + vRand() * 0.036
      const hasRing = vRand() < 0.35
      const ringRad = hasRing ? rad * (2.6 + vRand() * 2.4) : 0
      const ringTint: [number, number, number] =
        vRand() < 0.55 ? [0.78, 0.28, 0.13] : [0.94, 0.91, 0.78]
      volcanoes.push({
        cx: Math.cos(a) * rr,
        cy: z,
        cz: Math.sin(a) * rr,
        radius: rad,
        cosMax: Math.cos(Math.max(rad * 1.9, ringRad * 1.2)),
        ringRad,
        ringTint,
        lavaGlow: vRand() < 0.38 ? 0.5 + vRand() * 0.5 : 0.12,
      })
    }
  }

  // Triton wind-blown dark nitrogen geyser streaks in southern polar cap
  const tritonStreaks: TritonStreak[] = []
  if (spec.tritonCantaloupe) {
    const tRand = seeded(spec.seed + 6019)
    for (let i = 0; i < 34; i++) {
      const z = -0.18 - tRand() * 0.68
      const a = tRand() * Math.PI * 2
      const rr = Math.sqrt(Math.max(0, 1 - z * z))
      tritonStreaks.push({
        cx: Math.cos(a) * rr,
        cy: z,
        cz: Math.sin(a) * rr,
        len: 0.08 + tRand() * 0.14,
        width: 0.015 + tRand() * 0.022,
      })
    }
  }

  // Europa reddish-brown chaos terrains (Conamara, Thera, Thrace)
  const chaosPatches: { cx: number; cy: number; cz: number; rad: number }[] = []
  if (spec.europaChaos) {
    const eRand = seeded(spec.seed + 3025)
    for (let i = 0; i < 14; i++) {
      const z = (eRand() * 2 - 1) * 0.78
      const a = eRand() * Math.PI * 2
      const rr = Math.sqrt(Math.max(0, 1 - z * z))
      chaosPatches.push({
        cx: Math.cos(a) * rr,
        cy: z,
        cz: Math.sin(a) * rr,
        rad: 0.12 + eRand() * 0.22,
      })
    }
  }

  // Precompute longitude trig table (Matches Three.js SphereGeometry UV mapping: u -> phi)
  // Three.js SphereGeometry: x = -cos(u * 2pi) * sin(v * pi), y = cos(v * pi), z = sin(u * 2pi) * sin(v * pi)
  const sinLon = new Float32Array(width)
  const cosLon = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    const phi = ((x + 0.5) / width) * Math.PI * 2
    cosLon[x] = -Math.cos(phi)
    sinLon[x] = Math.sin(phi)
  }

  const pixelCount = width * height
  return {
    spec,
    width,
    height,
    albedoData: new Uint8ClampedArray(pixelCount * 4),
    heightField: new Float32Array(pixelCount),
    specData: includeSpecular ? new Uint8ClampedArray(pixelCount * 4) : null,
    emissiveData: spec.ioVolcanism ? new Uint8ClampedArray(pixelCount * 4) : null,
    basePixels,
    cratersByBand,
    bandCount,
    volcanoes,
    tritonStreaks,
    chaosPatches,
    sinLon,
    cosLon,
    nextRow: 0,
  }
}

function processRow(ctx: SynthesisContext, y: number) {
  const {
    spec,
    width,
    height,
    albedoData,
    heightField,
    specData,
    emissiveData,
    basePixels,
    cratersByBand,
    bandCount,
    volcanoes,
    tritonStreaks,
    chaosPatches,
    sinLon,
    cosLon,
  } = ctx

  const v = (y + 0.5) / height
  const theta = v * Math.PI
  const ny = Math.cos(theta)
  const sinT = Math.sin(theta)
  const bandIdx = Math.min(bandCount - 1, Math.floor(v * bandCount))
  const bandCraters = cratersByBand[bandIdx]
  const octMacro = width <= 320 ? 3 : 4
  const octDetail = width <= 320 ? 2 : 3
  const baseMix = basePixels && spec.baseImageMix ? spec.baseImageMix : 0
  const baseW = basePixels ? basePixels.width : 0
  const baseH = basePixels ? basePixels.height : 0
  const baseArr = basePixels ? basePixels.data : null
  const by = basePixels ? Math.min(baseH - 1, Math.floor(v * baseH)) : 0

  const [bR, bG, bB] = spec.baseColor
  const [hR, hG, hB] = spec.highColor
  const [lR, lG, lB] = spec.lowColor
  const grooveAxis = spec.grooves ? norm3(...spec.grooves.axis) : null

  for (let x = 0; x < width; x++) {
    const nx = cosLon[x] * sinT
    const nz = sinLon[x] * sinT
    const pIdx = y * width + x
    const o4 = pIdx * 4

    // 1. Multi-scale spherical terrain noise
    const nMacro = fbm3(
      nx * spec.macroFreq + 4.1,
      ny * spec.macroFreq - 2.3,
      nz * spec.macroFreq + 7.7,
      spec.seed,
      octMacro,
    )
    const nRidge = ridged3(
      nx * spec.macroFreq * 1.65 - 1.7,
      ny * spec.macroFreq * 1.65 + 3.4,
      nz * spec.macroFreq * 1.65 - 5.1,
      spec.seed + 113,
      octDetail,
    )
    const nMicro = fbm3(
      nx * spec.detailFreq + 9.2,
      ny * spec.detailFreq - 6.8,
      nz * spec.detailFreq + 2.5,
      spec.seed + 229,
      octDetail,
    )

    let h = nMacro * (1 - spec.ridgeMix) + nRidge * spec.ridgeMix
    h += (nMicro - 0.5) * spec.microRoughness * 0.9

    // Blend base / low / high geological tones
    const tColor = clamp01(0.5 + (h - 0.5) * (1.2 + spec.noiseContrast * 1.4))
    let r = tColor < 0.5 ? lR + (bR - lR) * (tColor * 2) : bR + (hR - bR) * ((tColor - 0.5) * 2)
    let g = tColor < 0.5 ? lG + (bG - lG) * (tColor * 2) : bG + (hG - bG) * ((tColor - 0.5) * 2)
    let b = tColor < 0.5 ? lB + (bB - lB) * (tColor * 2) : bB + (hB - bB) * ((tColor - 0.5) * 2)

    let gloss = spec.baseGloss + (spec.iceGlossBoost ?? 0) * Math.max(0, tColor - 0.5)
    let emR = 0
    let emG = 0
    let emB = 0

    // Optional base photograph color anchor (e.g. Pluto, Ceres, Eris, Haumea, Makemake)
    if (baseArr && baseMix > 0) {
      const bx = Math.min(baseW - 1, Math.floor(((x + 0.5) / width) * baseW))
      const bi = (by * baseW + bx) * 4
      const sr = baseArr[bi] / 255
      const sg = baseArr[bi + 1] / 255
      const sb = baseArr[bi + 2] / 255
      const lum = sr * 0.299 + sg * 0.587 + sb * 0.114
      r = r * (1 - baseMix) + sr * baseMix
      g = g * (1 - baseMix) + sg * baseMix
      b = b * (1 - baseMix) + sb * baseMix
      h = h * (1 - baseMix * 0.45) + lum * (baseMix * 0.45)
    }

    // 2. Curated Planetary & Moon Geological Archetypes

    // 2a. Titan layered golden-orange organic haze & dark polar vortex hood
    if (spec.titanBands) {
      const warp = (nMacro - 0.5) * 0.08 + (nMicro - 0.5) * 0.025
      const lat = ny + warp
      const band1 = Math.sin(lat * 9.5) * 0.5 + 0.5
      const band2 = Math.cos(lat * 19.0 + 0.8) * 0.5 + 0.5
      // North/South hemispheric seasonal asymmetry
      const hemi = smoothstep(-0.25, 0.35, lat)
      const bright = 0.88 + 0.16 * (1 - hemi) + 0.05 * band1 + 0.025 * band2
      r = bR * bright
      g = bG * (bright * (0.96 + 0.05 * band1))
      b = bB * (bright * (0.9 + 0.08 * (1 - hemi)))
      // Iconic dark bluish-brown North Polar Hood vortex
      const northHood = smoothstep(0.66, 0.9, ny + (nMacro - 0.5) * 0.06)
      const southRing = smoothstep(0.76, 0.94, -ny + (nMacro - 0.5) * 0.04) * 0.5
      const hood = Math.max(northHood, southRing)
      if (hood > 0.001) {
        r = r * (1 - hood * 0.58) + 0.26 * hood * 0.58
        g = g * (1 - hood * 0.54) + 0.25 * hood * 0.54
        b = b * (1 - hood * 0.32) + 0.28 * hood * 0.32
      }
      h = 0.5 + band1 * 0.06 + (nMicro - 0.5) * 0.04
    }

    // 2b. Pluto Tombaugh Regio (Heart of Sputnik Planitia) & Cthulhu Macula dark equatorial tholins
    if (spec.plutoFeatures) {
      // Dark reddish-brown Cthulhu Macula along the equator
      const eqMask = Math.exp(-(((ny + 0.08 + (nMacro - 0.5) * 0.22) / 0.28) ** 2))
      const cthulhuLon = smoothstep(-0.35, 0.35, -nx * 0.85 + nz * 0.52)
      const cthulhu = eqMask * cthulhuLon * smoothstep(0.32, 0.65, nMacro)
      if (cthulhu > 0.01) {
        r = r * (1 - cthulhu * 0.72) + 0.3 * cthulhu * 0.72
        g = g * (1 - cthulhu * 0.78) + 0.14 * cthulhu * 0.78
        b = b * (1 - cthulhu * 0.8) + 0.11 * cthulhu * 0.8
        h += cthulhu * 0.08
        gloss *= 1 - cthulhu * 0.7
      }
      // Tombaugh Regio heart (two overlapping nitrogen-ice lobes on front hemisphere)
      const dLeft = Math.hypot(nx - 0.68, (ny - 0.12) * 0.88, nz - 0.72)
      const dRight = Math.hypot(nx - 0.84, (ny - 0.16) * 1.05, nz - 0.48)
      const dTip = Math.hypot(nx - 0.78, (ny + 0.12) * 0.92, nz - 0.61)
      const heartDist = Math.min(dLeft * 1.02, dRight * 1.08, dTip * 1.15) + (nMacro - 0.5) * 0.12
      const heart = 1 - smoothstep(0.28, 0.42, heartDist)
      if (heart > 0.01) {
        // Polygonal nitrogen ice convection cells inside Sputnik Planitia
        const [v1, v2] = voronoi3(nx * 24, ny * 24, nz * 24, spec.seed + 88)
        const cellEdge = 1 - smoothstep(0.02, 0.12, v2 - v1)
        const creamR = 0.95 - cellEdge * 0.06
        const creamG = 0.91 - cellEdge * 0.07
        const creamB = 0.84 - cellEdge * 0.07
        r = r * (1 - heart) + creamR * heart
        g = g * (1 - heart) + creamG * heart
        b = b * (1 - heart) + creamB * heart
        // Smooth basin floor with subtle polygonal trenches
        h = h * (1 - heart * 0.82) + (0.42 - cellEdge * 0.05) * (heart * 0.82)
        gloss = gloss * (1 - heart) + 0.52 * heart
      }
    }

    // 2c. Io active sulfur volcanism, red Pele deposit rings, black calderas & glowing lava
    if (spec.ioVolcanism) {
      const s2 = fbm3(nx * 5.2 - 3.1, ny * 5.2 + 1.8, nz * 5.2 + 4.4, spec.seed + 501, octDetail)
      // Sulfur yellow-olive-orange-white mottling
      if (s2 > 0.58) {
        const w = smoothstep(0.58, 0.8, s2)
        r = r * (1 - w * 0.7) + 0.96 * w * 0.7
        g = g * (1 - w * 0.7) + 0.94 * w * 0.7
        b = b * (1 - w * 0.7) + 0.78 * w * 0.7
      } else if (s2 < 0.36) {
        const o = smoothstep(0.36, 0.14, s2)
        r = r * (1 - o * 0.65) + 0.82 * o * 0.65
        g = g * (1 - o * 0.65) + 0.4 * o * 0.65
        b = b * (1 - o * 0.65) + 0.12 * o * 0.65
      }
      // Slightly darker reddish polar sulfur deposits
      const pole = smoothstep(0.65, 0.98, Math.abs(ny))
      if (pole > 0.01) {
        r *= 1 - pole * 0.18
        g *= 1 - pole * 0.34
        b *= 1 - pole * 0.42
      }
      for (let vi = 0; vi < volcanoes.length; vi++) {
        const vol = volcanoes[vi]
        const dot = nx * vol.cx + ny * vol.cy + nz * vol.cz
        if (dot < vol.cosMax) continue
        const ang = Math.acos(Math.min(1, dot))
        // Pyroclastic sulfur deposit ring (like Pele's giant red ring)
        if (vol.ringRad > 0 && ang < vol.ringRad * 1.25) {
          const rq = (ang - vol.ringRad * 0.78) / (vol.ringRad * 0.34)
          const ringW = Math.exp(-rq * rq) * (0.45 + 0.45 * nMicro)
          r = r * (1 - ringW * 0.68) + vol.ringTint[0] * ringW * 0.68
          g = g * (1 - ringW * 0.68) + vol.ringTint[1] * ringW * 0.68
          b = b * (1 - ringW * 0.68) + vol.ringTint[2] * ringW * 0.68
        }
        // Dark radiating lava flows & black obsidian patera caldera
        const flowWarp = ang * (0.85 + 0.4 * nRidge)
        if (flowWarp < vol.radius * 1.8) {
          const caldera = 1 - smoothstep(vol.radius * 0.48, vol.radius * 1.05, flowWarp)
          const flow = (1 - smoothstep(vol.radius * 0.9, vol.radius * 1.75, flowWarp)) * smoothstep(0.42, 0.78, nRidge)
          const dark = Math.max(caldera, flow * 0.72)
          r = r * (1 - dark * 0.9) + 0.09 * dark * 0.9
          g = g * (1 - dark * 0.9) + 0.07 * dark * 0.9
          b = b * (1 - dark * 0.9) + 0.06 * dark * 0.9
          h -= caldera * 0.24
          // Incandescent magma glow inside active caldera fissures
          if (emissiveData && vol.lavaGlow > 0.2 && caldera > 0.2) {
            const crack = smoothstep(0.45, 0.85, nRidge) * caldera * vol.lavaGlow
            const core = Math.pow(Math.max(0, 1 - ang / (vol.radius * 0.75)), 2.2) * vol.lavaGlow
            const glow = Math.min(1.5, core * 0.9 + crack * 0.95)
            emR = Math.max(emR, glow * 1.0)
            emG = Math.max(emG, glow * 0.42)
            emB = Math.max(emB, glow * 0.08)
          }
        }
      }
    }

    // 2d. Europa reddish-brown mottled Chaos Terrain (Conamara Chaos)
    if (spec.europaChaos) {
      for (let ci = 0; ci < chaosPatches.length; ci++) {
        const cp = chaosPatches[ci]
        const dot = nx * cp.cx + ny * cp.cy + nz * cp.cz
        if (dot < 0.7) continue
        const ang = Math.acos(Math.min(1, dot))
        const m = (1 - smoothstep(cp.rad * 0.4, cp.rad * 1.15, ang + (nMacro - 0.5) * 0.14)) * smoothstep(0.32, 0.72, nRidge)
        if (m > 0.02) {
          r = r * (1 - m * 0.65) + 0.58 * m * 0.65
          g = g * (1 - m * 0.65) + 0.36 * m * 0.65
          b = b * (1 - m * 0.65) + 0.24 * m * 0.65
          h += m * 0.12
          gloss *= 1 - m * 0.55
        }
      }
    }

    // 2e. Ganymede young bright grooved terrain (Sulci) cutting through dark Galileo Regio
    if (spec.ganymedeSulci) {
      const sulcusNoise = fbm3(nx * 3.4 + 2.1, ny * 3.4 - 4.2, nz * 3.4 + 1.5, spec.seed + 331, 3)
      const swath = smoothstep(0.44, 0.58, sulcusNoise)
      if (swath > 0.01) {
        const grooves = Math.sin((nx * 24 + ny * 18 - nz * 15 + nMacro * 6.0) * 1.6) * 0.5 + 0.5
        const bright = swath * (0.65 + 0.35 * grooves)
        r = r * (1 - bright * 0.62) + 0.86 * bright * 0.62
        g = g * (1 - bright * 0.62) + 0.84 * bright * 0.62
        b = b * (1 - bright * 0.62) + 0.81 * bright * 0.62
        h += swath * (grooves - 0.5) * 0.14
        gloss += swath * 0.18
      }
    }

    // 2f. Enceladus South Polar Tiger Stripes (Alexandria, Cairo, Baghdad, Damascus)
    if (spec.enceladusStripes && ny < -0.52) {
      const sEnv = smoothstep(-0.52, -0.76, ny)
      // Rotate into south polar plane (nx, nz)
      const px = nx * 0.86 - nz * 0.51
      const pz = nx * 0.51 + nz * 0.86
      const along = Math.abs(pz)
      if (along < 0.56) {
        const lenMask = 1 - smoothstep(0.32, 0.55, along)
        const warp = (nMacro - 0.5) * 0.045
        const offsets = [-0.21, -0.07, 0.07, 0.21]
        for (let si = 0; si < offsets.length; si++) {
          const dist = Math.abs(px + warp - offsets[si])
          if (dist < 0.036) {
            const trough = Math.exp(-((dist / 0.014) ** 2)) * sEnv * lenMask
            const flank = Math.exp(-(((dist - 0.02) / 0.012) ** 2)) * sEnv * lenMask
            r = r * (1 - trough * 0.58) + 0.38 * trough * 0.58
            g = g * (1 - trough * 0.42) + 0.72 * trough * 0.42
            b = b * (1 - trough * 0.2) + 0.94 * trough * 0.2
            h -= trough * 0.32
            h += flank * 0.14
            gloss = Math.min(1, gloss + trough * 0.3)
          }
        }
      }
    }

    // 2g. Iapetus extreme Ying-Yang dichotomy (Cassini Regio dark vs Roncevaux bright)
    if (spec.iapetusDichotomy) {
      // Dark leading hemisphere centered near +X/+Z with wavy thermally segregated boundary
      const hemiDot = nx * 0.86 + nz * 0.51
      const edgeNoise = (nMacro - 0.5) * 0.42 + (nMicro - 0.5) * 0.16
      const latGuard = 1 - smoothstep(0.68, 0.94, Math.abs(ny))
      const darkMask = smoothstep(-0.08, 0.22, hemiDot + edgeNoise) * latGuard
      if (darkMask > 0.005) {
        const dR = 0.15 + nMicro * 0.09
        const dG = 0.11 + nMicro * 0.07
        const dB = 0.09 + nMicro * 0.05
        r = r * (1 - darkMask) + dR * darkMask
        g = g * (1 - darkMask) + dG * darkMask
        b = b * (1 - darkMask) + dB * darkMask
        gloss *= 1 - darkMask * 0.85
      }
    }

    // 2h. Triton cantaloupe dimpled terrain + pink-cream nitrogen south polar cap + dark geyser streaks
    if (spec.tritonCantaloupe) {
      // Cantaloupe dimples in northern/equatorial region
      const cantaMask = smoothstep(-0.22, 0.22, ny + (nMacro - 0.5) * 0.26)
      if (cantaMask > 0.01) {
        const [d1, d2] = voronoi3(nx * 26, ny * 26, nz * 26, spec.seed + 601)
        const dimple = smoothstep(0.0, 0.35, d2 - d1)
        const rim = 1 - dimple
        h += cantaMask * (rim * 0.18 - d1 * 0.12)
        r = r * (1 - cantaMask * 0.25) + (0.66 - rim * 0.08) * cantaMask * 0.25
        g = g * (1 - cantaMask * 0.25) + (0.67 - rim * 0.06) * cantaMask * 0.25
        b = b * (1 - cantaMask * 0.25) + (0.64 - rim * 0.05) * cantaMask * 0.25
      }
      // Pinkish-cream nitrogen south polar ice cap
      const capMask = smoothstep(0.12, -0.32, ny + (nMacro - 0.5) * 0.3)
      if (capMask > 0.01) {
        r = r * (1 - capMask * 0.78) + 0.94 * capMask * 0.78
        g = g * (1 - capMask * 0.78) + 0.86 * capMask * 0.78
        b = b * (1 - capMask * 0.78) + 0.82 * capMask * 0.78
        gloss = Math.min(1, gloss + capMask * 0.24)
        // Wind-blown dark geyser plumes
        for (let si = 0; si < tritonStreaks.length; si++) {
          const st = tritonStreaks[si]
          const dot = nx * st.cx + ny * st.cy + nz * st.cz
          if (dot < 0.94) continue
          const dx = nx - st.cx
          const dy = ny - st.cy
          const dz = nz - st.cz
          // Consistent northeastward wind vector
          const along = dx * 0.72 + dy * 0.42 + dz * 0.55
          if (along > -0.01 && along < st.len) {
            const perpSq = dx * dx + dy * dy + dz * dz - along * along
            const w = st.width * (0.45 + (along / st.len) * 1.1)
            if (perpSq < w * w) {
              const fade = (1 - along / st.len) * Math.exp(-perpSq / (w * w * 0.45)) * capMask
              r = r * (1 - fade * 0.58) + 0.26 * fade * 0.58
              g = g * (1 - fade * 0.58) + 0.24 * fade * 0.58
              b = b * (1 - fade * 0.58) + 0.25 * fade * 0.58
            }
          }
        }
      }
    }

    // 2i. Miranda ovoid concentric chevron Coronae
    if (spec.coronae) {
      for (let ci = 0; ci < spec.coronae.length; ci++) {
        const co = spec.coronae[ci]
        const dot = nx * co.dir[0] + ny * co.dir[1] + nz * co.dir[2]
        if (dot < Math.cos(co.radius * 1.25)) continue
        const ang = Math.acos(Math.min(1, dot))
        const mask = 1 - smoothstep(co.radius * 0.72, co.radius * 1.05, ang + (nMacro - 0.5) * 0.08)
        if (mask > 0.01) {
          const bands = Math.sin(ang * co.freq + nMacro * 3.2) * 0.5 + 0.5
          h += mask * (bands - 0.5) * 0.24
          const tintW = mask * (0.35 + 0.55 * bands)
          r = r * (1 - tintW * 0.65) + co.tint[0] * tintW * 0.65
          g = g * (1 - tintW * 0.65) + co.tint[1] * tintW * 0.65
          b = b * (1 - tintW * 0.65) + co.tint[2] * tintW * 0.65
        }
      }
    }

    // 3. Curated albedo / topographic patches (Mordor Macula, Haumea Red Spot, Ceres bright salt, etc.)
    if (spec.patches) {
      for (let pi = 0; pi < spec.patches.length; pi++) {
        const pt = spec.patches[pi]
        const dot = nx * pt.dir[0] + ny * pt.dir[1] + nz * pt.dir[2]
        const maxAng = pt.radius * 1.45
        if (maxAng < 3.1 && dot < Math.cos(maxAng)) continue
        const ang = Math.acos(Math.max(-1, Math.min(1, dot)))
        const nShift = pt.noiseMix ? (nMacro - 0.5) * pt.radius * pt.noiseMix : 0
        const inner = pt.radius * (1 - pt.softness)
        const m = 1 - smoothstep(inner, pt.radius, ang + nShift)
        if (m > 0.005) {
          r = r * (1 - m) + pt.color[0] * m
          g = g * (1 - m) + pt.color[1] * m
          b = b * (1 - m) + pt.color[2] * m
          if (pt.height) h += pt.height * m
          if (pt.gloss !== undefined) gloss = gloss * (1 - m) + pt.gloss * m
        }
      }
    }

    // 4. Equatorial ridge coloring & texture detail (Iapetus, Pan)
    if (spec.equatorialRidge) {
      const q = ny / spec.equatorialRidge.width
      const band = Math.exp(-q * q)
      if (band > 0.02) {
        h += band * 0.34 * (0.6 + 0.5 * nRidge)
        if (spec.equatorialRidge.tint) {
          const [tr, tg, tb] = spec.equatorialRidge.tint
          r = r * (1 - band * 0.55) + tr * band * 0.55
          g = g * (1 - band * 0.55) + tg * band * 0.55
          b = b * (1 - band * 0.55) + tb * band * 0.55
        }
      }
    }

    // 5. Parallel equatorial / tidal grooves in texture & normal (Vesta, Phobos)
    if (spec.grooves && grooveAxis) {
      const lat = nx * grooveAxis[0] + ny * grooveAxis[1] + nz * grooveAxis[2]
      const [lo, hi] = spec.grooves.latBand
      if (lat > lo && lat < hi) {
        const env = smoothstep(lo, lo + 0.14, lat) * (1 - smoothstep(hi - 0.14, hi, lat))
        const gVal = Math.sin((lat + (nMacro - 0.5) * 0.08) * spec.grooves.freq)
        const trough = Math.pow(Math.max(0, -gVal), 1.7) * env
        h -= trough * 0.22
        r *= 1 - trough * 0.14
        g *= 1 - trough * 0.14
        b *= 1 - trough * 0.14
      }
    }

    // 6. Great-circle fractures, double ridges & tectonic canyons (Europa, Dione, Rhea, Ariel, Charon, Tethys)
    if (spec.lineae) {
      for (let li = 0; li < spec.lineae.length; li++) {
        const ln = spec.lineae[li]
        const dotN = nx * ln.normal[0] + ny * ln.normal[1] + nz * ln.normal[2]
        const limit = ln.width * 2.8 + (ln.wobble ?? 0)
        if (Math.abs(dotN) > limit) continue
        let arcEnv = 1
        if (ln.arcCenter && ln.arcLimit !== undefined) {
          const arcDot = nx * ln.arcCenter[0] + ny * ln.arcCenter[1] + nz * ln.arcCenter[2]
          if (arcDot < ln.arcLimit - 0.12) continue
          arcEnv = smoothstep(ln.arcLimit - 0.12, ln.arcLimit + 0.12, arcDot)
        }
        const wob = ln.wobble
          ? (noise3(nx * 6.5, ny * 6.5, nz * 6.5, (ln.seed ?? 1) + 19) - 0.5) * ln.wobble
          : 0
        const dist = Math.abs(dotN + wob)
        const q = dist / ln.width
        if (q < 2.2) {
          if (ln.doubleRidge) {
            const centerTrough = Math.exp(-(q * q * 3.8)) * arcEnv
            const twinRidge = Math.exp(-(((q - 0.85) / 0.42) ** 2)) * arcEnv
            const mix = Math.min(1, (centerTrough * 0.9 + twinRidge * 0.65) * 0.85)
            r = r * (1 - mix) + ln.color[0] * mix
            g = g * (1 - mix) + ln.color[1] * mix
            b = b * (1 - mix) + ln.color[2] * mix
            h += (twinRidge * 0.16 - centerTrough * 0.2) * ln.depth * 2.2
            gloss *= 1 - centerTrough * 0.4
          } else {
            const trough = Math.exp(-(q * q * 2.4)) * arcEnv
            const rim = Math.exp(-(((q - 1.15) / 0.35) ** 2)) * arcEnv
            const mix = Math.min(1, trough * 0.85)
            r = r * (1 - mix) + ln.color[0] * mix
            g = g * (1 - mix) + ln.color[1] * mix
            b = b * (1 - mix) + ln.color[2] * mix
            h += (rim * 0.12 - trough * 0.34) * ln.depth * 1.8
          }
        }
      }
    }

    // 7. Spatially-indexed spherical crater field (bowls, raised rims, central peaks, rings & ejecta rays!)
    for (let ci = 0; ci < bandCraters.length; ci++) {
      const cr = bandCraters[ci]
      const dot = nx * cr.cx + ny * cr.cy + nz * cr.cz
      if (dot < cr.cosMax) continue
      const ang = Math.acos(Math.max(-1, Math.min(1, dot)))
      const q = ang / cr.radius

      if (q < 1.52) {
        if (q < 1.0) {
          const bowl = (1 - q * q) * (1 - 0.2 * q)
          h -= cr.depth * bowl
          // Darkened interior bowl shadow / exposed subsurface tint
          if (cr.floorTint) {
            const fm = smoothstep(0.98, 0.42, q)
            r = r * (1 - fm * 0.85) + cr.floorTint[0] * fm * 0.85
            g = g * (1 - fm * 0.85) + cr.floorTint[1] * fm * 0.85
            b = b * (1 - fm * 0.85) + cr.floorTint[2] * fm * 0.85
            gloss = Math.min(1, gloss + fm * 0.22)
          } else if (cr.brightFloor > 0) {
            const fm = smoothstep(1.02, 0.28, q) * cr.brightFloor
            r = r * (1 - fm * 0.65) + 0.94 * fm * 0.65
            g = g * (1 - fm * 0.65) + 0.95 * fm * 0.65
            b = b * (1 - fm * 0.65) + 0.97 * fm * 0.65
            gloss = Math.min(1, gloss + fm * 0.35)
          } else if (cr.darkFloor > 0) {
            const fm = smoothstep(0.95, 0.25, q) * cr.darkFloor
            r *= 1 - fm * 0.52
            g *= 1 - fm * 0.54
            b *= 1 - fm * 0.56
          } else {
            const shade = 1 - bowl * 0.16
            r *= shade
            g *= shade
            b *= shade
          }
          if (cr.peak > 0 && q < 0.34) {
            const pq = q / 0.34
            h += cr.peak * (1 - pq * pq) ** 2
          }
        }
        if (q > 0.72) {
          const rq = (q - 1.04) / 0.19
          const rimW = Math.exp(-rq * rq)
          h += cr.depth * cr.rim * rimW
          const lift = rimW * 0.11
          r = Math.min(1, r + lift)
          g = Math.min(1, g + lift)
          b = Math.min(1, b + lift)
        }
      }

      // Multi-ring impact basins (Callisto Valhalla & Asgard, Europa Tyre)
      if (cr.rings > 0 && q >= 0.95 && q < 2.35) {
        const ringEnv = Math.exp(-(((q - 1.55) / 0.55) ** 2))
        const wave = Math.sin((q - 1.0) * cr.rings * Math.PI * 2) * 0.5 + 0.5
        h += ringEnv * (wave - 0.5) * 0.16
        const ringLift = ringEnv * wave * 0.16
        r = Math.min(1, r + ringLift)
        g = Math.min(1, g + ringLift)
        b = Math.min(1, b + ringLift)
      }

      // Bright icy ejecta rays radiating outward from young craters
      if (cr.rays > 0 && q > 0.78 && q < 3.1) {
        const dx = nx - cr.cx
        const dy = ny - cr.cy
        const dz = nz - cr.cz
        const az = Math.atan2(dx * cr.vx + dy * cr.vy + dz * cr.vz, dx * cr.ux + dy * cr.uy + dz * cr.uz)
        const rayPattern =
          0.5 +
          0.32 * Math.sin(az * 7 + cr.cx * 12) +
          0.24 * Math.sin(az * 13 - cr.cy * 9) +
          0.18 * Math.cos(az * 23 + cr.cz * 15)
        const rayMask =
          smoothstep(0.55, 0.96, rayPattern) *
          (1 - smoothstep(0.95, 3.05, q)) *
          smoothstep(0.75, 1.02, q) *
          cr.rays
        if (rayMask > 0.01) {
          r = r * (1 - rayMask * 0.72) + 0.96 * rayMask * 0.72
          g = g * (1 - rayMask * 0.72) + 0.97 * rayMask * 0.72
          b = b * (1 - rayMask * 0.72) + 0.99 * rayMask * 0.72
          gloss = Math.min(1, gloss + rayMask * 0.25)
        }
      }
    }

    // Subtle fine regolith grain variation
    const grain = (nMicro - 0.5) * spec.microRoughness * 0.28
    r = clamp01(r + grain)
    g = clamp01(g + grain)
    b = clamp01(b + grain)

    albedoData[o4] = Math.round(r * 255)
    albedoData[o4 + 1] = Math.round(g * 255)
    albedoData[o4 + 2] = Math.round(b * 255)
    albedoData[o4 + 3] = 255

    heightField[pIdx] = h

    if (specData) {
      const sv = Math.round(clamp01(gloss) * 255)
      specData[o4] = sv
      specData[o4 + 1] = sv
      specData[o4 + 2] = sv
      specData[o4 + 3] = 255
    }

    if (emissiveData) {
      emissiveData[o4] = Math.round(clamp01(emR) * 255)
      emissiveData[o4 + 1] = Math.round(clamp01(emG) * 255)
      emissiveData[o4 + 2] = Math.round(clamp01(emB) * 255)
      emissiveData[o4 + 3] = 255
    }
  }
}

function finalizeSynthesis(
  ctx: SynthesisContext,
  maxAnisotropy: number,
  keepPixels: boolean,
): SynthesizedMaps {
  const { width, height, albedoData, heightField, specData, emissiveData, spec } = ctx

  // 1. Albedo texture
  const albedoCanvas = document.createElement('canvas')
  albedoCanvas.width = width
  albedoCanvas.height = height
  const aCtx = albedoCanvas.getContext('2d')!
  const aImg = new ImageData(new Uint8ClampedArray(albedoData), width, height)
  aCtx.putImageData(aImg, 0, 0)
  const albedo = new T.CanvasTexture(albedoCanvas)
  albedo.colorSpace = T.SRGBColorSpace
  albedo.wrapS = T.RepeatWrapping
  albedo.wrapT = T.ClampToEdgeWrapping
  albedo.anisotropy = maxAnisotropy
  albedo.needsUpdate = true

  // 2. Tangent-space Normal Map derived from spherical height field via latitude-corrected Sobel
  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = width
  normalCanvas.height = height
  const nCtx = normalCanvas.getContext('2d')!
  const nImg = nCtx.createImageData(width, height)
  const nData = nImg.data
  const strength = spec.normalStrength * (width / 512) * 1.45

  for (let y = 0; y < height; y++) {
    const yUp = y > 0 ? y - 1 : 0
    const yDn = y < height - 1 ? y + 1 : height - 1
    const sinTheta = Math.max(0.18, Math.sin(((y + 0.5) / height) * Math.PI))
    const rowOff = y * width
    const upOff = yUp * width
    const dnOff = yDn * width
    for (let x = 0; x < width; x++) {
      const xL = x === 0 ? width - 1 : x - 1
      const xR = x === width - 1 ? 0 : x + 1
      const hL = heightField[rowOff + xL]
      const hR = heightField[rowOff + xR]
      const hU = heightField[upOff + x]
      const hD = heightField[dnOff + x]
      // Compensate equirectangular horizontal stretching near poles
      const dx = ((hR - hL) * strength) / sinTheta
      const dy = (hD - hU) * strength * 2.0
      const inv = 1 / Math.hypot(dx, dy, 1)
      const o4 = (rowOff + x) * 4
      nData[o4] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
      nData[o4 + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255)
      nData[o4 + 2] = Math.round((inv * 0.5 + 0.5) * 255)
      nData[o4 + 3] = 255
    }
  }
  nCtx.putImageData(nImg, 0, 0)
  const normal = new T.CanvasTexture(normalCanvas)
  normal.colorSpace = T.NoColorSpace
  normal.wrapS = T.RepeatWrapping
  normal.wrapT = T.ClampToEdgeWrapping
  normal.anisotropy = maxAnisotropy
  normal.needsUpdate = true

  // 3. Optional Specular / Gloss Map
  let specular: T.CanvasTexture | null = null
  if (specData) {
    const sCanvas = document.createElement('canvas')
    sCanvas.width = width
    sCanvas.height = height
    const sCtx = sCanvas.getContext('2d')!
    sCtx.putImageData(new ImageData(new Uint8ClampedArray(specData), width, height), 0, 0)
    specular = new T.CanvasTexture(sCanvas)
    specular.colorSpace = T.NoColorSpace
    specular.wrapS = T.RepeatWrapping
    specular.wrapT = T.ClampToEdgeWrapping
    specular.anisotropy = maxAnisotropy
    specular.needsUpdate = true
  }

  // 4. Optional Emissive Map (Io glowing volcanic calderas)
  let emissive: T.CanvasTexture | null = null
  if (emissiveData) {
    const eCanvas = document.createElement('canvas')
    eCanvas.width = width
    eCanvas.height = height
    const eCtx = eCanvas.getContext('2d')!
    eCtx.putImageData(new ImageData(new Uint8ClampedArray(emissiveData), width, height), 0, 0)
    emissive = new T.CanvasTexture(eCanvas)
    emissive.colorSpace = T.SRGBColorSpace
    emissive.wrapS = T.RepeatWrapping
    emissive.wrapT = T.ClampToEdgeWrapping
    emissive.anisotropy = maxAnisotropy
    emissive.needsUpdate = true
  }

  return {
    albedo,
    normal,
    specular,
    emissive,
    albedoPixels: keepPixels ? aImg : undefined,
    dispose() {
      albedo.dispose()
      normal.dispose()
      specular?.dispose()
      emissive?.dispose()
    },
  }
}

/**
 * Time-sliced asynchronous procedural texture synthesis so close-up 1K+ maps
 * never stutter or drop frames. Returns a cancel handle.
 */
export function synthesizeBodyMapsAsync(
  spec: BodyDetailSpec,
  width: number,
  height: number,
  options: {
    basePixels?: ImageData | null
    includeSpecular?: boolean
    maxAnisotropy?: number
    keepPixels?: boolean
    budgetMs?: number
    onDone: (maps: SynthesizedMaps) => void
  },
): () => void {
  let cancelled = false
  let timer = 0
  const ctx = createSynthesisContext(
    spec,
    width,
    height,
    options.basePixels ?? null,
    options.includeSpecular ?? true,
  )
  const budget = options.budgetMs ?? 7
  const aniso = options.maxAnisotropy ?? 4

  function step() {
    timer = 0
    if (cancelled) return
    const start = performance.now()
    while (ctx.nextRow < height && performance.now() - start < budget) {
      processRow(ctx, ctx.nextRow++)
    }
    if (ctx.nextRow < height) {
      timer = window.setTimeout(step, 0)
      return
    }
    const maps = finalizeSynthesis(ctx, aniso, !!options.keepPixels)
    if (cancelled) {
      maps.dispose()
      return
    }
    options.onDone(maps)
  }

  timer = window.setTimeout(step, 0)
  return () => {
    cancelled = true
    if (timer) clearTimeout(timer)
  }
}

/** Synchronous synthesis for small/shared textures (e.g. minor-moon InstancedMesh rock texture). */
export function synthesizeBodyMapsSync(
  spec: BodyDetailSpec,
  width: number,
  height: number,
  maxAnisotropy = 4,
): SynthesizedMaps {
  const ctx = createSynthesisContext(spec, width, height, null, false)
  for (let y = 0; y < height; y++) processRow(ctx, y)
  return finalizeSynthesis(ctx, maxAnisotropy, false)
}

/** Extracts ImageData from an existing loaded Three.js Texture's image, if available. */
export function extractTexturePixels(texture: T.Texture | null, maxW = 512): ImageData | null {
  const img = texture?.image as HTMLImageElement | HTMLCanvasElement | undefined
  if (!img) return null
  const iw = 'naturalWidth' in img ? img.naturalWidth : img.width
  const ih = 'naturalHeight' in img ? img.naturalHeight : img.height
  if (!iw || !ih) return null
  const w = Math.min(maxW, iw)
  const h = Math.max(1, Math.round((ih * w) / iw))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const k = c.getContext('2d')!
  k.drawImage(img, 0, 0, w, h)
  return k.getImageData(0, 0, w, h)
}
