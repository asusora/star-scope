import { clamp, seeded } from '../math'

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
  Mars: ['dust', '风蚀台地', ['#a86643', '#dd9c6e', '#dfad86', '#846b67', '#fff0cc']],
  Earth: ['alpine', '高山砾原', ['#716f4b', '#a0a78a', '#c1d5d8', '#356b9c', '#ffedc2']],
  Moon: ['craters', '月海撞击坑', ['#858583', '#b2ada6', '#19191c', '#050609', '#fff9e2']],
  Mercury: ['craters', '撞击盆地', ['#766b62', '#b1a290', '#201e21', '#07070a', '#fff2ce']],
  Venus: ['lava', '玄武岩高地', ['#79502f', '#bd8b48', '#c89950', '#97703e', '#ffdd85']],
  Jupiter: ['cloud', '云带上空', ['#a27863', '#f6e2ba', '#e7c6a4', '#725f67', '#fff0cc']],
  Saturn: ['cloud', '高层云海', ['#a99169', '#f6e8be', '#e4cc9c', '#83765f', '#fff5d4']],
  Uranus: ['cloud', '高层云海', ['#53878d', '#cae6dc', '#a0ceca', '#426779', '#e6f7f6']],
  Neptune: ['cloud', '高层云海', ['#455e96', '#bfd4e6', '#9eb7d9', '#38466d', '#f3f4ff']],
  Io: ['lava', '火山平原', ['#98823f', '#c9b772', '#2c2821', '#07080a', '#fff8dc']],
  Titan: ['ice', '冰质丘陵', ['#856b4c', '#c4a276', '#c69b63', '#846947', '#ffdeb0']],
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
export function landscape(id: string, name: string): Landscape {
  const [kind, region, palette] =
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
  return { id, name, kind, region, palette, seed }
}
export function rgb(hex: string) {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
export const sunDirection = [-0.51, 0.29, -0.81].map((v, _, a) => v / Math.hypot(...a))
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
  const mesas = [
    [-130, -360, 102, 85, 53],
    [-222, -410, 64, 88, 38],
    [109, -410, 73, 83, 67],
    [193, -412, 46, 58, 45],
  ]
  function height(x: number, z: number) {
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
  return { noise, height }
}
export type Terrain = ReturnType<typeof createTerrain>
