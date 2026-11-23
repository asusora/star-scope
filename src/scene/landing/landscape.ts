import { clamp, seeded } from '../math'
import { locale, type Locale } from '../../i18n'
import { landscapeRegionEn } from '../../i18n/catalogEn'

export type TerrainKind = 'dust' | 'craters' | 'alpine' | 'lava' | 'ice' | 'cloud'
type Palette = [ground: string, highlight: string, horizon: string, zenith: string, sun: string]
export interface Landscape {
  id: string
  name: string
  kind: TerrainKind
  region: string
  palette: Palette
  seed: number
}
const sites: Record<string, [TerrainKind, string, Palette]> = {
  Mars: ['dust', '杰泽罗层状台地', ['#a6633f', '#d89b6c', '#d8a378', '#685049', '#fff2dc']],
  Earth: ['alpine', '高山砾原', ['#716f4b', '#a0a78a', '#c1d5d8', '#356b9c', '#ffedc2']],
  Moon: ['craters', '静海撞击平原', ['#7e7d79', '#b8b4ac', '#000000', '#000000', '#fffaf0']],
  Mercury: ['craters', '撞击盆地', ['#766b62', '#b1a290', '#201e21', '#07070a', '#fff2ce']],
  Venus: ['lava', '玄武岩高地', ['#79502f', '#bd8b48', '#c89950', '#97703e', '#ffdd85']],
  Jupiter: ['cloud', '云带上空', ['#a27863', '#f6e2ba', '#e7c6a4', '#725f67', '#fff0cc']],
  Saturn: ['cloud', '高层云海', ['#a99169', '#f6e8be', '#e4cc9c', '#83765f', '#fff5d4']],
  Uranus: ['cloud', '高层云海', ['#53878d', '#cae6dc', '#a0ceca', '#426779', '#e6f7f6']],
  Neptune: ['cloud', '高层云海', ['#455e96', '#bfd4e6', '#9eb7d9', '#38466d', '#f3f4ff']],
  Io: ['lava', '火山平原', ['#98823f', '#c9b772', '#2c2821', '#07080a', '#fff8dc']],
  Titan: ['ice', '冰质丘陵', ['#856b4c', '#c4a276', '#c69b63', '#846947', '#ffdeb0']],
  Psyche: ['craters', '铁镍撞击盆地', ['#6d727c', '#b7becb', '#222630', '#06070c', '#fff6e0']],
  Eurybates: ['craters', '碳质碎砾荒原', ['#4c4b4e', '#7c7b80', '#16161b', '#050609', '#fff4dc']],
  Patroclus: ['craters', '原始暗红冰原', ['#664d42', '#9b7b6a', '#1d1615', '#060508', '#ffeed6']],
  Menoetius: ['craters', '双星暗红台地', ['#624a40', '#967666', '#1c1514', '#060508', '#ffeed6']],
  Chiron: ['ice', '升华冰隙高地', ['#596370', '#a9bed1', '#3b536b', '#0b1422', '#e8f4ff']],
  Chariklo: ['ice', '双环穹顶荒原', ['#555052', '#97949a', '#24252e', '#070810', '#eef2ff']],
  Pholus: ['ice', '深红有机冰原', ['#7c3c30', '#bd6f5b', '#2b1615', '#080509', '#ffe8d8']],
  Orcus: ['ice', '结晶水冰平原', ['#92a2b0', '#e4eff7', '#2e3b4a', '#070b14', '#f2f7ff']],
  Vanth: ['craters', '暗红撞击台地', ['#6b4f47', '#a27e72', '#201819', '#06060b', '#ffeedd']],
  Quaoar: ['ice', '甲烷霜冻高地', ['#8d5a4a', '#d4a18e', '#322223', '#090710', '#fff0e2']],
  Arrokoth: ['craters', '双瓣红尘颈谷', ['#7b3f30', '#c07a62', '#291716', '#07050a', '#ffe8d6']],
  Gonggong: ['ice', '赤红托林冰原', ['#853d34', '#cf8476', '#301a1c', '#09060e', '#ffece0']],
  Farfarout: ['ice', '极远冰封荒原', ['#7c8596', '#c6d1e3', '#232938', '#060812', '#eef4ff']],
  VP113: ['ice', '粉霜冰丘', ['#9d8286', '#e0cdd0', '#2d2530', '#080712', '#fff2f4']],
  Sedna: ['ice', '奥尔特赤红冻原', ['#7d3226', '#cb735a', '#2c1516', '#07050c', '#ffe6d8']],
  OF201: ['ice', '浅色裂隙盆地', ['#949499', '#e0ded8', '#282936', '#060710', '#eef1fa']],
  Leleakuhonua: ['alpine', '棕红山脊', ['#815347', '#bd9280', '#2e2020', '#09060b', '#ffe9dd']],
  FE72: ['craters', '阴影坑缘', ['#656369', '#ada8a6', '#222128', '#06060b', '#edebec']],
}
const icy: [TerrainKind, string, Palette] = [
  'ice',
  '冰质平原',
  ['#899799', '#d8e0db', '#30363f', '#080b15', '#f5f2dd'],
]
const rocky: [TerrainKind, string, Palette] = [
  'craters',
  '岩质荒原',
  ['#766f69', '#aaa49a', '#1c1c23', '#07080b', '#fff7e3'],
]
export function landscapeRegion(id: string, kind: TerrainKind, lang: Locale = locale.value): string {
  if (lang === 'en') {
    return landscapeRegionEn[id] ?? (kind === 'ice' ? 'Icy Plains' : 'Rocky Badlands')
  }
  return sites[id]?.[1] ?? (kind === 'ice' ? '冰质平原' : '岩质荒原')
}
export function landscape(id: string, name: string, lang: Locale = locale.value): Landscape {
  const [kind, , palette] =
    sites[id] ??
    ([
      'Europa',
      'Enceladus',
      'Triton',
      'Pluto',
      'Eris',
      'Haumea',
      'Makemake',
      'Ganymede',
      'Callisto',
      'Charon',
    ].includes(id)
      ? icy
      : rocky)
  let seed = 5381
  for (const c of id) seed = (Math.imul(seed, 33) ^ c.charCodeAt(0)) >>> 0
  return { id, name, kind, region: landscapeRegion(id, kind, lang), palette, seed }
}
export function rgb(hex: string) {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
export const sunDirection = [-0.51, 0.29, -0.81].map((v, _, a) => v / Math.hypot(...a))

export function isRealisticSite(site: Landscape): boolean {
  return site.id === 'Moon' || site.id === 'Mars'
}

export function landingSunDirection(site: Landscape): [number, number, number] {
  if (site.id === 'Moon') {
    // Low-angle cross-lighting (~15.5 deg) for dramatic crisp shadows AND a ~68% sunlit gibbous Earthrise!
    const raw: [number, number, number] = [-0.78, 0.27, -0.56]
    const len = Math.hypot(raw[0], raw[1], raw[2])
    return [raw[0] / len, raw[1] / len, raw[2] / len]
  }
  if (site.id === 'Mars') {
    // Low golden-hour Martian Sun (~13.8 deg) visible in upper-left sky with iconic blue-white Mie halo
    const raw: [number, number, number] = [-0.26, 0.24, -0.935]
    const len = Math.hypot(raw[0], raw[1], raw[2])
    return [raw[0] / len, raw[1] / len, raw[2] / len]
  }
  return [sunDirection[0], sunDirection[1], sunDirection[2]]
}

export interface TerrainMeta {
  /** Moon: bright ejecta / anorthosite exposure (0..1); Mars: bedrock/strata exposure (0..1) */
  exposure: number
  /** Crater rim proximity / rock clustering weight (0..1) */
  rockCluster: number
  /** Macro concavity / basin AO (0..1, 1 = open) */
  ao: number
  /** Mars ripple/dune intensity or Moon micro-regolith roughness (0..1) */
  sand: number
}

function hash2D(ix: number, iz: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function createTerrain(site: Landscape) {
  const rand = seeded(site.seed)
  const table = Float32Array.from({ length: 65536 }, rand)
  function noise(x: number, z: number) {
    const ix = Math.floor(x),
      iz = Math.floor(z)
    let u = x - ix,
      v = z - iz
    u = u * u * (3 - 2 * u)
    v = v * v * (3 - 2 * v)
    const a = (iz & 255) << 8,
      b = ((iz + 1) & 255) << 8,
      i = ix & 255,
      j = (ix + 1) & 255
    const lo = table[a + i] + u * (table[a + j] - table[a + i]),
      hi = table[b + i] + u * (table[b + j] - table[b + i])
    return lo + v * (hi - lo)
  }
  function fbm(x: number, z: number, octaves = 4) {
    let sum = 0
    let amp = 0.5
    let freq = 1
    let norm = 0
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x * freq, z * freq)
      norm += amp
      freq *= 2.04
      amp *= 0.5
    }
    return sum / norm
  }
  function crater(x: number, z: number, cell: number) {
    const cx = Math.floor(x / cell),
      cz = Math.floor(z / cell),
      hash = (cx * 31 + cz * 127) & 65535
    const r = (0.19 + table[hash] * 0.15) * cell,
      dx = (x / cell - cx - 0.43 - 0.14 * table[(hash + 43) & 65535]) * cell
    const dz = (z / cell - cz - 0.42 - 0.16 * table[(hash + 18) & 65535]) * cell,
      d2 = (dx * dx + dz * dz) / (r * r)
    if (d2 > 1.8) return 0
    const d = Math.sqrt(d2)
    return r * (0.095 * Math.exp(-((d - 0.92) ** 2) / 0.014) - 0.27 * Math.max(0, 1 - d2) ** 1.8)
  }

  // Multi-scale jittered Voronoi lunar crater layer (3x3 neighborhood prevents grid clipping).
  function lunarCraterLayer(
    x: number,
    z: number,
    cell: number,
    density: number,
    depthScale: number,
    layerSeed: number,
    outMeta?: { ejecta: number; rim: number; cavity: number },
  ) {
    const gx = Math.floor(x / cell)
    const gz = Math.floor(z / cell)
    let delta = 0
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = gx + dx
        const cz = gz + dz
        const p = hash2D(cx, cz, layerSeed)
        if (p > density) continue
        const ox = (cx + 0.16 + 0.68 * hash2D(cx, cz, layerSeed + 17)) * cell
        const oz = (cz + 0.16 + 0.68 * hash2D(cx, cz, layerSeed + 31)) * cell
        // Keep immediate landing pad gently clear of deep pits
        if (cell < 90 && ox * ox + oz * oz < (cell * 0.42 + 6) ** 2) continue
        const rNorm = 0.18 + 0.28 * hash2D(cx, cz, layerSeed + 53) ** 1.35
        const r = rNorm * cell
        const rx = x - ox
        const rz = z - oz
        const d2 = (rx * rx + rz * rz) / (r * r)
        if (d2 > 2.8) continue
        const d = Math.sqrt(d2)
        // Fresh craters have sharper rims and brighter ejecta; older craters are softened.
        const fresh = hash2D(cx, cz, layerSeed + 79)
        const depth = r * depthScale * (0.14 + 0.11 * fresh)
        const rimHeight = depth * (0.24 + 0.14 * fresh)
        if (d < 1.0) {
          // Parabolic bowl with subtly flattened floor for larger craters
          const bowl = (1 - d2) ** (1.35 + 0.35 * fresh)
          delta -= depth * bowl
          // Inner wall transition to rim
          const rim = Math.exp(-((d - 0.96) ** 2) / (0.016 + 0.024 * (1 - fresh)))
          delta += rimHeight * rim
          if (outMeta) {
            outMeta.cavity = Math.max(outMeta.cavity, bowl * (0.45 + 0.55 * fresh))
            outMeta.rim = Math.max(outMeta.rim, rim)
            outMeta.ejecta = Math.max(outMeta.ejecta, rim * (0.35 + 0.65 * fresh))
          }
        } else {
          // Raised rim decaying smoothly into surrounding ejecta apron
          const rim = Math.exp(-((d - 0.96) ** 2) / (0.022 + 0.03 * (1 - fresh)))
          const apron = Math.max(0, 1 - (d - 1.0) / 0.68) ** 2.2
          delta += rimHeight * (0.68 * rim + 0.32 * apron)
          if (outMeta) {
            outMeta.rim = Math.max(outMeta.rim, rim * 0.9 + apron * 0.35)
            outMeta.ejecta = Math.max(outMeta.ejecta, (rim * 0.75 + apron * 0.55) * (0.3 + 0.7 * fresh))
          }
        }
      }
    }
    return delta
  }

  // Hero lunar craters placed for an iconic Apollo-style vista from the landing site.
  const heroLunarCraters: [x: number, z: number, r: number, depth: number, fresh: number][] = [
    [22, -74, 30, 5.4, 0.85],
    [-46, -122, 42, 6.8, 0.55],
    [76, -185, 58, 8.6, 0.72],
    [-19, -24, 5.2, 0.92, 0.92],
    [13, -17, 3.1, 0.52, 0.82],
    [-125, -290, 96, 13.0, 0.45],
  ]

  // Asymmetric Martian layered mesas & eroded foothills inspired by Jezero Crater (Kodiak Butte) & Gale Crater
  const marsButtes: [x: number, z: number, rx: number, rz: number, peak: number, angle: number][] = [
    [-165, -340, 140, 82, 56, 0.28],
    [220, -470, 165, 96, 68, -0.22],
    [-340, -520, 185, 110, 78, 0.14],
    [45, -690, 240, 115, 84, -0.08],
    [-72, -210, 48, 28, 16.5, 0.46],
    [135, -270, 62, 36, 22.0, -0.34],
  ]

  const mesas = [
    [-130, -360, 102, 85, 53],
    [-222, -410, 64, 88, 38],
    [109, -410, 73, 83, 67],
    [193, -412, 46, 58, 45],
  ]

  function moonEval(x: number, z: number, meta?: TerrainMeta) {
    const out = meta ? { ejecta: 0, rim: 0, cavity: 0 } : undefined
    // Broad mare rolling swells (gentle, never spiky alpine ridges)
    const mareBase =
      10.5 * (fbm(x * 0.0024 + 4.1, z * 0.0024 - 2.7, 3) - 0.5) +
      3.4 * (fbm(x * 0.0095 - 1.3, z * 0.0095 + 3.4, 3) - 0.5) +
      0.55 * (noise(x * 0.045, z * 0.045) - 0.5) +
      0.11 * (noise(x * 0.18, z * 0.18) - 0.5)

    // Distant smooth lunar highland massif / basin rim (Apolo 15/17 style rounded mountains on horizon)
    const dist = Math.hypot(x, z)
    const farBlend = clamp((dist - 190) / 720, 0, 1)
    const farSmooth = farBlend * farBlend * (3 - 2 * farBlend)
    const angle = Math.atan2(z, x)
    const massifEnvelope =
      0.52 +
      0.34 * Math.sin(angle * 2.0 + 0.9) +
      0.24 * Math.cos(angle * 3.0 - 0.4) +
      0.18 * (fbm(x * 0.0012 + 12.0, z * 0.0012 - 8.0, 3) - 0.35)
    const highlandWave = fbm(x * 0.0019 + 5.7, z * 0.0019 + 2.1, 4)
    const roundedPeaks = Math.max(0, highlandWave - 0.28) ** 1.35 * 145
    const distantMountains = farSmooth * Math.max(0, massifEnvelope) * roundedPeaks

    // 4-tier overlapping multi-scale impact craters
    let cratersY =
      lunarCraterLayer(x, z, 340, 0.72, 0.92, site.seed + 101, out) +
      lunarCraterLayer(x, z, 118, 0.68, 0.96, site.seed + 211, out) +
      lunarCraterLayer(x, z, 36, 0.64, 0.98, site.seed + 307, out) +
      lunarCraterLayer(x, z, 12, 0.55, 0.95, site.seed + 409, out)

    // Hero craters in the landing vista
    for (const [cx, cz, r, depth, fresh] of heroLunarCraters) {
      const dx = x - cx
      const dz = z - cz
      const d2 = (dx * dx + dz * dz) / (r * r)
      if (d2 > 2.9) continue
      const d = Math.sqrt(d2)
      const rimH = depth * (0.24 + 0.12 * fresh)
      if (d < 1.0) {
        const bowl = (1 - d2) ** (1.4 + 0.3 * fresh)
        const rim = Math.exp(-((d - 0.96) ** 2) / 0.017)
        cratersY += rimH * rim - depth * bowl
        if (out) {
          out.cavity = Math.max(out.cavity, bowl * 0.9)
          out.rim = Math.max(out.rim, rim)
          out.ejecta = Math.max(out.ejecta, rim * fresh)
        }
      } else {
        const rim = Math.exp(-((d - 0.96) ** 2) / 0.026)
        const apron = Math.max(0, 1 - (d - 1.0) / 0.72) ** 2.1
        cratersY += rimH * (0.68 * rim + 0.32 * apron)
        if (out) {
          out.rim = Math.max(out.rim, rim * 0.95 + apron * 0.4)
          out.ejecta = Math.max(out.ejecta, (rim * 0.8 + apron * 0.55) * fresh)
        }
      }
    }

    const y = mareBase + distantMountains + cratersY
    if (meta && out) {
      const highlandTint = clamp((y - 26) / 72, 0, 1) * 0.65
      meta.exposure = clamp(out.ejecta * 0.85 + highlandTint, 0, 1)
      meta.rockCluster = clamp(out.rim * 0.9 + farSmooth * 0.2, 0, 1)
      meta.ao = clamp(1 - out.cavity * 0.42, 0.52, 1)
      meta.sand = clamp(0.45 + 0.55 * noise(x * 0.032, z * 0.032), 0, 1)
    }
    return y
  }

  function marsEval(x: number, z: number, meta?: TerrainMeta) {
    const nLarge = fbm(x * 0.0038 + 2.3, z * 0.0038 - 1.9, 4)
    const nMed = fbm(x * 0.015 - 3.1, z * 0.015 + 4.2, 3)
    const nFine = noise(x * 0.062, z * 0.062)

    // Wide ancient lakebed / alluvial plain with gentle wind-carved swales
    const dist = Math.hypot(x, z)
    const swale = (fbm(x * 0.0075 + 6.1, z * 0.0055 - 3.4, 3) - 0.5) * 4.8
    let y =
      4.6 * (nLarge - 0.46) +
      1.15 * (nMed - 0.5) +
      0.18 * (nFine - 0.5) +
      swale * clamp(dist / 65, 0, 1)

    // Distant Martian crater rim mountains on the far horizon (low, rugged, multi-layered)
    const rimSpread = clamp((dist - 290) / 880, 0, 1)
    const rimSmooth = rimSpread * rimSpread * (3 - 2 * rimSpread)
    const ridgeNoise = 1 - Math.abs(2 * fbm(x * 0.0017 + 0.22 * nMed, z * 0.0020 - 4.2, 4) - 1)
    const craterRimWall = rimSmooth * (22 + 108 * ridgeNoise ** 1.75) * (0.42 + 0.58 * nLarge)
    y += craterRimWall

    // Rugged eroded Martian mesas & buttes with carved gullies, angular talus slopes, and smooth flat caprock
    let butteExposure = 0
    let talusCluster = 0
    for (const [mx, mz, rx, rz, peak, ang] of marsButtes) {
      const dx = x - mx
      const dz = z - mz
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      const lx = (dx * ca - dz * sa) / rx
      const lz = (dx * sa + dz * ca) / rz
      const radial = Math.hypot(lx, lz)
      if (radial > 2.35) continue
      // Radial erosion gullies & rocky spurs so mesas look geologically fractured instead of rounded blobs
      const az = Math.atan2(lz, lx)
      const spur =
        0.13 * Math.sin(az * 5.0 + mx * 0.03) +
        0.08 * Math.cos(az * 9.0 - mz * 0.04) +
        0.05 * Math.sin(az * 15.0 + nMed * 3.0)
      const warp = 0.26 * (nLarge - 0.5) + 0.14 * (nMed - 0.5) + spur
      const d = radial + warp
      if (d < 1.95) {
        // Broad scree/talus debris fan tapering smoothly into the basin plain
        const apron = Math.max(0, 1 - d / 1.95) ** 2.1
        // Rugged cliff wall rising to a flat wind-scoured caprock plateau
        const wallRaw = clamp((1.05 - d) / 0.42, 0, 1)
        const wallSmooth = wallRaw * wallRaw * (3 - 2 * wallRaw)
        const gullyCarve = 1.0 - 0.14 * (1 - wallSmooth) * wallSmooth * 4.0 * Math.abs(Math.sin(az * 11.0 + nMed * 4.0))
        y += peak * (0.74 * wallSmooth * gullyCarve + 0.26 * apron)
        const onCliff = wallSmooth > 0.04 && wallSmooth < 0.96 ? 1 : 0
        butteExposure = Math.max(butteExposure, onCliff * 0.95 + (wallSmooth >= 0.96 ? 0.52 : 0))
        talusCluster = Math.max(talusCluster, apron * (1 - wallSmooth * 0.65))
      }
    }

    // Eroded ancient shallow impact craters on the Martian basin floor
    const oldCrater = lunarCraterLayer(x + 48, z - 31, 165, 0.42, 0.30, site.seed + 521)
    y += oldCrater

    // Subtle organic, patchy wind-drift sand beds (NO rigid parallel stripes!)
    const driftPatch = clamp(1 - butteExposure * 1.5, 0, 1) * clamp((fbm(x * 0.022 + 1.5, z * 0.022 - 2.2, 2) - 0.36) * 2.4, 0, 1)
    const warpX = x + 14.0 * (nMed - 0.5)
    const warpZ = z + 14.0 * (fbm(x * 0.018 + 7.2, z * 0.018 - 4.1, 2) - 0.5)
    const dunePhase = warpZ * 0.28 + warpX * 0.15
    const dune = Math.sin(dunePhase) + 0.22 * Math.sin(dunePhase * 2.0 - 0.5)
    y += 0.14 * dune * driftPatch

    // Low fractured sedimentary bedrock benches protruding softly from basin regolith
    const slabNoise = fbm(x * 0.036 + 8.4, z * 0.036 - 5.1, 2)
    const bedrockOutcrop = clamp((slabNoise - 0.60) * 4.2, 0, 1) * (1 - driftPatch * 0.7)
    y += bedrockOutcrop * 0.26

    if (meta) {
      meta.exposure = clamp(butteExposure + bedrockOutcrop * 0.78 + clamp((craterRimWall - 16) / 65, 0, 0.8), 0, 1)
      meta.rockCluster = clamp(talusCluster * 0.95 + bedrockOutcrop * 0.8 + 0.26, 0, 1)
      meta.ao = clamp(1 - Math.max(0, -oldCrater) * 0.06, 0.64, 1)
      meta.sand = clamp(driftPatch, 0, 1)
    }
    return y
  }

  function sampleMeta(x: number, z: number): TerrainMeta {
    const meta: TerrainMeta = { exposure: 0, rockCluster: 0.2, ao: 1, sand: 0 }
    if (site.id === 'Moon') moonEval(x, z, meta)
    else if (site.id === 'Mars') marsEval(x, z, meta)
    return meta
  }

  function height(x: number, z: number) {
    if (site.id === 'Moon') return moonEval(x, z)
    if (site.id === 'Mars') return marsEval(x, z)
    const n = noise(x * 0.011, z * 0.011),
      fine = noise(x * 0.054, z * 0.054)
    if (site.kind === 'cloud') {
      const flow = noise(x * 0.0028, z * 0.005) * 51
      return (
        38 * n +
        17 * noise((x + flow) * 0.03, z * 0.021) +
        5 * fine +
        66 * noise(x * 0.003, z * 0.004)
      )
    }
    const spread = clamp((Math.hypot(x, z) - 70) / 540, 0, 1)
    const horizon = spread * spread * (3 - 2 * spread)
    const ridge =
      1 - Math.abs(2 * noise(x * 0.0028 + 0.18 * noise(x * 0.01, z * 0.01), z * 0.0034) - 1)
    const hills =
      (site.kind === 'alpine' ? 117 : site.kind === 'craters' ? 63 : 135) *
      ridge ** 3 *
      horizon *
      horizon
    const rangeLine = z + 200 + 44 * Math.sin(x * 0.012) + 31 * noise(x * 0.018, 1)
    const escarpment =
      (site.kind === 'alpine' ? 24 : site.kind === 'dust' ? 46 : 19) *
      Math.exp(-(rangeLine ** 2) / 7200) *
      (0.45 + 0.55 * n)
    let y = hills + escarpment + 8 * n + 1.4 * fine + 0.18 * noise(x * 0.21, z * 0.21)
    if (site.kind === 'dust') {
      // Wind-eroded mesas have steep flanks, broken caprock and a broad apron of debris.
      for (const [mx, mz, rx, rz, peak] of mesas) {
        const d = Math.hypot((x - mx) / rx, (z - mz) / rz) + 0.16 * (n - 0.5) + 0.06 * (fine - 0.5)
        if (d < 1.6) {
          const wall = clamp((1.1 - d) / 0.4, 0, 1)
          y += peak * (0.8 * wall * wall * (3 - 2 * wall) + 0.2 * Math.max(0, 1 - d / 1.6) ** 1.2)
        }
      }
    }
    if (site.kind === 'alpine') {
      const crest = z + 625 + 95 * Math.sin(x * 0.009) + 52 * noise(x * 0.013, 17)
      const summit =
        57 + 99 * (1 - Math.abs(2 * noise(x * 0.006, 19) - 1)) + 28 * noise(x * 0.023, 17)
      y += summit * Math.exp(-Math.abs(crest) / (115 + 45 * n)) * horizon
    }
    if (site.kind === 'craters') {
      const d = Math.hypot(x - 26, z + 112) / 58
      if (d < 1.45)
        y += 6 * Math.exp(-((d - 0.95) ** 2) / 0.017) - 12 * Math.max(1 - d * d, 0) ** 1.6
    }
    if (site.kind === 'craters' || site.kind === 'ice')
      y += crater(x + 33, z + 47, 96) + crater(x + 8, z + 13, 26)
    if (site.kind === 'dust') y += 0.34 * Math.sin(z * 0.35 + n * 6) * fine
    return y
  }
  return { noise, fbm, height, sampleMeta }
}
export type Terrain = ReturnType<typeof createTerrain>
