import rawCatalog from './moons.json'
import { Moon, World, type Belt, type MoonRecord } from '../scene/types'
import { rad } from '../scene/math'

const catalog: Record<string, MoonRecord[]> = rawCatalog

export const INNER_OORT_START_AU = 2_000
export const OUTER_OORT_START_AU = 20_000
export const LIGHT_YEAR_AU = 63_241.077
export const OUTER_OORT_CORE_AU = 100_000
export const HILL_SPHERE_AU = 150_000
export const PROXIMA_RA_DEG = 217.4289
export const PROXIMA_DEC_DEG = -62.6795
export const PROXIMA_DISTANCE_LY = 4.246

export const declinations: Record<string, number> = {
  Mercury: 0.034,
  Venus: 177.36,
  Earth: 23.44,
  Mars: 25.19,
  Jupiter: 3.13,
  Saturn: 26.73,
  Uranus: 97.77,
  Neptune: 28.32,
  Pluto: 119.6,
  Orcus: 22.0,
  Haumea: 28.2,
  Quaoar: 14.0,
  Arrokoth: 98.0,
  Makemake: 29.0,
  Gonggong: 30.5,
  Eris: 78.0,
  Farfarout: 18.0,
  VP113: 24.0,
  Sedna: 25.0,
  Chiron: 32.0,
  Chariklo: 38.0,
  Pholus: 24.0,
  Psyche: 95.0,
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

interface SmallOrbitRecord {
  a: number
  e: number
  i: number
  om: number
  w: number
  per: number
  code: string
  kind: string
  discovered: string
  source: string
  summary: string
  lagrangeDeg?: number
  prominent?: boolean
}

export function createSolarSystem() {
  const planets = (
    [
      ['Mercury', '水星', 15, 0.98, 87.97, 130, 0.206, 7.0, 48, '自古已知'],
      ['Venus', '金星', 23, 1.52, 224.7, 232, 0.007, 3.39, 77, '自古已知'],
      ['Earth', '地球', 34, 1.82, 365.26, 32, 0.017, 0, 0, '自古已知'],
      ['Mars', '火星', 45, 1.37, 686.98, 172, 0.093, 1.85, 49, '自古已知'],
      ['Jupiter', '木星', 68, 6.18, 4332.6, 338, 0.049, 1.3, 100, '自古已知'],
      ['Saturn', '土星', 91, 5.55, 10759, 225, 0.054, 2.49, 113, '自古已知'],
      ['Uranus', '天王星', 112, 3.1, 30687, 151, 0.047, 0.77, 74, '1781 年'],
      ['Neptune', '海王星', 134, 3.0, 60190, 67, 0.009, 1.77, 132, '1846 年'],
    ] as const
  ).map(
    ([id, name, a, r, days, phase, e, inc, node, discovered]) =>
      new World({ id, name, a, r, days, phase: phase * rad, e, inc, node, discovered }, catalog[id]),
  )

  // Bound the entire planet + satellite/ring system, including moon apoapsis.
  // Adjacent heliocentric shells remain disjoint at all orbital phases.
  const systemRadii: Record<string, number> = {
    Earth: 2.9,
    Mars: 2.7,
    Jupiter: 2.9,
    Saturn: 3.9,
    Uranus: 2.9,
    Neptune: 2.9,
    Eurybates: 3.0,
    Patroclus: 3.4,
    Chiron: 3.0,
    Chariklo: 2.7,
    Pluto: 4.2,
    Orcus: 3.8,
    Haumea: 3.5,
    Quaoar: 4.8,
    Makemake: 3.5,
    Gonggong: 3.8,
    Eris: 3.6,
  }
  const systemRadius = (id: string, r: number) => r * (systemRadii[id] || 1.3)

  // Preserve clear interplanetary corridors for real belts:
  // Mars-Jupiter (Main Belt + Hilda 3:2), Jupiter-Saturn, Saturn-Uranus & Uranus-Neptune (Centaurs).
  const interplanetaryGaps: Record<string, number> = {
    Jupiter: 28,
    Saturn: 8,
    Uranus: 18,
    Neptune: 12,
  }
  for (const [i, p] of planets.entries()) {
    p.extent = systemRadius(p.id, p.r)
    if (!i) continue
    const prev = planets[i - 1],
      gap = interplanetaryGaps[p.id] ?? 2.25
    const minPeri = prev.a * (1 + prev.e) + prev.extent + gap + p.extent
    p.a = Math.max(p.a, minPeri / (1 - p.e))
  }

  const mars = planets[3],
    jupiter = planets[4],
    saturn = planets[5],
    uranus = planets[6],
    neptune = planets[7]

  const mainBand = {
    inner: mars.a * (1 + mars.e) + mars.extent + 1.2,
    outer: jupiter.a * (1 - jupiter.e) - jupiter.extent - 7.5,
  }
  const hildaBand = {
    inner: mainBand.outer + 1.2,
    outer: jupiter.a * (1 - jupiter.e) - jupiter.extent - 1.2,
  }
  const centaurBands = {
    jupSat: {
      inner: jupiter.a * (1 + jupiter.e) + jupiter.extent + 1.0,
      outer: saturn.a * (1 - saturn.e) - saturn.extent - 1.0,
    },
    satUra: {
      inner: saturn.a * (1 + saturn.e) + saturn.extent + 1.2,
      outer: uranus.a * (1 - uranus.e) - uranus.extent - 1.2,
    },
    uraNep: {
      inner: uranus.a * (1 + uranus.e) + uranus.extent + 1.2,
      outer: neptune.a * (1 - neptune.e) - neptune.extent - 1.2,
    },
    full: {
      inner: jupiter.a * (1 + jupiter.e) + jupiter.extent + 1.0,
      outer: neptune.a * (1 - neptune.e) - neptune.extent - 1.2,
    },
  }
  const kuiperInner = neptune.a * (1 + neptune.e) + neptune.extent + 3
  const outerBand = { inner: kuiperInner, outer: kuiperInner + 56 }
  const scatteredBand = { inner: outerBand.outer, outer: outerBand.outer + 92 }
  const bandMid = (band: { inner: number; outer: number }) => (band.inner + band.outer) / 2

  const kuiperSlope = (outerBand.outer - outerBand.inner) / (50 - 30.07)
  const mapOuterAU = (au: number) =>
    au <= 50
      ? outerBand.inner + (au - 30.07) * kuiperSlope
      : outerBand.outer + Math.log(au / 50) * 86

  const sbdb = 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr='

  const smallOrbits: Record<string, SmallOrbitRecord> = {
    // ── Main Asteroid Belt (Mars ↔ Jupiter, 2.1–3.3 AU) ──
    Ceres: {
      a: 2.77,
      e: 0.0797,
      i: 10.6,
      om: 80.2,
      w: 73.3,
      per: 1680.0,
      code: '1 Ceres',
      kind: '矮行星',
      discovered: '1801 年',
      source: 'https://science.nasa.gov/dwarf-planets/ceres/',
      summary: '主小行星带最大的天体，也是内太阳系唯一的矮行星。黎明号探测揭示了奥卡托坑内明亮的碳酸钠盐穹与阿胡纳冰火山。',
      prominent: true,
    },
    Vesta: {
      a: 2.36,
      e: 0.0902,
      i: 7.14,
      om: 104.0,
      w: 151.0,
      per: 1330.0,
      code: '4 Vesta',
      kind: '原行星小行星',
      discovered: '1807 年',
      source: 'https://science.nasa.gov/solar-system/asteroids/4-vesta/',
      summary: '主带第二大质量天体。黎明号测绘了其南极巨大的雷亚希尔维亚撞击盆地、22 千米高中央峰与赤道槽沟群。',
    },
    Pallas: {
      a: 2.77,
      e: 0.231,
      i: 34.9,
      om: 173.0,
      w: 311.0,
      per: 1680.0,
      code: '2 Pallas',
      kind: '小行星',
      discovered: '1802 年',
      source: sbdb + 'Pallas',
      summary: '高倾角大型主带小行星。甚大望远镜高分辨率成像显示其布满密集撞击坑，外观宛如饱经撞击的高尔夫球。',
    },
    Juno: {
      a: 2.67,
      e: 0.256,
      i: 13.0,
      om: 170.0,
      w: 248.0,
      per: 1590.0,
      code: '3 Juno',
      kind: '小行星',
      discovered: '1804 年',
      source: sbdb + 'Juno',
      summary: '较大的石质 S 型主带小行星，表面保留着一座跨度约 100 千米的近期大型撞击坑。',
    },
    Hygiea: {
      a: 3.15,
      e: 0.107,
      i: 3.83,
      om: 283.0,
      w: 312.0,
      per: 2040.0,
      code: '10 Hygiea',
      kind: '碳质小行星',
      discovered: '1849 年',
      source: sbdb + 'Hygiea',
      summary: '主带第四大天体，表面漆黑富含碳质物质。甚大望远镜观测表明其外形近乎球体，是潜在矮行星候选体。',
    },
    Psyche: {
      a: 2.923,
      e: 0.1339,
      i: 3.1,
      om: 150.0,
      w: 229.6,
      per: 1825.6,
      code: '16 Psyche',
      kind: '金属小行星',
      discovered: '1852 年',
      source: 'https://science.nasa.gov/mission/psyche/',
      summary: 'NASA 灵神星号探测目标，富含铁镍金属与硅酸盐岩石，被视为太阳系早期原行星裸露的金属核残骸。',
      prominent: true,
    },

    // ── Jupiter Trojans (5.2 AU, L4 Greek Camp & L5 Trojan Camp) ──
    Eurybates: {
      a: 5.202,
      e: 0.089,
      i: 8.06,
      om: 43.6,
      w: 27.3,
      per: 4332.6,
      code: '3548 Eurybates',
      kind: '特洛伊小行星',
      discovered: '1973 年',
      source: 'https://science.nasa.gov/mission/lucy/',
      summary: '位于木星轨道前方 60° 的 L4 希腊营，是 NASA 露西号的首颗特洛伊探测目标，哈勃为其发现了卫星奎塔。',
      lagrangeDeg: 60,
    },
    Patroclus: {
      a: 5.211,
      e: 0.139,
      i: 22.05,
      om: 44.3,
      w: 308.1,
      per: 4332.6,
      code: '617 Patroclus',
      kind: '特洛伊双星',
      discovered: '1906 年',
      source: 'https://science.nasa.gov/mission/lucy/',
      summary: '位于木星后方 60° 的 L5 特洛伊营，与尺寸相近的伴星墨诺提俄斯组成几乎等大的原始暗红冰岩双星，是露西号核心目标。',
      lagrangeDeg: -60,
      prominent: true,
    },

    // ── Centaurs (Between Jupiter, Saturn, Uranus & Neptune, 5.5–30 AU) ──
    Chiron: {
      a: 13.65,
      e: 0.379,
      i: 6.93,
      om: 209.2,
      w: 339.6,
      per: 18426.0,
      code: '2060 Chiron · 95P',
      kind: '半人马天体',
      discovered: '1977 年',
      source: sbdb + '2060',
      summary: '运行在土星与天王星轨道之间的首颗半人马天体，同时具有彗星编号 95P。韦布望远镜检出其表面的水冰、甲烷与二氧化碳，恒星掩星还揭示了演化中的环盘与微弱彗发。',
      prominent: true,
    },
    Chariklo: {
      a: 15.78,
      e: 0.172,
      i: 23.38,
      om: 300.4,
      w: 242.1,
      per: 22960.0,
      code: '10199 Chariklo',
      kind: '环带半人马天体',
      discovered: '1997 年',
      source: sbdb + '10199',
      summary: '土星与天王星之间已知最大的半人马天体，也是太阳系首颗被证实拥有致密双冰环的小天体（奥亚波克环与舒伊环），韦布望远镜在环中确认了结晶水冰。',
      prominent: true,
    },
    Pholus: {
      a: 20.32,
      e: 0.572,
      i: 24.69,
      om: 119.4,
      w: 354.8,
      per: 33450.0,
      code: '5145 Pholus',
      kind: '半人马天体',
      discovered: '1992 年',
      source: sbdb + '5145',
      summary: '穿梭于巨行星轨道间的极红半人马天体，表面覆盖受长期辐射演化的有机托林与甲醇冰，色泽深红。',
    },

    // ── Kuiper Belt (Beyond Neptune, 30–50 AU) ──
    Pluto: {
      a: 39.48,
      e: 0.249,
      i: 17.14,
      om: 110.3,
      w: 113.8,
      per: 90560.0,
      code: '134340 Pluto',
      kind: '矮行星',
      discovered: '1930 年',
      source: 'https://science.nasa.gov/dwarf-planets/pluto/',
      summary: '柯伊伯带代表性矮行星。新视野号飞掠揭示了心形的汤博区氮冰平原、克苏鲁暗红赤道带、稀薄蓝霾大气与五颗卫星。',
      prominent: true,
    },
    Orcus: {
      a: 39.42,
      e: 0.22,
      i: 20.58,
      om: 268.7,
      w: 72.6,
      per: 90400.0,
      code: '90482 Orcus',
      kind: '矮行星候选',
      discovered: '2004 年',
      source: sbdb + '90482',
      summary: '与海王星呈 3:2 共振且相位常与冥王星相反，被称为“反冥王星”。光谱显示其覆盖明亮的结晶水冰与氨水合物，伴有一颗暗红色的大卫星亡卫一。',
      prominent: true,
    },
    Haumea: {
      a: 43.1,
      e: 0.194,
      i: 28.2,
      om: 122.0,
      w: 241.0,
      per: 103000.0,
      code: '136108 Haumea',
      kind: '矮行星',
      discovered: '2004 年',
      source: 'https://science.nasa.gov/dwarf-planets/haumea/',
      summary: '仅约 3.9 小时极速自转的柯伊伯带矮行星，因离心力被拉成三轴椭球体，拥有纯净结晶水冰表层、暗红斑、细窄光环与两颗卫星。',
      prominent: true,
    },
    Quaoar: {
      a: 43.69,
      e: 0.041,
      i: 7.99,
      om: 188.9,
      w: 151.3,
      per: 105480.0,
      code: '50000 Quaoar',
      kind: '矮行星',
      discovered: '2002 年',
      source: sbdb + '50000',
      summary: '经典柯伊伯带大型矮行星。2023 年掩星与 CHEOPS 望远镜震撼发现它在远超洛希极限处拥有两条致密冰环，外侧还运行着卫星创卫一。',
      prominent: true,
    },
    Arrokoth: {
      a: 44.58,
      e: 0.042,
      i: 2.45,
      om: 159.0,
      w: 174.4,
      per: 108700.0,
      code: '486958 Arrokoth',
      kind: '柯伊伯带天体',
      discovered: '2014 年',
      source: 'https://science.nasa.gov/solar-system/kuiper-belt/arrokoth/',
      summary: '新视野号 2019 年近距离飞掠的人类探测最远天体，呈扁平雪人状双瓣相接结构，表面深砖红、颈部环绕明亮细粒物质带，大倾角约 98°。',
    },
    Makemake: {
      a: 45.6,
      e: 0.159,
      i: 29.0,
      om: 79.3,
      w: 297.0,
      per: 112000.0,
      code: '136472 Makemake',
      kind: '矮行星',
      discovered: '2005 年',
      source: 'https://science.nasa.gov/dwarf-planets/makemake/',
      summary: '柯伊伯带第二亮天体，表面富含冻结甲烷、乙烷与偏红的托林物质，哈勃为其发现了一颗暗弱卫星 MK 2。',
      prominent: true,
    },

    // Scattered disc and detached trans-Neptunian objects
    Gonggong: {
      a: 67.48,
      e: 0.503,
      i: 30.74,
      om: 336.9,
      w: 207.7,
      per: 202500.0,
      code: '225088 Gonggong',
      kind: '矮行星',
      discovered: '2007 年',
      source: sbdb + '225088',
      summary: '海王星 3:10 共振的离散盘大型矮行星，以中国古代水神共工命名，是太阳系颜色最赤红的大型天体之一，拥有哈勃发现的卫星相柳（共卫一）。',
      prominent: true,
    },
    Eris: {
      a: 67.86,
      e: 0.438,
      i: 43.9,
      om: 36.0,
      w: 151.0,
      per: 205000.0,
      code: '136199 Eris',
      kind: '矮行星',
      discovered: '2005 年',
      source: 'https://science.nasa.gov/dwarf-planets/eris/',
      summary: '已知质量最大的矮行星，沿 43.9° 极高倾角轨道深入离散盘，表面覆有高反照率氮冰与甲烷霜层，伴有大型卫星迪丝诺美亚（阋卫一）。',
      prominent: true,
    },
    Farfarout: {
      a: 80.2,
      e: 0.655,
      i: 18.3,
      om: 68.4,
      w: 241.9,
      per: 262000.0,
      code: '2018 AG37 · Farfarout',
      kind: '极远离散天体',
      discovered: '2018 年',
      source: sbdb + '2018%20AG37',
      summary: '目前观测距离太阳最远的已知太阳系天体（观测距离约 132 天文单位），高偏心率轨道从海王星外缘一路摆荡至极远离散盘深处。',
      prominent: true,
    },
    VP113: {
      a: 266.0,
      e: 0.698,
      i: 24.05,
      om: 90.8,
      w: 293.8,
      per: 1586000.0,
      code: '2012 VP113',
      kind: '分离矮行星',
      discovered: '2012 年',
      source: sbdb + '2012%20VP113',
      summary: '继赛德娜之后发现的第二颗类赛德娜分离天体，近日点高达 80.5 天文单位，彻底脱离海王星引力掌控，表面呈现淡粉红霜色。',
      prominent: true,
    },
    Sedna: {
      a: 506.0,
      e: 0.85,
      i: 11.93,
      om: 144.4,
      w: 311.3,
      per: 4160000.0,
      code: '90377 Sedna',
      kind: '内奥尔特云矮行星',
      discovered: '2003 年',
      source: 'https://science.nasa.gov/solar-system/kuiper-belt/sedna/',
      summary: '极遥远的内奥尔特云矮行星，轨道近日点 76 AU、远日点直达 937 AU，公转一周逾 1.1 万年；表面经宇宙射线长年辐照呈深赤红色，韦布检出乙烷与乙炔等有机冰。',
      prominent: true,
    },
    // JPL SBDB heliocentric osculating elements at JD 2461200.5 TDB (J2000 ecliptic).
    OF201: {
      a: 823.637167, e: 0.94518848, i: 16.22096, om: 328.76035, w: 337.83543, per: 8633807,
      code: '2017 OF201',
      kind: '海王星外天体 · 矮行星候选',
      discovered: '2025 年公布',
      source: sbdb + '2017%20OF201',
      summary: '天文学家在跨越七年的望远镜影像中辨认出这颗天体。它在近日点进入柯伊伯带，远日点约为 1,600 AU。模型中的浅色盆地与裂纹为模拟地貌。',
      prominent: true,
    },
    Leleakuhonua: {
      a: 1344.905387, e: 0.95190532, i: 11.67887, om: 301.13443, w: 118.22936, per: 18015073,
      code: '541132 · 2015 TG387',
      kind: '类赛德娜分离天体',
      discovered: '2015 年',
      source: sbdb + '541132',
      summary: '发现时距太阳约 80 AU。即使在近日点，它与太阳的距离仍约为 65 AU，轨道另一端则延伸至约 2,625 AU。模型中的棕红色山脊与沟槽为模拟地貌。',
      prominent: true,
    },
    FE72: {
      a: 2686.855990, e: 0.98658251, i: 20.60010, om: 336.74161, w: 134.03638, per: 50870383,
      code: '2014 FE72',
      kind: '极端海王星外天体',
      discovered: '2014 年',
      source: sbdb + '2014%20FE72',
      summary: '这颗小天体沿极狭长的轨道绕太阳运行。近日点约 36 AU，估算远日点约 5,340 AU，不确定度约 500 AU。模型中的不规则轮廓与撞击坑为模拟地貌。',
      prominent: true,
    },
  }

  const smallSpecs: readonly [string, string, Belt, number, number][] = [
    // Main Belt
    ['Ceres', '谷神星', 'main', 0.82, 138],
    ['Vesta', '灶神星', 'main', 0.6, 45],
    ['Pallas', '智神星', 'main', 0.56, 250],
    ['Juno', '婚神星', 'main', 0.42, 320],
    ['Hygiea', '健神星', 'main', 0.5, 100],
    ['Psyche', '灵神星', 'main', 0.52, 204],
    // Jupiter Trojans (phase computed dynamically from Jupiter L4/L5!)
    ['Eurybates', '欧律巴忒斯', 'trojan', 0.44, 0],
    ['Patroclus', '帕特罗克洛斯', 'trojan', 0.5, 0],
    // Centaurs (Saturn ↔ Uranus ↔ Neptune!)
    ['Chiron', '凯龙星', 'centaur', 0.58, 128],
    ['Chariklo', '女凯龙星', 'centaur', 0.62, 294],
    ['Pholus', '福罗斯星', 'centaur', 0.48, 42],
    // Kuiper Belt (30–50 AU)
    ['Pluto', '冥王星', 'outer', 1.24, 72],
    ['Orcus', '亡神星', 'outer', 0.94, 293],
    ['Haumea', '妊神星', 'outer', 0.92, 190],
    ['Quaoar', '创神星', 'outer', 0.98, 159],
    ['Arrokoth', '阿罗科斯', 'outer', 0.56, 318],
    ['Makemake', '鸟神星', 'outer', 0.88, 318],
    // Scattered disc and detached objects, ordered by semi-major axis
    ['Gonggong', '共工星', 'scattered', 1.06, 122],
    ['Eris', '阋神星', 'scattered', 1.2, 235],
    ['Farfarout', '远极星', 'scattered', 0.72, 243],
    ['VP113', '2012 VP113', 'scattered', 0.78, 211],
    ['Sedna', '赛德娜', 'scattered', 1.04, 224],
    ['OF201', '2017 OF201', 'scattered', 0.88, 308],
    ['Leleakuhonua', 'Leleākūhonua', 'scattered', 0.72, 48],
    ['FE72', '2014 FE72', 'scattered', 0.62, 198],
  ]

  const mainSlope = (mainBand.outer - mainBand.inner) / 1.45
  const jupiterInitLonDeg = 338

  const smallBodies = smallSpecs.map(([id, name, region, r, rawPhase]) => {
    const o = smallOrbits[id]
    const extent = systemRadius(id, r)
    const periAU = o.a * (1 - o.e)
    const apoAU = o.a * (1 + o.e)

    let a: number
    let e: number
    let phaseDeg = rawPhase

    if (region === 'main') {
      a = bandMid(mainBand) + (o.a - 2.77) * mainSlope
      const maxExcursion = Math.min(a - mainBand.inner, mainBand.outer - a) - extent
      e = Math.min(o.e * o.a * mainSlope, Math.max(0, maxExcursion)) / a
    } else if (region === 'trojan') {
      // Exact 1:1 co-orbital resonance locked to Jupiter's L4 (+60°) / L5 (-60°) camps
      a = jupiter.a
      e = Math.min(o.e * 0.45, 0.045)
      phaseDeg = ((jupiterInitLonDeg + (o.lagrangeDeg ?? 60) - o.w) % 360 + 360) % 360
    } else if (region === 'centaur') {
      const corridor = o.a < 19 ? centaurBands.satUra : centaurBands.uraNep
      const t = o.a < 19 ? (o.a - 11.5) / 6.5 : (o.a - 19.2) / 5.5
      a = corridor.inner + extent + 1.2 + Math.max(0.15, Math.min(0.85, t)) * Math.max(1, corridor.outer - corridor.inner - 2 * extent - 2.4)
      const maxExcursion = Math.min(a - corridor.inner, corridor.outer - a) - extent
      e = Math.min(o.e * 0.28, Math.max(0, maxExcursion) / a)
    } else {
      // Kuiper Belt, Scattered Disc, Detached / Inner Oort Zone: continuous linear-to-log AU mapping
      const minPeriScene = outerBand.inner + extent + 1.0
      const periScene = Math.max(minPeriScene, mapOuterAU(Math.max(30.5, periAU)))
      const apoScene = Math.max(periScene + 1.5, mapOuterAU(apoAU))
      a = (periScene + apoScene) * 0.5
      e = (apoScene - periScene) / (apoScene + periScene)
    }

    const world = new World(
      {
        id,
        name,
        region,
        r,
        phase: phaseDeg * rad,
        a,
        e,
        inc: o.i,
        node: o.om,
        peri: o.w,
        au: o.a,
        periAU,
        apoAU,
        days: o.per,
        kind: o.kind,
        code: o.code,
        discovered: o.discovered,
        summary: o.summary,
        source: o.source,
        prominent: o.prominent,
      },
      catalog[id] || [],
    )
    world.extent = extent
    return world
  })

  const worlds = [...planets, ...smallBodies]
  const allOrbitsOuter = Math.max(...smallBodies.map(p => p.a * (1 + p.e) + p.extent))
  const oortBand = {
    inner: scatteredBand.outer,
    outer: Math.max(allOrbitsOuter, mapOuterAU(OUTER_OORT_START_AU)),
  }
  const outerOortBand = {
    inner: mapOuterAU(OUTER_OORT_START_AU),
    outer: mapOuterAU(HILL_SPHERE_AU),
    thousandR: mapOuterAU(1_000),
    tenThousandR: mapOuterAU(10_000),
    lightYearR: mapOuterAU(LIGHT_YEAR_AU),
    coreOuterR: mapOuterAU(OUTER_OORT_CORE_AU),
  }
  return {
    planets,
    smallBodies,
    worlds,
    mainBand,
    hildaBand,
    centaurBands,
    outerBand,
    scatteredBand,
    allOrbitsOuter,
    oortBand,
    outerOortBand,
    bandMid,
    mapOuterAU,
  }
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
  Janus: ['雅努斯', '杰纳斯'],
  Epimetheus: ['厄庇墨透斯', '艾比米修斯'],
  Atlas: ['阿特拉斯'],
  Prometheus: ['普罗米修斯'],
  Pandora: ['潘多拉'],
  Pan: ['潘', '潘神'],
  Daphnis: ['达佛涅斯', '达夫尼斯'],
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
  Queta: ['奎塔', 'S/2018 (3548) 1'],
  Menoetius: ['墨诺提俄斯', '梅诺提俄斯'],
  Vanth: ['亡卫一', '万斯'],
  Weywot: ['创卫一', '维沃特'],
  Xiangliu: ['相柳', '共卫一'],
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

const moonDiscoveryLabels: Record<string, string> = {
  'Earth-Moon': '自古已知',
  'Jupiter-Themisto': '1975 年（2000 年重新发现）',
  'Saturn-Janus': '1966 年',
  'Saturn-Epimetheus': '1966 年（1977 年确认独立）',
  'Uranus-Perdita': '1999 年（1986 年影像）',
  'Neptune-Larissa': '1981 年（1989 年确认）',
  'Makemake-MK 2': '2015 年（2016 年公布）',
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
    Orcus: '亡',
    Quaoar: '创',
    Gonggong: '共',
    Eris: '阋',
    Haumea: '妊',
  }
  const prefix = prefixes[p.id]
  m.numberName = n && prefix ? prefix + '卫' + chineseNumber(n) : ''
  m.label = moonAliases[m.name]?.[0] || m.name
  m.discovered = moonDiscoveryLabels[`${p.id}-${m.name}`] || (m.year ? `${m.year} 年` : '未列出')
  m.otherNames = [
    ...new Set(
      [m.name, m.numberName, m.des, ...(moonAliases[m.name] || [])].filter(
        (s): s is string => !!s && s !== m.label,
      ),
    ),
  ]
  m.searchNames = [
    m.label,
    ...m.otherNames,
    m.num || '',
    m.num ? `${p.id} ${m.num}` : '',
    n && prefix ? prefix + '卫' + n : '',
  ]
}
