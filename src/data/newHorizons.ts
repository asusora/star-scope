import { clamp } from '../scene/math'
import { formatMissionDate, formatMissionDateTime } from './voyager'
import type { Locale } from '../i18n'
import { pick } from '../i18n'

export type NewHorizonsFlyby = 'jupiter' | 'pluto' | 'arrokoth'
export type NewHorizonsView = 'overview' | 'jupiter' | 'pluto' | 'arrokoth' | 'probe'
export type NewHorizonsMilestoneId = 'launch' | 'jupiter' | 'pluto' | 'arrokoth' | 'fiftyAU' | 'cruise'

export const newHorizonsMission = 'https://science.nasa.gov/mission/new-horizons/'
export const newHorizonsSpiceSource =
  'https://naif.jpl.nasa.gov/pub/naif/pds/data/nh-j_p_ss-spice-6-v1.0/nhsp_1000/data/spk/spkinfo.txt'

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
const MS_PER_YEAR = 365.25 * 86_400_000

export function msToYear(ms: number): number {
  return 2000 + (ms - J2000_MS) / MS_PER_YEAR
}

export function yearToMs(year: number): number {
  return J2000_MS + (year - 2000) * MS_PER_YEAR
}

export const NH_LAUNCH_MS = Date.UTC(2006, 0, 19, 19, 0, 0)
export const NH_TRACK_START_MS = 1137700213146 // 2006-01-19T19:50:13.146Z
export const NH_JUPITER_MS = 1172641420303 // 2007-02-28T05:43:40.303Z
export const NH_PLUTO_MS = 1436874508779 // 2015-07-14T11:48:28.779Z
export const NH_ARROKOTH_MS = 1546320802389 // 2019-01-01T05:33:22.389Z
export const NH_ARCHIVE_END_MS = 1550181150990 // 2019-02-14T21:52:30.990Z
export const NH_FIFTY_AU_MS = Date.UTC(2021, 3, 17, 12, 42, 0)
export const NH_END_MS = Date.UTC(2026, 10, 20, 12, 0, 0)

export const NH_START_YEAR = msToYear(NH_TRACK_START_MS)
export const NH_JUPITER_YEAR = msToYear(NH_JUPITER_MS)
export const NH_PLUTO_YEAR = msToYear(NH_PLUTO_MS)
export const NH_ARROKOTH_YEAR = msToYear(NH_ARROKOTH_MS)
export const NH_ARCHIVE_END_YEAR = msToYear(NH_ARCHIVE_END_MS)
export const NH_FIFTY_AU_YEAR = msToYear(NH_FIFTY_AU_MS)
export const NH_END_YEAR = msToYear(NH_END_MS)

export interface NewHorizonsEncounterMeta {
  id: NewHorizonsFlyby
  bodyId: 'Jupiter' | 'Pluto' | 'Arrokoth'
  timeMs: number
  year: number
  distanceKm: number
  speedKmS: number
  windowHalfSec: number
  zh: string
  en: string
}

export const newHorizonsEncounters: Record<NewHorizonsFlyby, NewHorizonsEncounterMeta> = {
  jupiter: {
    id: 'jupiter',
    bodyId: 'Jupiter',
    timeMs: NH_JUPITER_MS,
    year: NH_JUPITER_YEAR,
    distanceKm: 2304504.762,
    speedKmS: 21.219454,
    windowHalfSec: 24 * 3600,
    zh: '木星',
    en: 'Jupiter',
  },
  pluto: {
    id: 'pluto',
    bodyId: 'Pluto',
    timeMs: NH_PLUTO_MS,
    year: NH_PLUTO_YEAR,
    distanceKm: 13673.771,
    speedKmS: 13.778483,
    windowHalfSec: 25 * 60,
    zh: '冥王星',
    en: 'Pluto',
  },
  arrokoth: {
    id: 'arrokoth',
    bodyId: 'Arrokoth',
    timeMs: NH_ARROKOTH_MS,
    year: NH_ARROKOTH_YEAR,
    distanceKm: 3536.924,
    speedKmS: 14.435021,
    windowHalfSec: 8 * 60,
    zh: '阿罗科斯',
    en: 'Arrokoth',
  },
}

export interface NewHorizonsMilestone {
  id: NewHorizonsMilestoneId
  year: number
  timeMs: number
  dateZh: string
  dateEn: string
  au: number
  titleZh: string
  titleEn: string
  shortZh: string
  shortEn: string
  badgeZh?: string
  badgeEn?: string
  bodyZh: string
  bodyEn: string
  source: string
  defaultView: NewHorizonsView
  focusBodyId?: 'Earth' | 'Jupiter' | 'Pluto' | 'Arrokoth'
  photoBodyId?: 'Jupiter' | 'Pluto' | 'Arrokoth'
  encounter?: NewHorizonsFlyby
}

export const newHorizonsMilestones: NewHorizonsMilestone[] = [
  {
    id: 'launch',
    year: NH_START_YEAR,
    timeMs: NH_TRACK_START_MS,
    dateZh: '2006.01.19',
    dateEn: '2006-01-19',
    au: 0.98,
    titleZh: '地球发射 · 最快星际启程',
    titleEn: 'Launch from Earth · Fastest Escape',
    shortZh: '地球发射',
    shortEn: 'Launch',
    badgeZh: '45.1 km/s 启程',
    badgeEn: '45.1 km/s ESCAPE',
    bodyZh:
      '新视野号搭乘宇宙神 5 号 551 型重型火箭从卡纳维拉尔角发射升空，以约 16.26 km/s 的相对地球逃逸速度（日心速度 45.1 km/s）创下人类航天器离地最快纪录，仅用 9 小时便越过月球轨道。',
    bodyEn:
      'Launched aboard an Atlas V 551 from Cape Canaveral, New Horizons departed Earth at a record 16.26 km/s (45.1 km/s heliocentric), crossing the Moon’s orbit in just 9 hours.',
    source: newHorizonsMission,
    defaultView: 'overview',
    focusBodyId: 'Earth',
  },
  {
    id: 'jupiter',
    year: NH_JUPITER_YEAR,
    timeMs: NH_JUPITER_MS,
    dateZh: '2007.02.28',
    dateEn: '2007-02-28',
    au: 5.35,
    titleZh: '木星引力借力与火山观测',
    titleEn: 'Jupiter Gravity Assist & Io Plume',
    shortZh: '木星借力',
    shortEn: 'Jupiter',
    badgeZh: '加速 +4 km/s',
    badgeEn: '+4 km/s BOOST',
    bodyZh:
      '在距木星中心 230.5 万千米处高速掠过，借助木星强大引力获得约 4 km/s 的额外加速，使飞往冥王星的航程缩短了整整 3 年；途中首次连续拍下木卫一特瓦什塔火山高达 330 千米的壮观喷流。',
    bodyEn:
      'Passing 2.30 million km from Jupiter’s center, New Horizons gained a ~4 km/s gravity-assist boost that shaved 3 years off its trip to Pluto, while capturing a towering 330 km volcanic plume on Io.',
    source: newHorizonsMission,
    defaultView: 'jupiter',
    focusBodyId: 'Jupiter',
    photoBodyId: 'Jupiter',
    encounter: 'jupiter',
  },
  {
    id: 'pluto',
    year: NH_PLUTO_YEAR,
    timeMs: NH_PLUTO_MS,
    dateZh: '2015.07.14',
    dateEn: '2015-07-14',
    au: 32.91,
    titleZh: '历史性飞掠冥王星与卡戎系统',
    titleEn: 'Historic Pluto–Charon System Flyby',
    shortZh: '冥王星',
    shortEn: 'Pluto',
    badgeZh: '最近接 13,674 km',
    badgeEn: '13,674 km CA',
    bodyZh:
      '历经九年半、近 50 亿千米跋涉，以 13.78 km/s 相对速度穿行于冥王星与冥卫一卡戎之间，距冥王星中心仅 13,674 千米。LORRI 与 Ralph 仪器揭开了心形汤博区氮冰平原、高耸水冰山脉与稀薄蓝色霾层。',
    bodyEn:
      'After a 9.5-year, 5-billion-km voyage, New Horizons threaded the Pluto–Charon system at 13.78 km/s just 13,674 km from Pluto’s center—revealing the heart-shaped Sputnik Planitia nitrogen glacier, water-ice mountains, and blue atmospheric haze.',
    source: 'https://science.nasa.gov/dwarf-planets/pluto/',
    defaultView: 'pluto',
    focusBodyId: 'Pluto',
    photoBodyId: 'Pluto',
    encounter: 'pluto',
  },
  {
    id: 'arrokoth',
    year: NH_ARROKOTH_YEAR,
    timeMs: NH_ARROKOTH_MS,
    dateZh: '2019.01.01',
    dateEn: '2019-01-01',
    au: 43.28,
    titleZh: '飞掠阿罗科斯 · 人类探测最远天体',
    titleEn: 'Arrokoth Flyby · Farthest World Explored',
    shortZh: '阿罗科斯',
    shortEn: 'Arrokoth',
    badgeZh: '最近接 3,537 km',
    badgeEn: '3,537 km CA',
    bodyZh:
      '在 2019 年元旦以 14.44 km/s 相对速度从距中心仅 3,537 千米处近掠冷经典柯伊伯带天体阿罗科斯（486958），首次近距离揭示由两颗原始星子轻柔合并而成的扁平红褐色“雪人”双瓣结构。',
    bodyEn:
      'On New Year’s Day 2019, New Horizons skimmed just 3,537 km past cold-classical Kuiper Belt object Arrokoth (486958) at 14.44 km/s—the farthest world ever visited, revealing a primordial reddish flattened contact binary.',
    source: 'https://science.nasa.gov/solar-system/kuiper-belt/arrokoth/',
    defaultView: 'arrokoth',
    focusBodyId: 'Arrokoth',
    photoBodyId: 'Arrokoth',
    encounter: 'arrokoth',
  },
  {
    id: 'fiftyAU',
    year: NH_FIFTY_AU_YEAR,
    timeMs: NH_FIFTY_AU_MS,
    dateZh: '2021.04.17',
    dateEn: '2021-04-17',
    au: 50.0,
    titleZh: '突破 50 天文单位 · 穿越经典柯伊伯带外缘',
    titleEn: '50 AU Milestone · Outer Kuiper Belt Edge',
    shortZh: '50 AU 里程碑',
    shortEn: '50 AU',
    badgeZh: '第 5 艘达 50 AU',
    badgeEn: '50 AU REACHED',
    bodyZh:
      '继先驱者 10/11 号与旅行者 1/2 号之后，新视野号成为人类历史上第 5 艘飞抵日心 50 AU（约 75 亿千米）的探测器，并在此处利用 LORRI 望远镜回拍了旅行者 1 号所在天区。',
    bodyEn:
      'New Horizons became only the fifth spacecraft in history to reach 50 AU (~7.5 billion km) from the Sun, marking the classical Kuiper Cliff and imaging the starfield toward Voyager 1.',
    source: newHorizonsMission,
    defaultView: 'overview',
  },
  {
    id: 'cruise',
    year: NH_END_YEAR,
    timeMs: NH_END_MS,
    dateZh: '2026.11',
    dateEn: 'Nov 2026',
    au: 66.13,
    titleZh: '外柯伊伯带与日鞘前沿深空巡航',
    titleEn: 'Outer Kuiper Belt & Heliosphere Cruise',
    shortZh: '深空巡航',
    shortEn: 'Deep Cruise',
    badgeZh: '66.1 AU 巡航中',
    badgeEn: '66.1 AU CRUISE',
    bodyZh:
      '沿人马座方向继续以约 13.6 km/s 深入外太阳系（2019 年后由 SPICE 末态按太阳引力弹道递推），距太阳逾 66 AU，单程无线电光时超过 9 小时，持续利用 SWAP、PEPSSI 与学生尘埃计数器测绘外太阳系粒子与尘埃环境。',
    bodyEn:
      'Cruising outward toward Sagittarius at ~13.6 km/s (propagated ballistically under solar gravity beyond the 2019 SPICE archive), New Horizons exceeds 66 AU—over 9 light-hours away—mapping outer solar wind plasma and Kuiper dust.',
    source: newHorizonsSpiceSource,
    defaultView: 'overview',
  },
]

export const newHorizonsViews: { id: NewHorizonsView; zh: string; en: string }[] = [
  { id: 'overview', zh: '全景轨道', en: 'Overview' },
  { id: 'jupiter', zh: '木星借力', en: 'Jupiter' },
  { id: 'pluto', zh: '冥王星系统', en: 'Pluto System' },
  { id: 'arrokoth', zh: '阿罗科斯', en: 'Arrokoth' },
  { id: 'probe', zh: '3D 探测器', en: 'Spacecraft' },
]

export interface NewHorizonsStats {
  year: number
  timeMs: number
  dateLabel: string
  dateTimeLabel: string
  sunAU: number
  earthAU: number
  earthBillionKm: number
  lightHours: number
  speedKmS: number
  latDeg: number
  lonDeg: number
  activeEncounter: NewHorizonsFlyby | null
  targetDistanceKm: number | null
  targetSpeedKmS: number | null
  caDeltaSec: number | null
  encounterClosestKm: number | null
  encounterTimeMs: number | null
  isPostArchive: boolean
}

export function createInitialNewHorizonsStats(lang: Locale = 'zh'): NewHorizonsStats {
  return {
    year: NH_PLUTO_YEAR,
    timeMs: NH_PLUTO_MS,
    dateLabel: formatMissionDate(NH_PLUTO_YEAR, lang),
    dateTimeLabel: formatMissionDateTime(NH_PLUTO_YEAR, lang),
    sunAU: 32.91,
    earthAU: 31.91,
    earthBillionKm: 4.77,
    lightHours: 4.42,
    speedKmS: 14.53,
    latDeg: 1.91,
    lonDeg: 284.08,
    activeEncounter: 'pluto',
    targetDistanceKm: 13674,
    targetSpeedKmS: 13.78,
    caDeltaSec: 0,
    encounterClosestKm: 13674,
    encounterTimeMs: NH_PLUTO_MS,
    isPostArchive: false,
  }
}

/**
 * Smooth cinematic playback rate (simulated years per real second at 1x speed).
 * Slows gracefully during Jupiter gravity assist, Pluto–Charon flyby, and Arrokoth flyby
 * so users clearly watch each encounter and optical scan; accelerates cleanly across multi-year cruise legs.
 */
export function newHorizonsPlaybackRate(year: number, view: NewHorizonsView = 'overview'): number {
  let base: number
  if (year < 2007.45) {
    base = 0.42
  } else if (year < 2015.0) {
    const t = clamp((year - 2007.45) / (2015.0 - 2007.45), 0, 1)
    const s = t * t * (3 - 2 * t)
    base = 0.42 + (1.55 - 0.42) * s
  } else if (year < 2019.25) {
    base = 0.92
  } else {
    const t = clamp((year - 2019.25) / (2022.0 - 2019.25), 0, 1)
    const s = t * t * (3 - 2 * t)
    base = 0.92 + (1.75 - 0.92) * s
  }

  let factor = 1
  // Smooth Gaussian deceleration around Jupiter, Pluto, and Arrokoth encounters
  const jupDt = (year - NH_JUPITER_YEAR) / 0.14
  factor = Math.min(factor, 1 - 0.72 * Math.exp(-0.5 * jupDt * jupDt))
  const pluDt = (year - NH_PLUTO_YEAR) / 0.16
  factor = Math.min(factor, 1 - 0.78 * Math.exp(-0.5 * pluDt * pluDt))
  const arrDt = (year - NH_ARROKOTH_YEAR) / 0.14
  factor = Math.min(factor, 1 - 0.78 * Math.exp(-0.5 * arrDt * arrDt))

  let rate = Math.max(0.06, base * factor)

  // Resolve real-time encounter flyby corridors smoothly (just like Voyager 2's Neptune-Triton pass!)
  const yearSec = 365.25 * 86400
  const jupHours = Math.abs(year - NH_JUPITER_YEAR) * 365.25 * 24
  if (jupHours < 72) {
    const hRate = view === 'jupiter' ? 3.2 + 0.45 * jupHours : 9.0 + 0.9 * jupHours
    rate = Math.min(rate, hRate / (365.25 * 24))
  }
  const pluMin = Math.abs(year - NH_PLUTO_YEAR) * 365.25 * 24 * 60
  if (pluMin < 180) {
    const mRate = view === 'pluto' ? 4.2 + 0.45 * pluMin : 14.0 + 0.95 * pluMin
    rate = Math.min(rate, (mRate * 60) / yearSec)
  }
  const arrMin = Math.abs(year - NH_ARROKOTH_YEAR) * 365.25 * 24 * 60
  if (arrMin < 90) {
    const mRate = view === 'arrokoth' ? 1.8 + 0.45 * arrMin : 7.5 + 0.95 * arrMin
    rate = Math.min(rate, (mRate * 60) / yearSec)
  }

  return rate
}

export function formatCaOffset(deltaSec: number): string {
  const sign = deltaSec < 0 ? '−' : '+'
  const abs = Math.round(Math.abs(deltaSec))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `T${sign}${String(h).padStart(2, '0')}:${mm}:${ss}` : `T${sign}${mm}:${ss}`
}

export function nhMilestoneTitle(m: NewHorizonsMilestone, lang: Locale): string {
  return pick(m.titleZh, m.titleEn, lang)
}

export function nhMilestoneShort(m: NewHorizonsMilestone, lang: Locale): string {
  return pick(m.shortZh, m.shortEn, lang)
}

export function nhMilestoneBody(m: NewHorizonsMilestone, lang: Locale): string {
  return pick(m.bodyZh, m.bodyEn, lang)
}

export function nhMilestoneBadge(m: NewHorizonsMilestone, lang: Locale): string {
  if (!m.badgeZh && !m.badgeEn) return ''
  return pick(m.badgeZh ?? '', m.badgeEn ?? '', lang)
}
