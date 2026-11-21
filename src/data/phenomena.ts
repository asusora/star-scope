import * as T from 'three'
import {
  formatMissionDate,
  formatMissionDateTime,
  planetHeliocentricAU,
  planetTrueLonRad,
  utcToYear,
} from './voyager'
import type { PhenomenonId, PhenomenonMetric, PhenomenonStats } from '../scene/types'
import { clamp, rad, tau, v3 } from '../scene/math'
import { pick, type Locale } from '../i18n'

export interface PhenomenonMilestone {
  id: string
  year: number
  yearLabel: string
  shortZh: string
  shortEn: string
  titleZh: string
  titleEn: string
  bodyZh: string
  bodyEn: string
  source: string
  viewId: string
  highlight?: boolean
}

export interface PhenomenonViewOption {
  id: string
  zh: string
  en: string
}

export interface PhenomenonDefinition {
  id: PhenomenonId
  yearBadge: string
  code: string
  shortZh: string
  shortEn: string
  nameZh: string
  nameEn: string
  kickerZh: string
  kickerEn: string
  startYear: number
  endYear: number
  defaultYear: number
  defaultView: string
  peakYear: number
  subDayClock?: boolean
  milestones: PhenomenonMilestone[]
  views: PhenomenonViewOption[]
}

export const ALIGNMENT_BODY_IDS = [
  'Mercury',
  'Venus',
  'Earth',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const

export const INNER_BODY_IDS = ['Mercury', 'Venus', 'Earth', 'Mars'] as const

export interface Sl9Fragment {
  id: string
  impactYear: number
  sizeWeight: number // 0.35..1.0 relative fireball & scar scale
  energyMt: number // rough TNT equivalent in megatons
  latDeg: number // southern impact latitude (~-43 to -45 deg)
}

export const SL9_ROCHE_YEAR = utcToYear(1992, 7, 7, 18, 0)
export const SL9_DISCOVERY_YEAR = utcToYear(1993, 3, 24, 12, 0)
export const SL9_IMPACT_START = utcToYear(1994, 7, 16, 15, 0)
export const SL9_IMPACT_END = utcToYear(1994, 7, 22, 16, 0)
export const JUPITER_ROTATION_HOURS = 9.925

// Authentic NASA/JPL July 16–22, 1994 UTC impact sequence of Shoemaker-Levy 9 (21 fragments A–W)
export const sl9Fragments: Sl9Fragment[] = [
  { id: 'A', impactYear: utcToYear(1994, 7, 16, 20, 13), sizeWeight: 0.72, energyMt: 220_000, latDeg: -43.2 },
  { id: 'B', impactYear: utcToYear(1994, 7, 17, 2, 50), sizeWeight: 0.42, energyMt: 45_000, latDeg: -43.0 },
  { id: 'C', impactYear: utcToYear(1994, 7, 17, 7, 12), sizeWeight: 0.64, energyMt: 160_000, latDeg: -43.3 },
  { id: 'D', impactYear: utcToYear(1994, 7, 17, 11, 54), sizeWeight: 0.48, energyMt: 70_000, latDeg: -43.5 },
  { id: 'E', impactYear: utcToYear(1994, 7, 17, 15, 11), sizeWeight: 0.78, energyMt: 380_000, latDeg: -43.5 },
  { id: 'F', impactYear: utcToYear(1994, 7, 18, 0, 33), sizeWeight: 0.40, energyMt: 40_000, latDeg: -43.6 },
  { id: 'G', impactYear: utcToYear(1994, 7, 18, 7, 33), sizeWeight: 1.00, energyMt: 6_000_000, latDeg: -43.6 },
  { id: 'H', impactYear: utcToYear(1994, 7, 18, 19, 32), sizeWeight: 0.80, energyMt: 420_000, latDeg: -43.8 },
  { id: 'K', impactYear: utcToYear(1994, 7, 19, 10, 24), sizeWeight: 0.90, energyMt: 2_000_000, latDeg: -43.8 },
  { id: 'L', impactYear: utcToYear(1994, 7, 19, 22, 16), sizeWeight: 0.94, energyMt: 3_500_000, latDeg: -43.9 },
  { id: 'N', impactYear: utcToYear(1994, 7, 20, 10, 29), sizeWeight: 0.44, energyMt: 55_000, latDeg: -44.2 },
  { id: 'P2', impactYear: utcToYear(1994, 7, 20, 15, 23), sizeWeight: 0.40, energyMt: 35_000, latDeg: -44.6 },
  { id: 'P1', impactYear: utcToYear(1994, 7, 20, 16, 40), sizeWeight: 0.35, energyMt: 25_000, latDeg: -44.5 },
  { id: 'Q2', impactYear: utcToYear(1994, 7, 20, 19, 44), sizeWeight: 0.62, energyMt: 180_000, latDeg: -44.3 },
  { id: 'Q1', impactYear: utcToYear(1994, 7, 20, 20, 13), sizeWeight: 0.88, energyMt: 1_800_000, latDeg: -44.0 },
  { id: 'R', impactYear: utcToYear(1994, 7, 21, 5, 34), sizeWeight: 0.72, energyMt: 260_000, latDeg: -44.1 },
  { id: 'S', impactYear: utcToYear(1994, 7, 21, 15, 16), sizeWeight: 0.76, energyMt: 340_000, latDeg: -44.2 },
  { id: 'T', impactYear: utcToYear(1994, 7, 21, 18, 11), sizeWeight: 0.38, energyMt: 30_000, latDeg: -44.8 },
  { id: 'U', impactYear: utcToYear(1994, 7, 21, 21, 56), sizeWeight: 0.40, energyMt: 35_000, latDeg: -44.5 },
  { id: 'V', impactYear: utcToYear(1994, 7, 22, 4, 23), sizeWeight: 0.45, energyMt: 60_000, latDeg: -44.3 },
  { id: 'W', impactYear: utcToYear(1994, 7, 22, 8, 6), sizeWeight: 0.78, energyMt: 400_000, latDeg: -44.2 },
]

export const phenomenaList: PhenomenonDefinition[] = [
  {
    id: 'alignment1982',
    yearBadge: '1982',
    code: 'SYZYGY 1982',
    shortZh: '九星连珠',
    shortEn: '9-Planet Align',
    nameZh: '1982 九星连珠',
    nameEn: '1982 Grand Alignment',
    kickerZh: 'RARE SYZYGY // 1980–1983',
    kickerEn: 'RARE SYZYGY // 1980–1983',
    startYear: utcToYear(1980, 6, 1),
    endYear: utcToYear(1983, 12, 1),
    defaultYear: utcToYear(1981, 4, 15),
    defaultView: 'top',
    peakYear: utcToYear(1982, 3, 10),
    milestones: [
      {
        id: 'assemble',
        year: utcToYear(1980, 6, 15),
        yearLabel: '1980',
        shortZh: '巨星就位',
        shortEn: 'Giants Align',
        titleZh: '外太阳系巨行星率先汇聚同侧',
        titleEn: 'Outer Giant Planets Gather on One Side',
        bodyZh:
          '木星、土星、天王星、海王星与冥王星陆续运行至太阳同一侧扇区——这种每隔约 179 年才会重现的外行星几何排布，正是旅行者号大巡游与 1982 年九星连珠的天文基础。',
        bodyEn:
          'Jupiter, Saturn, Uranus, Neptune, and Pluto gather into a single heliocentric quadrant—a ~179-year outer-planet geometry that enabled both the Voyager Grand Tour and the 1982 alignment.',
        source: 'https://science.nasa.gov/solar-system/planets/',
        viewId: 'top',
      },
      {
        id: 'converge',
        year: utcToYear(1981, 5, 1),
        yearLabel: '1981',
        shortZh: '内星加速',
        shortEn: 'Converging',
        titleZh: '内太阳系四行星加速汇入扇区',
        titleEn: 'Inner Planets Sweep Into the Sector',
        bodyZh:
          '随着木星与土星完成交会，公转更快的水星、金星、地球与火星正朝外行星所在的西南黄经扇区收拢，九大天体的最小张角从 200° 以上迅速收窄。',
        bodyEn:
          'Following the Jupiter–Saturn conjunction, faster-orbiting Mercury, Venus, Earth, and Mars sweep toward the outer planets’ sector, rapidly shrinking the 9-world angular span.',
        source: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
        viewId: 'top',
      },
      {
        id: 'peak1982',
        year: utcToYear(1982, 3, 7),
        yearLabel: '1982.03',
        shortZh: '九星连珠',
        shortEn: '95.5° Peak',
        titleZh: '九星连珠极值 · 95.5° 同侧汇聚',
        titleEn: 'Nine-Planet Alignment Peak · 95.5° Sector',
        bodyZh:
          '1982 年 3 月 10 日，八大行星与当时列为第九大行星的冥王星全部汇聚在太阳同侧仅约 95.5° 的扇形区域内。虽然并非严格直线，但这是近两个世纪罕见的全体同侧汇聚奇观。',
        bodyEn:
          'On March 10, 1982, all eight planets plus Pluto gathered on the same side of the Sun inside a ~95.5° sector—one of the tightest full-system alignments in nearly two centuries.',
        source: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
        viewId: 'top',
        highlight: true,
      },
      {
        id: 'innerSweep',
        year: utcToYear(1982, 10, 15),
        yearLabel: '1982.10',
        shortZh: '渐次分离',
        shortEn: 'Dispersing',
        titleZh: '地球与内行星率先驶离汇聚扇区',
        titleEn: 'Inner Planets Pull Out of Alignment',
        bodyZh:
          '内行星公转周期远短于外行星。数月后水星、金星与地球迅速转至太阳另一侧，汇聚张角重新张开，而木星至冥王星仍缓慢维持外圈队列。',
        bodyEn:
          'Within months, fast-moving Mercury, Venus, and Earth swing around to the far side of the Sun, widening the overall span while the outer giants slowly drift apart.',
        source: 'https://science.nasa.gov/solar-system/planets/',
        viewId: 'overview',
      },
      {
        id: 'aftermath',
        year: utcToYear(1983, 6, 1),
        yearLabel: '1983',
        shortZh: '回归周天',
        shortEn: 'Separated',
        titleZh: '九星散开 · 静待下个世纪重逢',
        titleEn: 'Planetary Ranks Disperse Around the Ecliptic',
        bodyZh:
          '随着火星与木星逐步拉开相位，九星连珠窗口落幕。下一次九颗天体重新汇聚在 100° 以内将跨越逾百年时光。可随时暂停并切换不同视角细看轨道夹角。',
        bodyEn:
          'As Mars and Jupiter widen their phase gap, the rare syzygy window closes—it will be more than a century before all nine worlds gather within 100° again.',
        source: 'https://science.nasa.gov/solar-system/planets/',
        viewId: 'overview',
      },
    ],
    views: [
      { id: 'top', zh: '黄道俯视', en: 'Top View' },
      { id: 'overview', zh: '全景斜视', en: 'Overview' },
      { id: 'inner', zh: '内太阳系', en: 'Inner Belt' },
      { id: 'edge', zh: '侧面黄道', en: 'Edge-On' },
    ],
  },
  {
    id: 'sl9_1994',
    yearBadge: '1994',
    code: 'SL9 IMPACT',
    shortZh: '彗木相撞',
    shortEn: 'SL9 Impact',
    nameZh: '1994 彗星撞击木星',
    nameEn: 'Shoemaker–Levy 9 Impact',
    kickerZh: 'COSMIC IMPACT // 1992–1994',
    kickerEn: 'COSMIC IMPACT // 1992–1994',
    startYear: utcToYear(1992, 7, 1, 0, 0),
    endYear: utcToYear(1994, 7, 23, 18, 0),
    defaultYear: utcToYear(1994, 7, 16, 15, 30),
    defaultView: 'closeup',
    peakYear: utcToYear(1994, 7, 18, 7, 33),
    subDayClock: true,
    milestones: [
      {
        id: 'roche',
        year: utcToYear(1992, 7, 6, 12, 0),
        yearLabel: '1992.07',
        shortZh: '洛希撕裂',
        shortEn: 'Roche Split',
        titleZh: '闯入木星洛希极限 · 潮汐力撕裂',
        titleEn: 'Tidal Disruption Inside Jupiter’s Roche Limit',
        bodyZh:
          '1992 年 7 月 7 日，被木星引力捕获的苏梅克-列维 9 号彗星在距木星云顶仅约 2.5 万公里处掠过，超越木星洛希极限，被极端潮汐力撕碎成 21 块大小不一的冰岩碎片。',
        bodyEn:
          'On July 7, 1992, Comet Shoemaker–Levy 9 skimmed within 25,000 km of Jupiter’s cloud tops, crossing the Roche limit where brutal tidal forces tore the nucleus into 21 fragments.',
        source: 'https://science.nasa.gov/solar-system/comets/p-shoemaker-levy-9/',
        viewId: 'orbit',
      },
      {
        id: 'discovery',
        year: utcToYear(1993, 3, 24, 12, 0),
        yearLabel: '1993.03',
        shortZh: '珍珠项链',
        shortEn: 'Discovery',
        titleZh: '帕洛马天文台发现“太空珍珠项链”',
        titleEn: '“String of Pearls” Discovered Near Apoapsis',
        bodyZh:
          '1993 年 3 月 24 日，尤金与卡罗琳·苏梅克夫妇及大卫·列维在底片上发现这串拉长达数百万公里的 21 颗明亮彗星碎片队列，轨道计算震惊世界：它将在 1994 年 7 月直撞木星！',
        bodyEn:
          'On March 24, 1993, Carolyn & Eugene Shoemaker and David Levy discovered the stretched train of 21 gleaming nuclei—orbit calculations revealed an imminent collision with Jupiter in July 1994.',
        source: 'https://science.nasa.gov/solar-system/comets/p-shoemaker-levy-9/',
        viewId: 'train',
      },
      {
        id: 'fragA',
        year: utcToYear(1994, 7, 16, 17, 30),
        yearLabel: '07.16 A',
        shortZh: '碎片 A 首撞',
        shortEn: 'Frag A Hit',
        titleZh: '碎片 A 首次撞击 · 人类首次目击天体大撞击',
        titleEn: 'Fragment A Strikes · First Observed Planetary Impact',
        bodyZh:
          '1994 年 7 月 16 日 20:13 UTC，首块碎片 A 以每秒 60 公里（约 21.6 万 km/h）的惊人速度扎入木星南纬 43° 云层，激起超过 1000 公里高的炽热火球羽流。',
        bodyEn:
          'At 20:13 UTC on July 16, 1994, Fragment A plunged into Jupiter’s southern cloud deck at 60 km/s, igniting a searing fireball plume over 1,000 km tall.',
        source: 'https://science.nasa.gov/solar-system/comets/p-shoemaker-levy-9/',
        viewId: 'closeup',
      },
      {
        id: 'fragG',
        year: utcToYear(1994, 7, 18, 5, 0),
        yearLabel: '07.18 G',
        shortZh: '碎片 G 巨爆',
        shortEn: 'Frag G Blast',
        titleZh: '碎片 G 超级撞击 · 600 万百万吨 TNT 当量',
        titleEn: 'Fragment G Mega-Impact · 6,000,000 MT TNT',
        bodyZh:
          '7 月 18 日 07:33 UTC，体积最大的碎片 G 猛烈撞击木星，瞬间释放约 600 万百万吨 TNT 当量（相当于全球核武库总和的数百倍），在木星云顶炸出直径超过地球的巨型暗斑！',
        bodyEn:
          'At 07:33 UTC on July 18, massive Fragment G unleashed ~6 million megatons of TNT—hundreds of times Earth’s entire nuclear arsenal—carving a dark scar wider than Earth itself.',
        source: 'https://esahubble.org/images/opo9434a/',
        viewId: 'closeup',
        highlight: true,
      },
      {
        id: 'fragQ',
        year: utcToYear(1994, 7, 20, 17, 30),
        yearLabel: '07.20 Q',
        shortZh: 'Q1/Q2 连撞',
        shortEn: 'Frag Q Twin',
        titleZh: '碎片 Q2 与 Q1 双星连撞 · 暗斑随木星自转成链',
        titleEn: 'Twin Fragments Q2 & Q1 Strike the Rotating Belt',
        bodyZh:
          '木星每 9.9 小时高速自转一周，使接连落下的碎片撞击在不同经度上。至 7 月 20 日 Q1 巨型碎片命中时，木星南半球已串起一圈触目惊心的黑斑项链。',
        bodyEn:
          'Jupiter’s rapid 9.9-hour spin spreads successive strikes across longitude. By Fragment Q1’s strike on July 20, a haunting chain of dark impact scars rings the southern hemisphere.',
        source: 'https://science.nasa.gov/solar-system/comets/p-shoemaker-levy-9/',
        viewId: 'south',
      },
      {
        id: 'fragW',
        year: utcToYear(1994, 7, 22, 6, 0),
        yearLabel: '07.22 W',
        shortZh: '终章暗斑链',
        shortEn: 'Frag W Finale',
        titleZh: '碎片 W 终章谢幕 · 宇宙级伤痕持续数月',
        titleEn: 'Fragment W Finale · Scars Lingering for Months',
        bodyZh:
          '7 月 22 日 08:06 UTC，最后一块碎片 W 化作火球没入木星大气，为期 6 天的 21 轮连环轰炸落幕。这些由撞击扬起的暗色尘埃疤痕在木星上空清晰可见长达数月。',
        bodyEn:
          'At 08:06 UTC on July 22, final Fragment W vanished into Jupiter, ending six days of cosmic bombardment. The dark stratospheric scars remained visible from Earth for months.',
        source: 'https://science.nasa.gov/solar-system/comets/p-shoemaker-levy-9/',
        viewId: 'south',
      },
    ],
    views: [
      { id: 'closeup', zh: '撞击特写', en: 'Impact View' },
      { id: 'train', zh: '珍珠项链', en: 'Pearl Train' },
      { id: 'orbit', zh: '捕获轨道', en: 'Capture Orbit' },
      { id: 'south', zh: '南极疤痕', en: 'South Scars' },
    ],
  },
  {
    id: 'conjunction2020',
    yearBadge: '2020',
    code: 'GREAT CONJ.',
    shortZh: '土木大合',
    shortEn: 'Great Conj.',
    nameZh: '2020 土木大合',
    nameEn: '2020 Great Conjunction',
    kickerZh: 'CONJUNCTION // 2019–2022',
    kickerEn: 'CONJUNCTION // 2019–2022',
    startYear: utcToYear(2019, 6, 1),
    endYear: utcToYear(2022, 5, 1),
    defaultYear: utcToYear(2020, 6, 15),
    defaultView: 'sightline',
    peakYear: utcToYear(2020, 12, 21, 18, 22),
    milestones: [
      {
        id: 'approach2019',
        year: utcToYear(2019, 7, 1),
        yearLabel: '2019',
        shortZh: '木星追赶',
        shortEn: 'Closing In',
        titleZh: '木星沿内圈高速追赶土星',
        titleEn: 'Jupiter Overtakes Saturn Along the Inner Track',
        bodyZh:
          '木星公转周期约 11.86 年，土星约 29.45 年，每隔约 19.86 年木星就会从内圈追上土星一次。2019 年中旬，两者在地球夜空中的角距正从 20° 以外稳步收窄。',
        bodyEn:
          'Orbiting in 11.86 years versus Saturn’s 29.45 years, Jupiter laps Saturn every 19.86 years. By mid-2019 their sky separation is rapidly closing from over 20°.',
        source: 'https://science.nasa.gov/solar-system/skywatching/the-great-conjunction-of-jupiter-and-saturn/',
        viewId: 'top',
      },
      {
        id: 'summer2020',
        year: utcToYear(2020, 7, 15),
        yearLabel: '2020.07',
        shortZh: '双星冲日',
        shortEn: 'Oppositions',
        titleZh: '2020 仲夏双星相继冲日 · 视距逼近 6°',
        titleEn: 'Summer Oppositions · Separation Shrinks to 6°',
        bodyZh:
          '2020 年 7 月，地球恰好穿行至太阳与木星、土星之间，两颗巨行星相隔不到一周先后冲日，在地球夜空构成醒目的双星伴行景象。',
        bodyEn:
          'In July 2020, Earth passes directly between the Sun and the approaching gas giants, bringing both planets to opposition within a week of each other.',
        source: 'https://science.nasa.gov/solar-system/skywatching/the-great-conjunction-of-jupiter-and-saturn/',
        viewId: 'overview',
      },
      {
        id: 'peak2020',
        year: utcToYear(2020, 12, 21, 18, 22),
        yearLabel: '2020.12',
        shortZh: '0.1° 大合',
        shortEn: '0.1° Peak',
        titleZh: '冬至“圣诞之星” · 仅 0.1° 极近大合',
        titleEn: 'Winter Solstice “Christmas Star” · 0.1° Separation',
        bodyZh:
          '2020 年 12 月 21 日，地球、木星与土星几乎排成一线，从地球望去木星与土星的视角距离仅 0.1°（约满月直径的 1/5），是自 1623 年以来近 400 年最接近的一次土木大合！',
        bodyEn:
          'On December 21, 2020, Earth’s line of sight aligned Jupiter and Saturn to within just 0.1° (a fifth of a full Moon)—their closest Great Conjunction since 1623.',
        source: 'https://science.nasa.gov/solar-system/skywatching/the-great-conjunction-of-jupiter-and-saturn/',
        viewId: 'sightline',
        highlight: true,
      },
      {
        id: 'recede2021',
        year: utcToYear(2021, 7, 1),
        yearLabel: '2021',
        shortZh: '木星超越',
        shortEn: 'Pulling Ahead',
        titleZh: '木星完成超越 · 视线夹角迅速拉开',
        titleEn: 'Jupiter Pulls Ahead of Saturn',
        bodyZh:
          '大合过后，跑得更快的木星迅速领先土星。切换「黄道俯视」可直观看到尽管地球视角中两星几乎重合，实际上它们在三维空间仍相距超过 4.9 AU（约 7.3 亿公里）。',
        bodyEn:
          'After conjunction, faster Jupiter pulls steadily ahead. Switch to Top View to see that even at 0.1° alignment, the two giants stayed more than 4.9 AU (730 million km) apart in 3D space.',
        source: 'https://science.nasa.gov/solar-system/skywatching/the-great-conjunction-of-jupiter-and-saturn/',
        viewId: 'top',
      },
      {
        id: 'apart2022',
        year: utcToYear(2022, 1, 15),
        yearLabel: '2022',
        shortZh: '天穹远别',
        shortEn: 'Wide Apart',
        titleZh: '双星分道扬镳 · 下次极近大合在 2080 年',
        titleEn: 'Wide Separation · Next Ultra-Close Pairing in 2080',
        bodyZh:
          '进入 2022 年，木星与土星的视线夹角已拉开逾 25°。下一次同样逼近 0.1° 的极近土木大合要等到 2080 年 3 月 15 日才会再度上演。',
        bodyEn:
          'By 2022 the two giants are separated by over 25°. Humanity must wait until March 15, 2080 for another Great Conjunction equally close to 0.1°.',
        source: 'https://science.nasa.gov/solar-system/skywatching/the-great-conjunction-of-jupiter-and-saturn/',
        viewId: 'overview',
      },
    ],
    views: [
      { id: 'sightline', zh: '地球视线', en: 'Earth View' },
      { id: 'top', zh: '黄道俯视', en: 'Top View' },
      { id: 'overview', zh: '外星全景', en: 'Overview' },
      { id: 'side', zh: '侧面倾角', en: 'Side View' },
    ],
  },
  {
    id: 'oumuamua2017',
    yearBadge: '2017',
    code: '1I/ʻOUMUAMUA',
    shortZh: '奥陌陌穿越',
    shortEn: 'ʻOumuamua',
    nameZh: '2017 星际访客 · 奥陌陌',
    nameEn: '1I/ʻOumuamua Flyby',
    kickerZh: 'INTERSTELLAR // 2017–2018',
    kickerEn: 'INTERSTELLAR // 2017–2018',
    startYear: utcToYear(2017, 1, 1),
    endYear: utcToYear(2018, 12, 1),
    defaultYear: utcToYear(2017, 7, 15),
    defaultView: 'overview',
    peakYear: utcToYear(2017, 9, 9, 12, 0),
    milestones: [
      {
        id: 'dive2017',
        year: utcToYear(2017, 2, 1),
        yearLabel: '2017.02',
        shortZh: '高纬俯冲',
        shortEn: 'Lyra Dive',
        titleZh: '来自天琴座方向的高倾角星际俯冲',
        titleEn: 'Steep Interstellar Plunge From Lyra',
        bodyZh:
          '人类确认的首个星际天体 1I/ʻOumuamua（奥陌陌）以约 122.7° 的极陡倾角与 1.201 的双曲线偏心率，从太阳系黄道面北侧天琴座方向垂直俯冲而来，不受太阳引力束缚。',
        bodyEn:
          'The first confirmed interstellar object, 1I/ʻOumuamua, plunged steeply from above the ecliptic near Lyra on an unbound hyperbolic trajectory (e = 1.201, i = 122.7°).',
        source: 'https://science.nasa.gov/solar-system/comets/oumuamua/',
        viewId: 'side',
      },
      {
        id: 'perihelion',
        year: utcToYear(2017, 9, 9, 11, 45),
        yearLabel: '2017.09',
        shortZh: '近日点急转',
        shortEn: 'Perihelion',
        titleZh: '0.255 AU 近日点弹弓 · 飙至 87.7 km/s',
        titleEn: '0.255 AU Perihelion Slingshot · 87.7 km/s',
        bodyZh:
          '2017 年 9 月 9 日，奥陌陌深入水星轨道内侧仅 0.255 AU 处，在太阳强大引力下急剧折转方向，日心速度飙升至每秒 87.7 公里，随即猛然跃出黄道面下方。',
        bodyEn:
          'On September 9, 2017, ʻOumuamua whipped inside Mercury’s orbit at 0.255 AU, accelerating to 87.7 km/s as solar gravity bent its hyperbolic path sharply back outward.',
        source: 'https://science.nasa.gov/solar-system/comets/oumuamua/',
        viewId: 'perihelion',
        highlight: true,
      },
      {
        id: 'earthPass',
        year: utcToYear(2017, 10, 14, 12, 0),
        yearLabel: '10.14 近地',
        shortZh: '近掠地球',
        shortEn: 'Earth Pass',
        titleZh: '0.16 AU 近距擦过地球轨道',
        titleEn: '0.16 AU Closest Approach to Earth',
        bodyZh:
          '10 月 14 日，翻滚前行的雪茄状星际访客在距地球仅 0.16 AU（约 2400 万公里，约 63 倍地月距离）处擦肩而过，比发现日期还早了 5 天。',
        bodyEn:
          'On October 14, the tumbling elongated interstellar object swept just 0.16 AU (24 million km) past Earth—five days before telescopes finally spotted it.',
        source: 'https://science.nasa.gov/solar-system/comets/oumuamua/',
        viewId: 'object',
      },
      {
        id: 'discover',
        year: utcToYear(2017, 10, 19, 12, 0),
        yearLabel: '10.19 发现',
        shortZh: '首次发现',
        shortEn: 'Discovery',
        titleZh: '夏威夷 Pan-STARRS 首次捕获星际信使',
        titleEn: 'Discovered by Pan-STARRS in Hawaii',
        bodyZh:
          '2017 年 10 月 19 日，夏威夷泛星计划望远镜发现这颗正在远去的神秘暗红天体，夏威夷语命名“ʻOumuamua”意为“来自远方的首位信使”，后被发现存在微弱非引力加速。',
        bodyEn:
          'Spotted on October 19, 2017 by Hawaii’s Pan-STARRS1 telescope as it raced away, ʻOumuamua (“first distant messenger”) later revealed a subtle non-gravitational acceleration.',
        source: 'https://science.nasa.gov/solar-system/comets/oumuamua/',
        viewId: 'overview',
      },
      {
        id: 'escape',
        year: utcToYear(2018, 5, 1, 12, 0),
        yearLabel: '2018.05',
        shortZh: '永别太阳系',
        shortEn: 'Escape',
        titleZh: '越过木星轨道 · 奔赴飞马座深空永不再返',
        titleEn: 'Past Jupiter’s Orbit · Bound for Pegasus Forever',
        bodyZh:
          '2018 年 5 月，奥陌陌以远超太阳逃逸速度的双曲线轨迹越过木星轨道，朝飞马座方向永别太阳系，重新融入浩瀚银河星际空间。',
        bodyEn:
          'By May 2018, ʻOumuamua crossed beyond Jupiter’s orbit on its permanent escape trajectory toward Pegasus, returning forever to interstellar space.',
        source: 'https://science.nasa.gov/solar-system/comets/oumuamua/',
        viewId: 'overview',
      },
    ],
    views: [
      { id: 'overview', zh: '双曲线全景', en: 'Overview' },
      { id: 'perihelion', zh: '近日点急转', en: 'Perihelion' },
      { id: 'side', zh: '高倾角俯冲', en: 'Steep Dive' },
      { id: 'object', zh: '天体特写', en: 'Close-Up' },
    ],
  },
]

export function getPhenomenon(id: PhenomenonId): PhenomenonDefinition {
  return phenomenaList.find((p) => p.id === id) ?? phenomenaList[0]
}

export function phenomenonName(p: PhenomenonDefinition, lang: Locale = 'zh'): string {
  return pick(p.nameZh, p.nameEn, lang)
}

export function phenomenonShort(p: PhenomenonDefinition, lang: Locale = 'zh'): string {
  return pick(p.shortZh, p.shortEn, lang)
}

export function phenomenonMilestoneTitle(m: PhenomenonMilestone, lang: Locale = 'zh'): string {
  return pick(m.titleZh, m.titleEn, lang)
}

export function phenomenonMilestoneShort(m: PhenomenonMilestone, lang: Locale = 'zh'): string {
  return pick(m.shortZh, m.shortEn, lang)
}

export function phenomenonMilestoneBody(m: PhenomenonMilestone, lang: Locale = 'zh'): string {
  return pick(m.bodyZh, m.bodyEn, lang)
}

export function nearestPhenomenonMilestone(id: PhenomenonId, year: number): PhenomenonMilestone {
  const def = getPhenomenon(id)
  let active = def.milestones[0]
  for (const m of def.milestones) {
    if (year >= m.year - 1e-6) active = m
  }
  return active
}

/**
 * Smooth, astronomically tailored playback rate (simulated years per real second at 1× speed).
 * Slows gracefully around peak windows—and drops to hours-per-second during SL9's 6-day
 * bombardment of Jupiter so every single fragment strike can be observed and paused!
 */
export function phenomenonPlaybackRate(id: PhenomenonId, year: number): number {
  if (id === 'alignment1982') {
    const daysFromPeak = (year - utcToYear(1982, 3, 10)) * 365.25
    // Gentle, fluid cruise (~40 days/s, Mercury orbits smoothly in ~2.2s) gliding smoothly down
    // to ~2.2 days/s right inside the golden 1982.03 alignment window with zero abrupt braking.
    const tightSlow = 1 - 0.945 * Math.exp(-0.5 * (daysFromPeak / 16) ** 2)
    const broadSlow = 1 - 0.58 * Math.exp(-0.5 * (daysFromPeak / 90) ** 2)
    return Math.max(2.2 / 365.25, 0.115 * Math.min(tightSlow, broadSlow))
  }
  if (id === 'sl9_1994') {
    // Impact week: ~0.165 simulated days/sec (~4 hours/s) so Jupiter rotates majestically once every ~2.5s
    // and each fragment strike, fireball shockwave, and rotating scar unfolds smoothly!
    const impactRate = 0.165 / 365.25
    const daysToImpactStart = (SL9_IMPACT_START - year) * 365.25
    if (daysToImpactStart <= 0.5) return impactRate
    if (daysToImpactStart < 34) {
      const t = clamp((daysToImpactStart - 0.5) / 33.5, 0, 1)
      const s = t * t * t * (t * (t * 6 - 15) + 10)
      return impactRate + (0.36 - impactRate) * s
    }
    const dtRoche = (year - SL9_ROCHE_YEAR) / 0.055
    const dtDisc = (year - SL9_DISCOVERY_YEAR) / 0.09
    const factor = Math.min(
      1 - 0.84 * Math.exp(-0.5 * dtRoche * dtRoche),
      1 - 0.52 * Math.exp(-0.5 * dtDisc * dtDisc),
    )
    return Math.max(0.045, 0.38 * factor)
  }
  if (id === 'conjunction2020') {
    const dt = (year - utcToYear(2020, 12, 21, 18, 22)) / 0.22
    const slow = 1 - 0.84 * Math.exp(-0.5 * dt * dt)
    return 0.165 * slow
  }
  // 1I/'Oumuamua: fluid cruise slowing seamlessly around perihelion (2017-09-09) & Earth pass (2017-10-14)
  const dtPeri = (year - utcToYear(2017, 9, 9, 12)) / 0.075
  const dtEarth = (year - utcToYear(2017, 10, 14, 12)) / 0.08
  const factor = Math.min(
    1 - 0.82 * Math.exp(-0.5 * dtPeri * dtPeri),
    1 - 0.72 * Math.exp(-0.5 * dtEarth * dtEarth),
  )
  return Math.max(0.026, 0.16 * factor)
}

export interface AlignmentArcState {
  spanDeg: number
  innerSpanDeg: number
  startLonRad: number
  sweepRad: number
  in100Count: number
  daysToPeak: number
}

function minimalSector(lonsDeg: number[]): { spanDeg: number; startDeg: number } {
  const sorted = lonsDeg.map((d) => ((d % 360) + 360) % 360).sort((a, b) => a - b)
  let maxGap = -1
  let startIdx = 0
  for (let i = 0; i < sorted.length; i++) {
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1]
    const gap = next - sorted[i]
    if (gap > maxGap) {
      maxGap = gap
      startIdx = (i + 1) % sorted.length
    }
  }
  return {
    spanDeg: Math.max(0, 360 - maxGap),
    startDeg: sorted[startIdx],
  }
}

export function computeAlignmentState(year: number): AlignmentArcState {
  const allLons = ALIGNMENT_BODY_IDS.map((id) => ((planetTrueLonRad(id, year) / rad) % 360 + 360) % 360)
  const innerLons = INNER_BODY_IDS.map((id) => ((planetTrueLonRad(id, year) / rad) % 360 + 360) % 360)
  const full = minimalSector(allLons)
  const inner = minimalSector(innerLons)

  // Count maximum worlds fitting inside any 100° heliocentric sector
  const sorted = [...allLons].sort((a, b) => a - b)
  const ext = [...sorted, ...sorted.map((d) => d + 360)]
  let bestCount = 0
  let j = 0
  for (let i = 0; i < sorted.length; i++) {
    while (j < ext.length && ext[j] - ext[i] <= 100) j++
    bestCount = Math.max(bestCount, j - i)
  }
  const daysToPeak = Math.round((year - utcToYear(1982, 3, 10)) * 365.25)
  return {
    spanDeg: full.spanDeg,
    innerSpanDeg: inner.spanDeg,
    startLonRad: full.startDeg * rad,
    sweepRad: full.spanDeg * rad,
    in100Count: Math.min(9, bestCount),
    daysToPeak,
  }
}

export interface ConjunctionState {
  sepDeg: number
  helioDiffDeg: number
  earthJupAU: number
  earthSatAU: number
  jupSatAU: number
}

const tmpE = v3()
const tmpJ = v3()
const tmpS = v3()
const tmpEJ = v3()
const tmpES = v3()

export function computeConjunctionState(year: number): ConjunctionState {
  planetHeliocentricAU('Earth', year, tmpE)
  planetHeliocentricAU('Jupiter', year, tmpJ)
  planetHeliocentricAU('Saturn', year, tmpS)
  // Include real orbital inclination latitudes (Jupiter 1.30°, Saturn 2.49°) for authentic 0.10° minimum!
  const jLon = planetTrueLonRad('Jupiter', year)
  const sLon = planetTrueLonRad('Saturn', year)
  tmpJ.y = 5.2034 * Math.sin(1.304 * rad) * Math.sin(jLon - 100.464 * rad)
  tmpS.y = 9.5371 * Math.sin(2.485 * rad) * Math.sin(sLon - 113.665 * rad)

  tmpEJ.subVectors(tmpJ, tmpE)
  tmpES.subVectors(tmpS, tmpE)
  const earthJupAU = tmpEJ.length()
  const earthSatAU = tmpES.length()
  const jupSatAU = tmpJ.distanceTo(tmpS)
  const cosAng = clamp(tmpEJ.dot(tmpES) / Math.max(1e-9, earthJupAU * earthSatAU), -1, 1)
  const sepDeg = Math.acos(cosAng) / rad
  let hDiff = Math.abs((((jLon - sLon) / rad) % 360 + 540) % 360 - 180)
  if (hDiff > 180) hDiff = 360 - hDiff
  return { sepDeg, helioDiffDeg: hDiff, earthJupAU, earthSatAU, jupSatAU }
}

// Authentic NASA/JPL hyperbolic orbital elements for 1I/2017 U1 ('Oumuamua)
const OUMUAMUA = {
  q: 0.25534, // perihelion distance (AU)
  e: 1.20113, // hyperbolic eccentricity
  inc: 122.7417 * rad,
  node: 24.5969 * rad,
  peri: 241.8105 * rad,
  tpYear: utcToYear(2017, 9, 9, 11, 58),
  // Gauss gravitational constant k^2 in AU^3 / day^2 -> mu = 0.0002959122082855911
  muAU3Day2: 0.0002959122082855911,
  vEarthKmS: 29.7847, // 1 AU/yr*2pi scaling: v(km/s) = 29.7847 * sqrt(2/r - 1/a)
}

const oumRot = new T.Quaternion()
  .setFromEuler(new T.Euler(OUMUAMUA.inc, OUMUAMUA.node, 0, 'YXZ'))
  .multiply(new T.Quaternion().setFromAxisAngle(v3(0, 1, 0), OUMUAMUA.peri))
const oumU = v3(1, 0, 0).applyQuaternion(oumRot)
const oumV = v3(0, 0, -1).applyQuaternion(oumRot)

export interface OumuamuaSample {
  auPos: T.Vector3
  rAU: number
  earthAU: number
  speedKmS: number
  latDeg: number
  inbound: boolean
}

export function sampleOumuamuaAU(year: number, outPos = v3()): OumuamuaSample {
  const aAbs = OUMUAMUA.q / (OUMUAMUA.e - 1) // |a| in AU (~1.2695 AU)
  const dtDays = (year - OUMUAMUA.tpYear) * 365.25
  const n = Math.sqrt(OUMUAMUA.muAU3Day2 / (aAbs * aAbs * aAbs))
  const Mh = n * dtDays
  // Solve hyperbolic Kepler equation: e * sinh(H) - H = Mh
  let H = Math.asinh(Mh / OUMUAMUA.e)
  for (let i = 0; i < 6; i++) {
    const f = OUMUAMUA.e * Math.sinh(H) - H - Mh
    const df = OUMUAMUA.e * Math.cosh(H) - 1
    H -= f / df
  }
  const coshH = Math.cosh(H)
  const sinhH = Math.sinh(H)
  const xOrb = aAbs * (OUMUAMUA.e - coshH)
  const yOrb = aAbs * Math.sqrt(OUMUAMUA.e * OUMUAMUA.e - 1) * sinhH

  outPos.copy(oumU).multiplyScalar(xOrb).addScaledVector(oumV, yOrb)
  const rAU = Math.max(0.05, outPos.length())
  const speedKmS = OUMUAMUA.vEarthKmS * Math.sqrt(2 / rAU + 1 / aAbs)
  const latDeg = Math.asin(clamp(outPos.y / rAU, -1, 1)) / rad
  planetHeliocentricAU('Earth', year, tmpE)
  const earthAU = outPos.distanceTo(tmpE)
  return {
    auPos: outPos,
    rAU,
    earthAU,
    speedKmS,
    latDeg,
    inbound: dtDays < 0,
  }
}

export function sl9JupiterSpinRad(year: number): number {
  const hours = (year - SL9_ROCHE_YEAR) * 365.25 * 24
  return (hours / JUPITER_ROTATION_HOURS) * tau
}

export interface Sl9Status {
  impactedCount: number
  activeImpact: Sl9Fragment | null
  activeAgeHours: number
  nextFragment: Sl9Fragment | null
  speedKmS: number
  distanceRJ: number
  totalEnergyMt: number
}

export function computeSl9Status(year: number): Sl9Status {
  let impactedCount = 0
  let totalEnergyMt = 0
  let activeImpact: Sl9Fragment | null = null
  let activeAgeHours = 999
  let nextFragment: Sl9Fragment | null = null

  for (const frag of sl9Fragments) {
    if (year >= frag.impactYear) {
      impactedCount++
      totalEnergyMt += frag.energyMt
      const ageH = (year - frag.impactYear) * 365.25 * 24
      if (ageH >= 0 && ageH < 5.5 && ageH < activeAgeHours) {
        activeImpact = frag
        activeAgeHours = ageH
      }
    } else if (!nextFragment) {
      nextFragment = frag
    }
  }

  // Approximate distance of leading surviving fragment (or intact comet before Roche pass) in Jupiter radii (R_J)
  const refImpact = nextFragment ? nextFragment.impactYear : sl9Fragments[sl9Fragments.length - 1].impactYear
  const span = refImpact - SL9_ROCHE_YEAR
  const phase = clamp((year - SL9_ROCHE_YEAR) / span, -0.1, 1)
  let distanceRJ: number
  if (phase < 0) {
    distanceRJ = 1.35 + Math.abs(phase) * 260
  } else if (impactedCount >= sl9Fragments.length) {
    distanceRJ = 1.0
  } else {
    // Highly eccentric capture ellipse: 1.35 R_J at Roche -> ~680 R_J at apoapsis -> 1.0 R_J at impact
    const sinP = Math.sin(clamp(phase, 0, 1) * Math.PI)
    distanceRJ = 1.0 + 0.35 * (1 - phase) + 678 * Math.pow(sinP, 1.35)
  }

  // Vis-viva around Jupiter: ~60 km/s at cloud tops (1 R_J), ~2.2 km/s at apoapsis
  const speedKmS = Math.sqrt(Math.max(1.8, 3600 / Math.max(1, distanceRJ) - 0.6))

  return {
    impactedCount,
    activeImpact,
    activeAgeHours,
    nextFragment,
    speedKmS,
    distanceRJ,
    totalEnergyMt,
  }
}

function formatEnergy(mt: number, lang: Locale): string {
  if (mt <= 0) return '0'
  if (lang === 'en') {
    if (mt >= 1_000_000) return `${(mt / 1_000_000).toFixed(1)}M Mt`
    return `${Math.round(mt / 1000)}k Mt`
  }
  if (mt >= 10_000) return `${(mt / 10_000).toFixed(0)} 万 Mt`
  return `${mt.toLocaleString('zh-CN')} Mt`
}

export function computePhenomenonStats(id: PhenomenonId, year: number, lang: Locale = 'zh'): PhenomenonStats {
  if (id === 'alignment1982') {
    const s = computeAlignmentState(year)
    const inPeak = s.spanDeg <= 106
    const sign = s.daysToPeak > 0 ? '+' : ''
    const deltaStr = s.daysToPeak === 0
      ? pick('极值当日', 'Peak Day', lang)
      : `T${sign}${s.daysToPeak}${pick(' 天', 'd', lang)}`
    const metrics: [PhenomenonMetric, PhenomenonMetric, PhenomenonMetric, PhenomenonMetric] = [
      {
        label: pick('九星张角', '9-Body Span', lang),
        value: `${s.spanDeg.toFixed(1)}°`,
        sub: inPeak ? pick('极窄汇聚', 'Rare Tight', lang) : pick('最小扇区', 'Min Sector', lang),
        highlight: inPeak,
      },
      {
        label: pick('内行星张角', 'Inner Span', lang),
        value: `${s.innerSpanDeg.toFixed(1)}°`,
        sub: pick('水金地火', 'Me–Ma', lang),
      },
      {
        label: pick('100° 同侧数', 'In 100° Arc', lang),
        value: `${s.in100Count} / 9`,
        sub: pick('含冥王星', 'Incl. Pluto', lang),
        highlight: s.in100Count === 9,
      },
      {
        label: pick('距连珠极值', 'To Peak', lang),
        value: deltaStr,
        sub: '1982.03.10',
      },
    ]
    return {
      year,
      dateLabel: formatMissionDate(year, lang),
      inPeakWindow: inPeak,
      windowHint: inPeak ? pick('九星连珠极值窗口', 'Peak Alignment Window', lang) : '',
      metrics,
    }
  }

  if (id === 'sl9_1994') {
    const s = computeSl9Status(year)
    const inImpactWeek = year >= SL9_IMPACT_START && year <= SL9_IMPACT_END
    const inRoche = Math.abs(year - SL9_ROCHE_YEAR) < 0.045
    const activeLabel = s.activeImpact
      ? pick(`碎片 ${s.activeImpact.id} 爆发`, `Frag ${s.activeImpact.id} Blast`, lang)
      : inImpactWeek
        ? pick('连环撞击窗口', 'Bombardment Week', lang)
        : inRoche
          ? pick('洛希极限撕裂', 'Roche Disruption', lang)
          : ''
    const nextStr = s.activeImpact
      ? pick(`碎片 ${s.activeImpact.id} 命中`, `Frag ${s.activeImpact.id} Hit`, lang)
      : s.nextFragment
        ? pick(`下一颗: ${s.nextFragment.id}`, `Next: Frag ${s.nextFragment.id}`, lang)
        : pick('21 颗全数撞击', 'All 21 Impacted', lang)
    const metrics: [PhenomenonMetric, PhenomenonMetric, PhenomenonMetric, PhenomenonMetric] = [
      {
        label: pick('已撞击碎片', 'Impacts', lang),
        value: `${s.impactedCount} / ${sl9Fragments.length}`,
        sub: nextStr,
        highlight: !!s.activeImpact,
      },
      {
        label: pick('相对速度', 'Impact Vel.', lang),
        value: `${s.speedKmS.toFixed(1)}`,
        sub: 'km/s',
        highlight: s.speedKmS > 50,
      },
      {
        label: pick('距木星中心', 'Jovian Dist.', lang),
        value: s.distanceRJ < 10 ? `${s.distanceRJ.toFixed(1)} Rⱼ` : `${Math.round(s.distanceRJ)} Rⱼ`,
        sub: s.distanceRJ < 2.5 ? pick('洛希极限内', 'Inside Roche', lang) : pick('木星捕获轨', 'Jovian Orbit', lang),
      },
      {
        label: pick('累积当量', 'Total Yield', lang),
        value: formatEnergy(s.totalEnergyMt, lang),
        sub: 'TNT',
        highlight: s.totalEnergyMt >= 6_000_000,
      },
    ]
    return {
      year,
      dateLabel: inImpactWeek ? formatMissionDateTime(year, lang) : formatMissionDate(year, lang),
      inPeakWindow: inImpactWeek || inRoche,
      windowHint: activeLabel,
      metrics,
    }
  }

  if (id === 'conjunction2020') {
    const s = computeConjunctionState(year)
    const inPeak = s.sepDeg <= 1.2
    const sepText = s.sepDeg < 0.5 ? `${(s.sepDeg * 60).toFixed(1)}′` : `${s.sepDeg.toFixed(2)}°`
    const metrics: [PhenomenonMetric, PhenomenonMetric, PhenomenonMetric, PhenomenonMetric] = [
      {
        label: pick('地心视角距', 'Sky Sep.', lang),
        value: sepText,
        sub: s.sepDeg < 0.25 ? pick('0.1° 极近大合', '0.1° Ultra-Close', lang) : `${s.sepDeg.toFixed(2)}°`,
        highlight: inPeak,
      },
      {
        label: pick('日心经度差', 'Helio ΔLon', lang),
        value: `${s.helioDiffDeg.toFixed(2)}°`,
        sub: pick('木星–土星', 'Jup–Sat', lang),
      },
      {
        label: pick('木土真实间距', '3D Gap', lang),
        value: `${s.jupSatAU.toFixed(2)} AU`,
        sub: pick(`${(s.jupSatAU * 1.496).toFixed(1)} 亿 km`, `${Math.round(s.jupSatAU * 149.6)}M km`, lang),
      },
      {
        label: pick('木星距地球', 'Earth–Jup', lang),
        value: `${s.earthJupAU.toFixed(2)} AU`,
        sub: pick(`土星 ${s.earthSatAU.toFixed(1)} AU`, `Sat ${s.earthSatAU.toFixed(1)} AU`, lang),
      },
    ]
    return {
      year,
      dateLabel: formatMissionDate(year, lang),
      inPeakWindow: inPeak,
      windowHint: inPeak ? pick('400 年罕见大合窗口', '400-Year Conjunction', lang) : '',
      metrics,
    }
  }

  // 1I/'Oumuamua
  const s = sampleOumuamuaAU(year)
  const inPeak = s.rAU < 0.85 || s.earthAU < 0.35
  const latStr = (s.latDeg < 0 ? '−' : '+') + Math.abs(s.latDeg).toFixed(1) + '°'
  const metrics: [PhenomenonMetric, PhenomenonMetric, PhenomenonMetric, PhenomenonMetric] = [
    {
      label: pick('距太阳', 'From Sun', lang),
      value: `${s.rAU.toFixed(2)} AU`,
      sub: s.inbound ? pick('高速俯冲', 'Inbound', lang) : pick('双曲线逃逸', 'Escaping', lang),
      highlight: s.rAU < 0.45,
    },
    {
      label: pick('日心速度', 'Helio Speed', lang),
      value: `${s.speedKmS.toFixed(1)}`,
      sub: 'km/s',
      highlight: s.speedKmS > 65,
    },
    {
      label: pick('距地球', 'From Earth', lang),
      value: `${s.earthAU.toFixed(2)} AU`,
      sub: s.earthAU < 0.25 ? pick('近地飞掠', 'Close Pass', lang) : `${Math.round(s.earthAU * 149.6)}M km`,
      highlight: s.earthAU < 0.25,
    },
    {
      label: pick('黄纬倾角', 'Ecl. Lat.', lang),
      value: latStr,
      sub: 'e = 1.201',
    },
  ]
  return {
    year,
    dateLabel: formatMissionDate(year, lang),
    inPeakWindow: inPeak,
    windowHint:
      s.rAU < 0.45
        ? pick('近日点引力急转', 'Perihelion Turn', lang)
        : s.earthAU < 0.28
          ? pick('近掠地球窗口', 'Earth Flyby', lang)
          : '',
    metrics,
  }
}
