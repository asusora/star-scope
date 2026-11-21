import * as T from 'three'
import { createNeptunePass, neptuneEncounter } from './voyagerNeptune'
import type { World, VoyagerStats, VoyagerView, VoyagerMode, VoyagerId } from '../scene/types'
import { clamp, orbitalPosition, rad, v3 } from '../scene/math'
import type { Locale } from '../i18n'
import { pick } from '../i18n'

export const AU_KM = 149_597_870.7
export const LIGHT_SPEED_KM_S = 299_792.458
export const LIGHT_DAY_KM = LIGHT_SPEED_KM_S * 86_400 // 25,902,068,371.2 km
export const LIGHT_DAY_AU = LIGHT_DAY_KM / AU_KM // ~173.1446 AU
export const AU_LIGHT_HOURS = AU_KM / (LIGHT_SPEED_KM_S * 3600) // ~0.138611 h/AU

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
const MS_PER_DAY = 86_400_000
const MS_PER_YEAR = 365.25 * MS_PER_DAY

export function utcToYear(y: number, m: number, d: number, hour = 12, minute = 0): number {
  return 2000 + (Date.UTC(y, m - 1, d, hour, minute, 0) - J2000_MS) / MS_PER_YEAR
}

export function yearToDate(year: number): Date {
  return new Date(J2000_MS + (year - 2000) * MS_PER_YEAR)
}

export function formatMissionDate(year: number, lang: Locale = 'zh'): string {
  const dt = yearToDate(year)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return lang === 'en' ? `${y}-${m}-${d}` : `${y}.${m}.${d}`
}

export function formatMissionDateTime(year: number, lang: Locale = 'zh'): string {
  const dt = yearToDate(year)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  const hh = String(dt.getUTCHours()).padStart(2, '0')
  const mm = String(dt.getUTCMinutes()).padStart(2, '0')
  return lang === 'en' ? `${y}-${m}-${d} ${hh}:${mm}` : `${y}.${m}.${d} ${hh}:${mm}`
}

export function formatLightTime(hours: number, lang: Locale = 'zh'): string {
  const totalMin = Math.max(0, Math.round(hours * 60))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return lang === 'en' ? `${m}m` : `${m} 分`
  return lang === 'en'
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${h} 时 ${String(m).padStart(2, '0')} 分`
}

export const VOYAGER_START_YEAR = utcToYear(1977, 9, 5)
export const VOYAGER_2_START_YEAR = utcToYear(1977, 8, 20)
export const VOYAGER_END_YEAR = utcToYear(2026, 11, 20)
export const VOYAGER_1LD_EARTH_YEAR = utcToYear(2026, 11, 15)

export const TERMINATION_SHOCK_AU = 94.0
export const HELIOPAUSE_AU = 121.6

// Upwind interstellar wind / heliosphere nose direction (ecliptic J2000)
export const HELIOSPHERE_NOSE_LON_DEG = 255.0
export const HELIOSPHERE_NOSE_LAT_DEG = 5.2

// NASA/JPL Standish J2000 mean elements for accurate historical 1977-2026 planetary positions
export interface PlanetEphemeris {
  au: number
  L0: number // mean longitude at J2000 (deg)
  wBar: number // longitude of perihelion (deg)
  e: number
  periodDays: number
}

export const planetEphemeris: Record<string, PlanetEphemeris> = {
  Mercury: { au: 0.3871, L0: 252.251, wBar: 77.456, e: 0.2056, periodDays: 87.9691 },
  Venus: { au: 0.7233, L0: 181.98, wBar: 131.533, e: 0.0068, periodDays: 224.7008 },
  Earth: { au: 1.0, L0: 100.464, wBar: 102.947, e: 0.0167, periodDays: 365.25636 },
  Mars: { au: 1.5237, L0: 355.453, wBar: 336.041, e: 0.0934, periodDays: 686.98 },
  Jupiter: { au: 5.2034, L0: 34.396, wBar: 14.754, e: 0.0484, periodDays: 4332.82 },
  Saturn: { au: 9.5371, L0: 49.954, wBar: 92.432, e: 0.0542, periodDays: 10755.7 },
  Uranus: { au: 19.1913, L0: 313.232, wBar: 170.964, e: 0.0472, periodDays: 30688.5 },
  Neptune: { au: 30.069, L0: 304.88, wBar: 44.971, e: 0.0086, periodDays: 60195.0 },
  Pluto: { au: 39.482, L0: 238.929, wBar: 224.067, e: 0.2488, periodDays: 90560.0 },
}

export function planetTrueLonRad(id: string, year: number): number {
  const el = planetEphemeris[id]
  if (!el) return 0
  const daysFromJ2000 = (year - 2000) * 365.25
  const L = (el.L0 + (daysFromJ2000 * 360) / el.periodDays) * rad
  const M = L - el.wBar * rad
  const e = el.e
  const eqCenter = (2 * e - 0.25 * e * e * e) * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M)
  return L + eqCenter
}

export function planetHeliocentricAU(id: string, year: number, out: T.Vector3): T.Vector3 {
  const el = planetEphemeris[id]
  if (!el) return out.set(0, 0, 0)
  const daysFromJ2000 = (year - 2000) * 365.25
  const L = (el.L0 + (daysFromJ2000 * 360) / el.periodDays) * rad
  const M = L - el.wBar * rad
  const e = el.e
  const eqCenter = (2 * e - 0.25 * e * e * e) * Math.sin(M) + 1.25 * e * e * Math.sin(2 * M)
  const lon = L + eqCenter
  const r = el.au * (1 - e * Math.cos(M))
  return out.set(r * Math.cos(lon), 0, -r * Math.sin(lon))
}

export interface VoyagerMilestone {
  id: string
  year: number
  dateZh: string
  dateEn: string
  au: number
  titleZh: string
  titleEn: string
  shortZh: string
  shortEn: string
  bodyZh: string
  bodyEn: string
  source: string
  focusMode: 'planet' | 'probe' | 'overview' | 'climb'
  focusPlanetId?: string
}

export const voyagerMilestones: VoyagerMilestone[] = [
  {
    id: 'launch',
    year: utcToYear(1977, 9, 5),
    dateZh: '1977.09.05',
    dateEn: '1977-09-05',
    au: 1.0,
    titleZh: '地球发射启程',
    titleEn: 'Launch from Earth',
    shortZh: '地球发射',
    shortEn: 'Launch',
    bodyZh:
      '旅行者 1 号由大力神 3E/半人马座火箭从卡纳维拉尔角发射升空，趁着 176 年一遇的外行星罕见排列，沿高速双曲线转移轨道奔赴木星与土星。',
    bodyEn:
      'Voyager 1 launched aboard a Titan IIIE/Centaur from Cape Canaveral, seizing a rare 176-year outer-planet alignment on a fast trajectory toward Jupiter and Saturn.',
    source: 'https://science.nasa.gov/mission/voyager/voyager-1/',
    focusMode: 'planet',
    focusPlanetId: 'Earth',
  },
  {
    id: 'jupiter',
    year: utcToYear(1979, 3, 5),
    dateZh: '1979.03.05',
    dateEn: '1979-03-05',
    au: 5.2,
    titleZh: '木星飞掠与首次重力弹弓',
    titleEn: 'Jupiter Gravity Assist',
    shortZh: '木星借力',
    shortEn: 'Jupiter',
    bodyZh:
      '近距掠过木星云顶 34.9 万千米处，首次发现木卫一的剧烈火山喷发与暗淡木星环；同时借助木星庞大引力获得巨大加速，大幅弯折轨道直指土星。',
    bodyEn:
      'Skimming 349,000 km from Jupiter, Voyager 1 discovered active volcanoes on Io and Jupiter’s faint ring while gaining a massive gravity-assist boost toward Saturn.',
    source: 'https://science.nasa.gov/mission/voyager/jupiter/',
    focusMode: 'planet',
    focusPlanetId: 'Jupiter',
  },
  {
    id: 'saturn',
    year: utcToYear(1980, 11, 12),
    dateZh: '1980.11.12',
    dateEn: '1980-11-12',
    au: 9.55,
    titleZh: '土星飞掠 · 抬升 35° 脱离黄道面',
    titleEn: 'Saturn & +35° Ecliptic Climb',
    shortZh: '土星升轨',
    shortEn: 'Saturn +35°',
    bodyZh:
      '为近距离探测土卫六（泰坦）的浓密氮气大气，旅行者 1 号从土星南侧穿出并受引力剧烈向上偏折，以约 35° 高黄纬角永久脱离太阳系黄道平面，朝蛇夫座方向爬升。',
    bodyEn:
      'A close flyby of Titan bent Voyager 1 sharply north of the ecliptic plane at roughly +35°, placing it on a permanent high-latitude climb out of the Solar System toward Ophiuchus.',
    source: 'https://science.nasa.gov/mission/voyager/saturn/',
    focusMode: 'climb',
    focusPlanetId: 'Saturn',
  },
  {
    id: 'paleBlueDot',
    year: utcToYear(1990, 2, 14),
    dateZh: '1990.02.14',
    dateEn: '1990-02-14',
    au: 40.5,
    titleZh: '回望拍摄“暗淡蓝点”',
    titleEn: 'Pale Blue Dot Portrait',
    shortZh: '暗淡蓝点',
    shortEn: 'Pale Blue Dot',
    bodyZh:
      '在距太阳约 40.5 AU（海王星轨道外柯伊伯带上方高空）处，地面指令探测器最后一次调转相机回望太阳系，拍下著名的“太阳系全家福”——地球在阳光光束中仅占不到一个像素。',
    bodyEn:
      'High above the Kuiper Belt at 40.5 AU, Voyager 1 turned its cameras back one final time to capture the Solar System Family Portrait, revealing Earth as a single “Pale Blue Dot”.',
    source: 'https://science.nasa.gov/mission/voyager/voyager-1s-pale-blue-dot/',
    focusMode: 'probe',
  },
  {
    id: 'terminationShock',
    year: utcToYear(2004, 12, 16),
    dateZh: '2004.12.16',
    dateEn: '2004-12-16',
    au: 94.0,
    titleZh: '穿越太阳风终端激波',
    titleEn: 'Termination Shock Crossing',
    shortZh: '终端激波',
    shortEn: 'Term. Shock',
    bodyZh:
      '在距太阳约 94 AU 处，高速超声速太阳风与星际介质碰撞骤然减速为亚声速并升温压缩。旅行者 1 号成为首个越过终端激波、进入日鞘层的航天器。',
    bodyEn:
      'At ~94 AU, the supersonic solar wind abruptly slows and heats against the interstellar medium. Voyager 1 became the first spacecraft to cross the Termination Shock into the heliosheath.',
    source: 'https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/',
    focusMode: 'probe',
  },
  {
    id: 'heliopause',
    year: utcToYear(2012, 8, 25),
    dateZh: '2012.08.25',
    dateEn: '2012-08-25',
    au: 121.6,
    titleZh: '冲破日球层顶 · 进入星际空间',
    titleEn: 'Heliopause · Interstellar Space',
    shortZh: '星际空间',
    shortEn: 'Interstellar',
    bodyZh:
      '在约 121.6 AU 处，太阳风粒子计数断崖式下降、银河宇宙射线骤增，等离子体密度跃升 40 倍——旅行者 1 号正式冲出太阳风保护气泡，成为首个进入星际空间的人造物体。',
    bodyEn:
      'At 121.6 AU, solar wind particles vanished while galactic cosmic rays surged and plasma density jumped 40-fold—Voyager 1 crossed the Heliopause into interstellar space.',
    source: 'https://science.nasa.gov/mission/voyager/interstellar-space/',
    focusMode: 'probe',
  },
  {
    id: 'oneLightDay',
    year: VOYAGER_1LD_EARTH_YEAR,
    dateZh: '2026.11',
    dateEn: 'Nov 2026',
    au: 172.2,
    titleZh: '抵达距地球 1 光日里程碑',
    titleEn: '1 Light-Day from Earth',
    shortZh: '1 光日',
    shortEn: '1 Light-Day',
    bodyZh:
      '历经 49 年星际跋涉，旅行者 1 号在 2026 年 11 月抵达距地球约 259 亿千米（约 173.14 AU，距太阳约 172.2 AU）处——从地球发出的无线电指令以光速飞行，需要整整 24 小时才能抵达探测器。',
    bodyEn:
      'After 49 years in space, Voyager 1 reaches 25.9 billion km (~173.14 AU) from Earth in November 2026—a radio signal traveling at the speed of light now takes a full 24 hours one way.',
    source: 'https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/',
    focusMode: 'overview',
  },
]

// Dates are UTC. Encounter distances in the narrative are rounded planetary orbit scales.
const cruiseEphemeris = 'https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=-32&CENTER=500%4010&EPHEM_TYPE=OBSERVER&TLIST=2461365&QUANTITIES=%2718,19,20%27&OBJ_DATA=NO'
const voyager2Source = 'https://science.nasa.gov/mission/voyager/voyager-2/'
function voyager2Event(
  id: string, date: [number, number, number], au: number, shortZh: string, shortEn: string,
  titleZh: string, titleEn: string, bodyZh: string, bodyEn: string, focusPlanetId?: string,
): VoyagerMilestone {
  const year = id === 'neptune' ? neptuneEncounter : utcToYear(...date)
  return {
    id, year, au, shortZh, shortEn, titleZh, titleEn, bodyZh, bodyEn, focusPlanetId,
    dateZh: formatMissionDate(year), dateEn: formatMissionDate(year, 'en'),
    focusMode: focusPlanetId ? 'planet' : id === 'cruise' ? 'overview' : 'climb',
    source: id === 'cruise' ? cruiseEphemeris : voyager2Source,
  }
}

export const voyager2Milestones = [
  voyager2Event('launch', [1977, 8, 20], 1, '地球发射', 'Launch', '先行启程', 'First to launch',
    '旅行者 2 号比姊妹探测器早 16 天从地球出发，踏上木星、土星、天王星与海王星四星大巡游。它至今仍是唯一探访过这四颗巨行星的航天器。',
    'Voyager 2 left Earth 16 days before its twin. It remains the only spacecraft to have visited Jupiter, Saturn, Uranus and Neptune.', 'Earth'),
  voyager2Event('jupiter', [1979, 7, 9], 5.2, '木星借力', 'Jupiter', '木星 · 第一次引力借力', 'Jupiter · First gravity assist',
    '旅行者 1 号已于 3 月抵达木星。7 月，旅行者 2 号从木星外侧掠过，观测木卫二表面的裂纹，并借力飞向土星。',
    'Voyager 1 arrived in March. In July, Voyager 2 imaged fractures on Europa and used Jupiter’s gravity to set course for Saturn.', 'Jupiter'),
  voyager2Event('saturn', [1981, 8, 25], 9.5, '土星借力', 'Saturn', '土星 · 转向天王星', 'Saturn · On to Uranus',
    '旅行者 2 号穿过土星系统，观测星环和冰卫星。第二次引力借力使它留在黄道面附近，继续向天王星飞行。',
    'Voyager 2 studied Saturn’s rings and icy moons. Its second gravity assist kept it close to the ecliptic on the way to Uranus.', 'Saturn'),
  voyager2Event('uranus', [1986, 1, 24], 19.1, '天王星飞掠', 'Uranus', '人类首次近观天王星', 'First encounter with Uranus',
    '旅行者 2 号首次近距离探测天王星及其倾斜的磁场，拍下天卫五崎岖的断崖，随后借力前往海王星。',
    'The first spacecraft at Uranus measured its tilted magnetic field and imaged Miranda’s scarps before swinging toward Neptune.', 'Uranus'),
  voyager2Event('neptune', [1989, 8, 25], 30.1, '海王星飞掠', 'Neptune', '海王星与海卫一 · 转向南天', 'Neptune and Triton · Turning south',
    '探测器从海王星北极上方掠过，随后飞越海卫一。这次借力改变了速度方向，使它沿约 −48° 的逃逸方向离开黄道面。',
    'Voyager 2 passed over Neptune’s north pole and then flew by Triton. The encounter bent its velocity southward toward an escape latitude of about −48°.', 'Neptune'),
  voyager2Event('terminationShock', [2007, 8, 30], 83.7, '终端激波', 'Term. shock', '南侧终端激波 · 83.7 AU', 'Southern termination shock · 83.7 AU',
    '太阳风在这里降至亚声速。南侧的穿越距离约为 83.7 AU，短于旅行者 1 号北侧的 94 AU，显示出日球层边界的变化与不对称。',
    'The solar wind slowed below the speed of sound. The southern crossing at 83.7 AU, closer than Voyager 1’s at 94 AU, sampled a changing, asymmetric boundary.'),
  voyager2Event('heliopause', [2018, 11, 5], 119, '日球层顶', 'Heliopause', '穿越日球层顶 · 119 AU', 'Heliopause crossing · 119 AU',
    '在约 119 AU 处，旅行者 2 号穿越太阳风与星际等离子体的分界，成为第二艘进入星际空间的航天器。',
    'At about 119 AU, Voyager 2 crossed from solar-wind plasma into the interstellar medium, becoming the second spacecraft to reach interstellar space.'),
  voyager2Event('cruise', [2026, 11, 20], 143.8, '星际巡航', 'Cruise', '南天星际巡航', 'Interstellar cruise south',
    '巡航示意取日心 143.8 AU（约 215 亿千米，光行约 19 时 55 分），沿黄经 291°、黄纬 −48° 的逃逸方向绘制。同期 Horizons 日心位置约为 144.5 AU、黄纬 −38.5°。',
    'The cruise illustration uses 143.8 AU from the Sun (21.5 billion km, about 19h 55m by light) and an escape direction of 291°, −48°. The Horizons position at this epoch is about 144.5 AU at latitude −38.5°.'),
]

export function missionName(mode: VoyagerMode, lang?: Locale) {
  if (mode === 'both') return pick('双星同屏对比', 'Compare both', lang)
  return mode === 'v1' ? pick('旅行者 1 号', 'Voyager 1', lang) : pick('旅行者 2 号', 'Voyager 2', lang)
}

export function missionMilestones(id: VoyagerId) {
  return id === 'v1' ? voyagerMilestones : voyager2Milestones
}

export function missionStart(mode: VoyagerMode) {
  return mode === 'v1' ? VOYAGER_START_YEAR : VOYAGER_2_START_YEAR
}

export function epochPlanetPosition(world: World, year: number, out: T.Vector3) {
  if (world.id === 'Pluto') {
    const el = planetEphemeris.Pluto
    const daysFromJ2000 = (year - 2000) * 365.25
    const M = (el.L0 + (daysFromJ2000 * 360) / el.periodDays - el.wBar) * rad
    return orbitalPosition(world.orbit, M, out)
  }
  const lon = planetTrueLonRad(world.id, year)
  return orbitalPosition(world.orbit, lon - (world.node + (world.peri || 0)) * rad, out)
}

export const voyagerViews: { id: VoyagerView; zh: string; en: string }[] = [
  { id: 'overview', zh: '全景轨道', en: 'Overview' },
  { id: 'flyby', zh: '行星借力', en: 'Flybys' },
  { id: 'climb', zh: '侧视 35°', en: '35° Climb' },
  { id: 'top', zh: '黄道俯视', en: 'Top View' },
  { id: 'probe', zh: '3D 探测器', en: 'Spacecraft' },
]

/**
 * Smooth cinematic playback rate (simulated years per real second at 1x speed).
 * Slows gracefully during the 1977-1981 Earth -> Jupiter -> Saturn gravity-assist
 * encounters so users can clearly observe each planetary flyby and the +35° climb,
 * then accelerates smoothly across the multi-decade outer cruise to 1 Light-Day.
 */
export function voyagerPlaybackRate(year: number, mode: VoyagerMode = 'v1'): number {
  let base: number
  if (year < 1981.6) {
    base = 0.34
  } else if (year < 1992.0) {
    const t = clamp((year - 1981.6) / (1992.0 - 1981.6), 0, 1)
    const s = t * t * (3 - 2 * t)
    base = 0.34 + (1.15 - 0.34) * s
  } else {
    const t = clamp((year - 1992.0) / (2004.0 - 1992.0), 0, 1)
    const s = t * t * (3 - 2 * t)
    base = 1.15 + (2.15 - 1.15) * s
  }

  let factor = 1
  for (const id of voyagerIds) {
    if (mode !== 'both' && mode !== id) continue
    for (const m of missionMilestones(id)) {
      const assist = m.focusPlanetId && m.id !== 'launch'
      const boundary = m.id === 'terminationShock' || m.id === 'heliopause'
      if (!assist && !boundary) continue
      const dt = (year - m.year) / (assist ? 0.18 : 0.7)
      factor = Math.min(factor, 1 - (assist ? 0.65 : 0.36) * Math.exp(-0.5 * dt * dt))
    }
  }
  let rate = Math.max(0.09, base * factor)
  if (mode !== 'v1') {
    // Resolve the five-hour passage from Neptune to Triton, even at 5× playback.
    const hours = Math.abs(year - neptuneEncounter) * 365.25 * 24
    rate = Math.min(rate, (1.6 + 0.55 * hours) / (365.25 * 24))
  }
  if (mode === 'both' && year < VOYAGER_START_YEAR + 0.18) {
    const afterLaunch = Math.max(0, year - VOYAGER_START_YEAR)
    rate = Math.min(rate, 0.024 + 2 * afterLaunch)
  }
  return rate
}

// Heliocentric ecliptic J2000 trajectory keyframes derived from NASA/JPL HORIZONS
// Columns: [year, rAU, lonDeg (unwrapped continuous prograde), latDeg, speedKmS]
interface Waypoint {
  year: number
  rAU: number
  lonDeg: number
  latDeg: number
  speedKmS: number
}

const rawWaypoints: Waypoint[] = [
  // Launch from Earth (1977-09-05)
  { year: utcToYear(1977, 9, 5), rAU: 1.008, lonDeg: 342.6, latDeg: 0.0, speedKmS: 39.6 },
  { year: utcToYear(1977, 10, 20), rAU: 1.24, lonDeg: 374.0, latDeg: 0.25, speedKmS: 33.4 },
  { year: utcToYear(1977, 12, 15), rAU: 1.72, lonDeg: 405.0, latDeg: 0.55, speedKmS: 27.6 },
  { year: utcToYear(1978, 3, 1), rAU: 2.48, lonDeg: 432.0, latDeg: 0.88, speedKmS: 22.1 },
  { year: utcToYear(1978, 6, 15), rAU: 3.45, lonDeg: 456.0, latDeg: 1.12, speedKmS: 17.8 },
  { year: utcToYear(1978, 10, 15), rAU: 4.38, lonDeg: 474.5, latDeg: 1.24, speedKmS: 14.9 },
  { year: utcToYear(1979, 1, 15), rAU: 4.95, lonDeg: 483.8, latDeg: 1.3, speedKmS: 13.6 },
  // Jupiter closest approach & gravity assist (1979-03-05) -> lon = 127.6° (+360 = 487.6°)
  { year: utcToYear(1979, 3, 5), rAU: 5.20, lonDeg: 487.6, latDeg: 1.31, speedKmS: 24.8 },
  { year: utcToYear(1979, 5, 1), rAU: 5.56, lonDeg: 498.5, latDeg: 1.48, speedKmS: 23.6 },
  { year: utcToYear(1979, 8, 15), rAU: 6.32, lonDeg: 514.0, latDeg: 1.78, speedKmS: 21.8 },
  { year: utcToYear(1980, 1, 1), rAU: 7.35, lonDeg: 526.8, latDeg: 2.08, speedKmS: 20.1 },
  { year: utcToYear(1980, 6, 1), rAU: 8.42, lonDeg: 536.0, latDeg: 2.28, speedKmS: 18.8 },
  { year: utcToYear(1980, 9, 25), rAU: 9.24, lonDeg: 540.9, latDeg: 2.42, speedKmS: 18.1 },
  // Saturn & Titan flyby (1980-11-12) -> lon = 182.3° (+360 = 542.3°), sharp upward +35° bend!
  { year: utcToYear(1980, 11, 12), rAU: 9.55, lonDeg: 542.3, latDeg: 2.46, speedKmS: 21.6 },
  { year: utcToYear(1981, 2, 15), rAU: 10.22, lonDeg: 551.8, latDeg: 9.6, speedKmS: 20.4 },
  { year: utcToYear(1981, 7, 1), rAU: 11.25, lonDeg: 562.4, latDeg: 15.8, speedKmS: 19.6 },
  { year: utcToYear(1982, 1, 1), rAU: 12.68, lonDeg: 571.6, latDeg: 20.4, speedKmS: 19.1 },
  { year: utcToYear(1983, 1, 1), rAU: 15.85, lonDeg: 582.5, latDeg: 24.8, speedKmS: 18.6 },
  { year: utcToYear(1984, 6, 1), rAU: 20.65, lonDeg: 591.0, latDeg: 27.6, speedKmS: 18.2 },
  { year: utcToYear(1986, 6, 1), rAU: 27.55, lonDeg: 597.4, latDeg: 29.8, speedKmS: 17.9 },
  { year: utcToYear(1988, 6, 1), rAU: 34.6, lonDeg: 601.1, latDeg: 31.1, speedKmS: 17.7 },
  // Pale Blue Dot (1990-02-14)
  { year: utcToYear(1990, 2, 14), rAU: 40.5, lonDeg: 603.4, latDeg: 31.8, speedKmS: 17.6 },
  { year: utcToYear(1994, 1, 1), rAU: 54.5, lonDeg: 606.8, latDeg: 32.9, speedKmS: 17.4 },
  { year: utcToYear(1998, 2, 17), rAU: 69.4, lonDeg: 609.0, latDeg: 33.6, speedKmS: 17.3 },
  { year: utcToYear(2001, 6, 1), rAU: 81.5, lonDeg: 610.4, latDeg: 34.0, speedKmS: 17.2 },
  // Termination Shock (2004-12-16)
  { year: utcToYear(2004, 12, 16), rAU: 94.0, lonDeg: 611.6, latDeg: 34.3, speedKmS: 17.1 },
  { year: utcToYear(2008, 9, 1), rAU: 107.4, lonDeg: 612.5, latDeg: 34.5, speedKmS: 17.05 },
  // Heliopause / Interstellar Space (2012-08-25)
  { year: utcToYear(2012, 8, 25), rAU: 121.6, lonDeg: 613.3, latDeg: 34.65, speedKmS: 17.0 },
  { year: utcToYear(2016, 6, 1), rAU: 135.1, lonDeg: 613.9, latDeg: 34.76, speedKmS: 16.96 },
  { year: utcToYear(2020, 1, 1), rAU: 148.1, lonDeg: 614.4, latDeg: 34.84, speedKmS: 16.93 },
  { year: utcToYear(2023, 6, 1), rAU: 160.3, lonDeg: 614.8, latDeg: 34.89, speedKmS: 16.91 },
  // 1 Light-Day from Earth (2026-11-15) & Current Date (2026-11-20)
  { year: VOYAGER_1LD_EARTH_YEAR, rAU: 172.3, lonDeg: 615.1, latDeg: 34.94, speedKmS: 16.9 },
  { year: VOYAGER_END_YEAR, rAU: 172.38, lonDeg: 615.11, latDeg: 34.94, speedKmS: 16.9 },
]

export const voyagerIds = ['v1', 'v2'] as const

// JPL Horizons target -32, Sun center 500@10, geometric J2000 ecliptic vectors.
// Longitudes unwrap across 0°. After Neptune, keyframes illustrate the requested
// southbound escape direction, reaching −48° in the November 2026 snapshot.
const voyager2Waypoints: Waypoint[] = [
  // year, month, day, heliocentric AU, longitude, latitude, km/s
  [1977, 8, 20, 1.01, 328, 0, 39],
  [1977, 10, 20, 1.243, 396.756, 4.507, 34.389],
  [1978, 1, 1, 1.911, 437.11, 4.558, 26.154],
  [1978, 4, 1, 2.707, 459.514, 3.609, 20.281],
  [1978, 8, 1, 3.606, 475.533, 2.582, 15.752],
  [1978, 12, 1, 4.329, 485.566, 1.827, 12.895],
  [1979, 4, 1, 4.909, 492.86, 1.233, 10.876],
  [1979, 7, 1, 5.282, 497.241, 0.831, 9.925],
  [1979, 7, 9, 5.326, 497.531, 0.785, 19.467],
  [1979, 7, 20, 5.382, 498.906, 0.842, 20.832],
  [1979, 12, 1, 5.908, 513.234, 1.421, 18.828],
  [1980, 6, 1, 6.833, 528.503, 1.93, 17.641],
  [1981, 1, 1, 8.094, 541.502, 2.256, 16.439],
  [1981, 8, 25, 9.596, 551.709, 2.431, 18.525],
  [1981, 9, 10, 9.61, 552.86, 2.408, 20.488],
  [1982, 5, 1, 10.013, 568.65, 2.006, 20.102],
  [1983, 6, 1, 11.818, 590.609, 1.206, 19.403],
  [1984, 6, 1, 14.286, 604.663, 0.593, 18.713],
  [1985, 6, 1, 17.145, 614.28, 0.15, 18.145],
  [1986, 1, 24, 19.12, 618.934, -0.066, 18.888],
  [1986, 2, 10, 19.243, 619.384, -0.047, 19.706],
  [1987, 1, 1, 21.719, 626.984, 0.283, 19.431],
  [1988, 1, 1, 24.779, 633.607, 0.568, 19.174],
  [1989, 1, 1, 28.041, 638.745, 0.783, 18.956],
  [1989, 8, 25, 30.216, 641.457, 0.89, 17.424],
  [1989, 9, 10, 30.322, 641.499, 0.63, 16.723],
  [1990, 8, 25, 32.694, 642.337, -4.5, 16.583],
  [1992, 8, 25, 38.042, 643.764, -13.2, 16.357],
  [1996, 8, 25, 49.63, 645.772, -24.9, 16.013],
  [2001, 8, 25, 64.871, 647.384, -33.3, 15.743],
  [2007, 8, 30, 83.7, 648.648, -39.4, 15.558],
  [2012, 8, 25, 99.394, 649.394, -42.6, 15.439],
  [2018, 11, 5, 119, 650.078, -45.5, 15.4],
  [2026, 11, 20, 143.8, 651, -48, 15.4],
].map(([y, m, d, rAU, lonDeg, latDeg, speedKmS]) => ({
  year: utcToYear(y, m, d), rAU, lonDeg, latDeg, speedKmS,
}))

export interface RadialMapper {
  auToScene: (au: number) => number
  earthOrbitR: number
  jupiterOrbitR: number
  saturnOrbitR: number
  neptuneOrbitR: number
  terminationShockR: number
  heliopauseR: number
  oneLightDayR: number
}

export function createRadialMapper(
  planets: World[],
  mapOuterAU: (au: number) => number,
): RadialMapper {
  const byId = new Map(planets.map((p) => [p.id, p]))
  const anchors: [number, number][] = [
    [0, 0],
    [0.3871, byId.get('Mercury')!.a],
    [0.7233, byId.get('Venus')!.a],
    [1.0, byId.get('Earth')!.a],
    [1.5237, byId.get('Mars')!.a],
    [5.2034, byId.get('Jupiter')!.a],
    [9.5371, byId.get('Saturn')!.a],
    [19.1913, byId.get('Uranus')!.a],
    [30.069, byId.get('Neptune')!.a],
    [50, mapOuterAU(50)],
  ]

  function auToScene(au: number): number {
    if (au <= 0) return 0
    if (au >= 50) return mapOuterAU(au)
    for (let i = 1; i < anchors.length; i++) {
      const [au0, r0] = anchors[i - 1]
      const [au1, r1] = anchors[i]
      if (au <= au1) {
        const t = (au - au0) / (au1 - au0)
        return r0 + (r1 - r0) * t
      }
    }
    return mapOuterAU(au)
  }

  return {
    auToScene,
    earthOrbitR: byId.get('Earth')!.a,
    jupiterOrbitR: byId.get('Jupiter')!.a,
    saturnOrbitR: byId.get('Saturn')!.a,
    neptuneOrbitR: byId.get('Neptune')!.a,
    terminationShockR: auToScene(TERMINATION_SHOCK_AU),
    heliopauseR: auToScene(HELIOPAUSE_AU),
    oneLightDayR: auToScene(LIGHT_DAY_AU),
  }
}

export interface VoyagerSample {
  year: number
  pos: T.Vector3
  rAU: number
  earthAU: number
  earthBillionKm: number
  lightHours: number
  speedKmS: number
  lonDeg: number
  latDeg: number
}

// Smooth Catmull-Rom 1D interpolation clamped to prevent overshoot at gravity-assist kinks
function hermite1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const m1 = 0.5 * (p2 - p0)
  const m2 = 0.5 * (p3 - p1)
  // Monotonicity / kink guard when slopes differ strongly (Jupiter/Saturn flybys)
  const d = p2 - p1
  const s1 = d === 0 ? 0 : Math.sign(m1) === Math.sign(d) ? Math.min(Math.abs(m1), Math.abs(d) * 1.45) * Math.sign(d) : 0
  const s2 = d === 0 ? 0 : Math.sign(m2) === Math.sign(d) ? Math.min(Math.abs(m2), Math.abs(d) * 1.45) * Math.sign(d) : 0
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * s1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * s2
}

const earthTmp = v3()
const voyagerAUTmp = v3()

export function createVoyagerEphemeris(
  planets: World[],
  mapOuterAU: (au: number) => number,
  id: VoyagerId = 'v1',
) {
  const mapper = createRadialMapper(planets, mapOuterAU)
  const milestones = missionMilestones(id)
  const waypoints = id === 'v1' ? rawWaypoints : voyager2Waypoints
  const start = missionStart(id)

  function sphericalToScene(rAU: number, lonDeg: number, latDeg: number, out: T.Vector3): T.Vector3 {
    const r = mapper.auToScene(rAU)
    const lon = lonDeg * rad
    const lat = latDeg * rad
    const cosLat = Math.cos(lat)
    return out.set(r * cosLat * Math.cos(lon), r * Math.sin(lat), -r * cosLat * Math.sin(lon))
  }

  function sampleRaw(year: number) {
    const y = clamp(year, start, VOYAGER_END_YEAR)
    let i = 0
    while (i < waypoints.length - 2 && waypoints[i + 1].year < y) i++
    const w1 = waypoints[i]
    const w2 = waypoints[i + 1]
    const w0 = waypoints[Math.max(0, i - 1)]
    const w3 = waypoints[Math.min(waypoints.length - 1, i + 2)]
    const span = Math.max(1e-6, w2.year - w1.year)
    const t = clamp((y - w1.year) / span, 0, 1)

    const rAU = hermite1D(w0.rAU, w1.rAU, w2.rAU, w3.rAU, t)
    const lonDeg = hermite1D(w0.lonDeg, w1.lonDeg, w2.lonDeg, w3.lonDeg, t)
    const latDeg = hermite1D(w0.latDeg, w1.latDeg, w2.latDeg, w3.latDeg, t)
    const speedKmS = hermite1D(w0.speedKmS, w1.speedKmS, w2.speedKmS, w3.speedKmS, t)
    return { year: y, rAU, lonDeg, latDeg, speedKmS }
  }

  // Both the live planet and the anchor use the exact same scene-space orbit solver.
  const anchorSceneTargets = milestones.filter(m => m.focusPlanetId && m.id !== 'neptune').map(m => {
    const world = planets.find(p => p.id === m.focusPlanetId)!
    const planetPos = epochPlanetPosition(world, m.year, v3())
    const sign = id === 'v1' && m.id === 'saturn' ? -1 : 1
    const clearance = world.r * (m.id === 'saturn' || m.id === 'uranus' ? 2.65 : 1.5) + 1.2
    const sigma = m.id === 'launch' ? 0.08 : 0.26
    const raw = sampleRaw(m.year)
    const rawPos = sphericalToScene(raw.rAU, raw.lonDeg, raw.latDeg, v3())
    const desired = planetPos.clone()
    desired.y += sign * clearance
    return {
      year: m.year, sigma, world, planetPos, clearance, sign,
      delta: desired.sub(rawPos),
    }
  })

  const neptune = planets.find(p => p.id === 'Neptune')!
  const pass = id === 'v2' ? createNeptunePass(neptune.moons.find(m => m.name === 'Triton')!,
    year => epochPlanetPosition(neptune, year, v3()), year => {
      const raw = sampleRaw(year)
      return sphericalToScene(raw.rAU, raw.lonDeg, raw.latDeg, v3())
    }) : null
  const planetTmp = v3()
  function sample(year: number, outPos = v3()): VoyagerSample {
    const raw = sampleRaw(year)
    sphericalToScene(raw.rAU, raw.lonDeg, raw.latDeg, outPos)

    // Smoothly apply tiny Gaussian encounter corrections so the trajectory skims cleanly by Earth/Jupiter/Saturn
    for (const a of anchorSceneTargets) {
      const dt = (raw.year - a.year) / a.sigma
      if (Math.abs(dt) < 3.6) {
        outPos.addScaledVector(a.delta, Math.exp(-0.5 * dt * dt))
      }
    }

    // Bodies (and the spacecraft) are enlarged for the atlas. Keep the approach
    // above/below both the encounter globe and its moving silhouette during playback.
    for (const a of anchorSceneTargets) {
      if (Math.abs(raw.year - a.year) > 4 * a.sigma) continue
      const live = epochPlanetPosition(a.world, raw.year, planetTmp)
      for (const center of [live, a.planetPos]) {
        const horizontal = Math.hypot(outPos.x - center.x, outPos.z - center.z)
        if (horizontal >= a.clearance) continue
        const height = Math.sqrt(a.clearance ** 2 - horizontal ** 2)
        if ((outPos.y - center.y) * a.sign < height) outPos.y = center.y + a.sign * height
      }
    }

    pass?.apply(year, outPos)

    // Heliocentric AU vector & Earth-Voyager distance in AU / light-hours
    const lon = raw.lonDeg * rad
    const lat = raw.latDeg * rad
    const cosLat = Math.cos(lat)
    voyagerAUTmp.set(
      raw.rAU * cosLat * Math.cos(lon),
      raw.rAU * Math.sin(lat),
      -raw.rAU * cosLat * Math.sin(lon),
    )
    planetHeliocentricAU('Earth', raw.year, earthTmp)
    const earthAU = Math.max(0.0001, voyagerAUTmp.distanceTo(earthTmp))
    const earthBillionKm = (earthAU * AU_KM) / 1e9 // billion km (×10 for 亿千米)
    const lightHours = earthAU * AU_LIGHT_HOURS

    return {
      year: raw.year,
      pos: outPos,
      rAU: raw.rAU,
      earthAU,
      earthBillionKm,
      lightHours,
      speedKmS: raw.speedKmS,
      lonDeg: ((raw.lonDeg % 360) + 360) % 360,
      latDeg: raw.latDeg,
    }
  }

  function statsAt(year: number, lang: Locale = 'zh', s = sample(year)): VoyagerStats {
    return {
      year: s.year,
      dateLabel: formatMissionDate(s.year, lang),
      sunAU: s.rAU,
      earthAU: s.earthAU,
      earthBillionKm: s.earthBillionKm,
      lightHours: s.lightHours,
      speedKmS: s.speedKmS,
      latDeg: s.latDeg,
      lonDeg: s.lonDeg,
    }
  }

  function nearestMilestoneId(year: number): string {
    let active = milestones[0].id
    for (const m of milestones) {
      if (year >= m.year) active = m.id
    }
    return active
  }

  return {
    mapper,
    sample,
    statsAt,
    nearestMilestoneId,
    encounterYears: pass?.years ?? [],
  }
}

export function milestoneTitle(m: VoyagerMilestone, lang: Locale): string {
  return pick(m.titleZh, m.titleEn, lang)
}

export function milestoneShort(m: VoyagerMilestone, lang: Locale): string {
  return pick(m.shortZh, m.shortEn, lang)
}

export function milestoneBody(m: VoyagerMilestone, lang: Locale): string {
  return pick(m.bodyZh, m.bodyEn, lang)
}

export function milestoneDate(m: VoyagerMilestone, lang: Locale): string {
  return pick(m.dateZh, m.dateEn, lang)
}
