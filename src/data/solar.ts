import rawCatalog from './moons.json'
import { Moon, World, type MoonRecord } from '../scene/types'
import { rad } from '../scene/math'
const catalog: Record<string, MoonRecord[]> = rawCatalog
export const declinations: Record<string, number> = {
  Mercury: 0.034,
  Venus: 177.36,
  Earth: 23.44,
  Mars: 25.19,
  Jupiter: 3.13,
  Saturn: 26.73,
  Uranus: 97.77,
  Neptune: 28.32,
}
export const featured: Record<string, string[]> = {
  Mercury: [],
  Venus: [],
  Earth: ['Moon'],
  Mars: ['Phobos', 'Deimos'],
  Jupiter: ['Io', 'Europa', 'Ganymede', 'Callisto'],
  Saturn: ['Titan', 'Enceladus', 'Rhea', 'Iapetus', 'Dione', 'Tethys', 'Mimas'],
  Uranus: ['Titania', 'Oberon', 'Ariel', 'Umbriel', 'Miranda'],
  Neptune: ['Triton', 'Proteus', 'Nereid'],
}
export function createSolarSystem() {
  const planets = (
    [
      ['Mercury', '水星', 15, 0.98, 87.97, 130, 0.206, 7.0, 48],
      ['Venus', '金星', 23, 1.52, 224.7, 232, 0.007, 3.39, 77],
      ['Earth', '地球', 34, 1.82, 365.26, 32, 0.017, 0, 0],
      ['Mars', '火星', 45, 1.37, 686.98, 172, 0.093, 1.85, 49],
      ['Jupiter', '木星', 68, 6.18, 4332.6, 338, 0.049, 1.3, 100],
      ['Saturn', '土星', 91, 5.55, 10759, 225, 0.054, 2.49, 113],
      ['Uranus', '天王星', 112, 3.1, 30687, 151, 0.047, 0.77, 74],
      ['Neptune', '海王星', 134, 3.0, 60190, 67, 0.009, 1.77, 132],
    ] as const
  ).map(
    ([id, name, a, r, days, phase, e, inc, node]) =>
      new World({ id, name, a, r, days, phase: phase * rad, e, inc, node }, catalog[id]),
  )
  // Bound the entire planet + satellite system, including the far edge of each
  // moon at apoapsis. Adjacent heliocentric shells must be disjoint at all phases.
  const systemRadii: Record<string, number> = {
    Earth: 2.9,
    Mars: 2.7,
    Jupiter: 2.9,
    Saturn: 3.9,
    Uranus: 2.9,
    Neptune: 2.9,
    Pluto: 4.2,
    Haumea: 3.5,
    Makemake: 3.5,
    Eris: 3.5,
  }
  const systemRadius = (id: string, r: number) => r * (systemRadii[id] || 1)
  for (const [i, p] of planets.entries()) {
    p.extent = systemRadius(p.id, p.r)
    if (!i) continue
    const prev = planets[i - 1],
      gap = p.id === 'Jupiter' ? 19 : 2.25
    const minPeri = prev.a * (1 + prev.e) + prev.extent + gap + p.extent
    p.a = Math.max(p.a, minPeri / (1 - p.e))
  }
  const mars = planets[3],
    jupiter = planets[4],
    neptune = planets[7]
  const mainBand = {
    inner: mars.a * (1 + mars.e) + mars.extent + 1,
    outer: jupiter.a * (1 - jupiter.e) - jupiter.extent - 1,
  }
  const kuiperInner = neptune.a * (1 + neptune.e) + neptune.extent + 2
  const outerBand = { inner: kuiperInner, outer: kuiperInner + 41 }
  const bandMid = (band: { inner: number; outer: number }) => (band.inner + band.outer) / 2
  const smallOrbits = {
    Pluto: { a: 39.48, e: 0.249, i: 17.14, om: 110.3, w: 113.8, per: 90560 },
    Ceres: { e: 0.0797, a: 2.77, i: 10.6, om: 80.2, w: 73.3, per: 1680.0 },
    Eris: { e: 0.438, a: 67.9, i: 43.9, om: 36.0, w: 151.0, per: 205000.0 },
    Haumea: { e: 0.194, a: 43.1, i: 28.2, om: 122.0, w: 241.0, per: 103000.0 },
    Hygiea: { e: 0.107, a: 3.15, i: 3.83, om: 283.0, w: 312.0, per: 2040.0 },
    Juno: { e: 0.256, a: 2.67, i: 13.0, om: 170.0, w: 248.0, per: 1590.0 },
    Makemake: { e: 0.159, a: 45.6, i: 29.0, om: 79.3, w: 297.0, per: 112000.0 },
    Pallas: { e: 0.231, a: 2.77, i: 34.9, om: 173.0, w: 311.0, per: 1680.0 },
    Vesta: { e: 0.0902, a: 2.36, i: 7.14, om: 104.0, w: 151.0, per: 1330.0 },
  }
  const smallBodies = (
    [
      ['Pluto', '冥王星', 'outer', 1.2, 72],
      ['Haumea', '妊神星', 'outer', 0.89, 190],
      ['Makemake', '鸟神星', 'outer', 0.84, 318],
      ['Eris', '阋神星', 'outer', 1.15, 235],
      ['Ceres', '谷神星', 'main', 0.8, 138],
      ['Vesta', '灶神星', 'main', 0.58, 45],
      ['Pallas', '智神星', 'main', 0.55, 250],
      ['Juno', '婚神星', 'main', 0.39, 320],
      ['Hygiea', '健神星', 'main', 0.47, 100],
    ] as const
  ).map(([id, name, region, r, phase]) => {
    const o = smallOrbits[id],
      outer = region === 'outer',
      slope = outer ? 2.15 : 6.25
    const a = outer
      ? outerBand.inner + (o.a - 30.07) * slope
      : bandMid(mainBand) + (o.a - 2.77) * slope
    const extent = systemRadius(id, r),
      band = outer ? outerBand : mainBand
    const maxExcursion = outer
      ? a - band.inner - extent
      : Math.min(a - band.inner, band.outer - a) - extent
    const e = Math.min(o.e * o.a * slope, Math.max(0, maxExcursion)) / a
    const world = new World(
      {
        id,
        name,
        region,
        r,
        phase: phase * rad,
        a,
        e,
        inc: o.i,
        node: o.om,
        peri: o.w,
        au: o.a,
        days: o.per,
        kind: outer || id === 'Ceres' ? '矮行星' : '小行星',
        source:
          outer || id === 'Ceres'
            ? 'https://science.nasa.gov/dwarf-planets/' + id.toLowerCase() + '/'
            : 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=' + id,
      },
      catalog[id] || [],
    )
    world.extent = extent
    return world
  })
  const worlds = [...planets, ...smallBodies]
  return { planets, smallBodies, worlds, mainBand, outerBand, bandMid }
}
const moonAliases: Record<string, string[]> = {
  Moon: ['月球', '月亮', '太阴', 'Luna'],
  Io: ['伊奥', '艾奥', '伊娥'],
  Europa: ['欧罗巴', '欧罗帕'],
  Ganymede: ['盖尼米德', '加尼米德', '甘尼米德'],
  Callisto: ['卡利斯托', '卡莉斯托'],
  Amalthea: ['阿玛尔忒亚', '阿马尔忒亚'],
  Titan: ['泰坦', '泰坦星', '提坦'],
  Enceladus: ['恩克拉多斯', '恩塞拉杜斯'],
  Rhea: ['瑞亚', '雷亚'],
  Dione: ['狄俄涅', '狄俄尼'],
  Tethys: ['忒堤斯', '特提斯', '泰西斯'],
  Mimas: ['弥玛斯', '米玛斯'],
  Iapetus: ['伊阿珀托斯', '伊阿佩托斯'],
  Hyperion: ['许珀里翁', '海伯利安'],
  Phoebe: ['菲比'],
  Phobos: ['福波斯', '弗伯斯'],
  Deimos: ['德摩斯', '得摩斯', '德莫斯'],
  Triton: ['特里同', '崔顿'],
  Nereid: ['涅瑞伊得', '奈瑞德'],
  Proteus: ['普罗透斯'],
  Ariel: ['艾瑞尔', '爱丽儿'],
  Umbriel: ['乌姆布里尔'],
  Titania: ['泰坦妮娅', '提泰妮娅'],
  Oberon: ['奥伯龙'],
  Miranda: ['米兰达'],
  Charon: ['卡戎', '卡隆'],
  Styx: ['斯堤克斯'],
  Nix: ['尼克斯'],
  Kerberos: ['刻耳柏洛斯', '科伯洛斯'],
  Hydra: ['许德拉', '海德拉'],
  Hiʻiaka: ['希亚卡', "Hi'iaka", 'Hiiaka'],
  Namaka: ['纳马卡'],
  Dysnomia: ['迪丝诺美亚', '阋卫一'],
  'MK 2': ['MK 2', '鸟卫一', 'MK2'],
}
function chineseNumber(n: number): string {
  const digits = '零一二三四五六七八九'
  if (n < 10) return digits[n]
  if (n < 100)
    return (n < 20 ? '' : digits[Math.floor(n / 10)]) + '十' + (n % 10 ? digits[n % 10] : '')
  return (
    digits[Math.floor(n / 100)] +
    '百' +
    (n % 100 ? (n % 100 < 10 ? '零' : n % 100 < 20 ? '一' : '') + chineseNumber(n % 100) : '')
  )
}
export function assignMoonNames(p: World, m: Moon) {
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500 }
  const n = [...(m.num || '')].reduce(
    (sum, c, i) => sum + (values[c] < (values[m.num?.[i + 1] || ''] || 0) ? -values[c] : values[c]),
    0,
  )
  const prefixes: Record<string, string> = {
    Mars: '火',
    Jupiter: '木',
    Saturn: '土',
    Uranus: '天',
    Neptune: '海',
    Pluto: '冥',
    Eris: '阋',
    Haumea: '妊',
  }
  const prefix = prefixes[p.id]
  m.numberName = n && prefix ? prefix + '卫' + chineseNumber(n) : ''
  m.label = moonAliases[m.name]?.[0] || m.name
  m.otherNames = [
    ...new Set(
      [m.name, m.numberName, m.des, ...(moonAliases[m.name] || [])].filter(
        (s): s is string => !!s && s !== m.label,
      ),
    ),
  ]
  m.searchNames = [m.label, ...m.otherNames, m.num || '', n && prefix ? prefix + '卫' + n : '']
}
