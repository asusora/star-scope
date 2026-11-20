import type { ArchiveEntry, ProbePhoto } from '../scene/types'
import { formatNum, locale, regionFullLabel, type Locale } from './index'
import {
  deepEn,
  localizedProbePhoto,
  moonDiscovered,
  moonLabel,
  moonNumberName,
  moonOtherNames,
  upcomingMissionsEn,
  worldDiscovered,
  worldKind,
  worldName,
  worldSummary,
} from './catalogEn'

export interface LocalizedArchiveView {
  title: string
  code: string
  body: string
  discovered: string
  caption?: string
  credit?: string
  facts: string[][]
  probePhotos?: ProbePhoto[]
}

export function localizedEntry(
  entry: ArchiveEntry,
  lang: Locale = locale.value,
): LocalizedArchiveView {
  if (lang === 'zh') {
    return {
      title: entry.title,
      code: entry.code,
      body: entry.body,
      discovered: entry.discovered ?? '',
      caption: entry.caption,
      credit: entry.credit,
      facts: entry.facts,
      probePhotos: entry.probePhotos,
    }
  }

  // Deep-sky entries (Galaxies, Stars, Exoplanets)
  if (!entry.object) {
    const en = deepEn[entry.id]
    if (!en) {
      return {
        title: entry.title,
        code: entry.code,
        body: entry.body,
        discovered: entry.discovered ?? '',
        caption: entry.caption,
        credit: entry.credit,
        facts: entry.facts,
      }
    }
    const facts: string[][] =
      entry.group === '河外星系'
        ? [
            ['Distance', en.distance ?? ''],
            ['Constellation', en.place ?? ''],
            ['Discovered', en.discovered],
          ]
        : entry.group === '恒星'
          ? [
              ['Type', en.type ?? ''],
              ['Distance', en.distance ?? ''],
              ['Constellation', en.place ?? ''],
              ['Discovered', en.discovered],
            ]
          : [
              ['Type', en.type ?? ''],
              ['Orbital Period', en.days ?? ''],
              ['Discovered', en.discovered],
            ]
    return {
      title: en.title,
      code: entry.code,
      body: en.body,
      discovered: en.discovered,
      caption: en.caption,
      credit: en.credit,
      facts,
    }
  }

  const probePhotos = entry.probePhotos?.map((photo) => localizedProbePhoto(photo, 'en'))

  // Solar-system Moon
  if (entry.moon) {
    const m = entry.moon
    const p = entry.object
    const parentName = worldName(p, 'en')
    const title = moonLabel(m, 'en')
    const numName = moonNumberName(m, 'en')
    const code = [...new Set([numName, m.des].filter((s) => s && s !== title))].join(' · ')
    const discovered = moonDiscovered(m, 'en')
    const others = moonOtherNames(m, 'en')
    const body = others.length
      ? `Orbits ${parentName}. Also cataloged as ${others.join(', ')}.`
      : `${title} orbits ${parentName}.`
    const facts: string[][] = [
      ['Parent Body', parentName],
      ['Discovered', discovered],
      [m.estimate ? 'Observed Distance' : 'Semi-Major Axis', `${formatNum(m.a, 'en')} km`],
      ['Orbital Period', m.period ? `${m.period} days` : 'Not listed'],
      [
        'Spacecraft Photos',
        probePhotos?.length
          ? `${probePhotos.length} real image${probePhotos.length > 1 ? 's' : ''}`
          : upcomingMissionsEn[p.id]
            ? 'None yet (Lucy mission target system)'
            : 'No close-up spacecraft imagery',
      ],
    ]
    return {
      title,
      code,
      body,
      discovered,
      facts,
      probePhotos,
    }
  }

  // Solar-system Planet / Dwarf Planet / Small Body
  const p = entry.object
  const title = worldName(p, 'en')
  const discovered = worldDiscovered(p, 'en')
  const years = (p.days / 365.25).toFixed(p.days > 36525 ? 0 : 2)
  const facts: string[][] = [
    ['Category', worldKind(p, 'en')],
    ['Discovered', discovered],
    ['Moons', String(p.moons.length)],
    ['Orbital Period', `${years} yr`],
  ]
  if (p.au) {
    facts.push([
      'Heliocentric Orbit',
      p.periAU && p.apoAU && Math.abs(p.apoAU - p.periAU) > 1
        ? `${p.au.toFixed(p.au >= 100 ? 0 : 1)} AU (${p.periAU.toFixed(1)}–${p.apoAU.toFixed(p.apoAU >= 100 ? 0 : 1)} AU)`
        : `${p.au.toFixed(2)} AU`,
    ])
  }
  if (p.region) {
    facts.push(['Region', regionFullLabel(p.region, 'en')])
  }
  facts.push([
    'Spacecraft Photos',
    probePhotos?.length
      ? `${probePhotos.length} real image${probePhotos.length > 1 ? 's' : ''}`
      : upcomingMissionsEn[p.id] || 'No close-up spacecraft imagery',
  ])

  const body =
    worldSummary(p, 'en') ||
    (p.region === 'main'
      ? 'Located in the main asteroid belt between Mars and Jupiter.'
      : p.region === 'outer'
        ? 'Orbits beyond Neptune in the Kuiper Belt; explore and follow it in 3D view.'
        : 'Approach this planet in 3D view to follow its orbit and explore its satellite catalog.')

  return {
    title,
    code: entry.code,
    body,
    discovered,
    caption: '3D Scene Model',
    facts,
    probePhotos,
  }
}

export function archiveSearchTokens(entry: ArchiveEntry): (string | undefined)[] {
  const en = localizedEntry(entry, 'en')
  return [
    entry.id,
    entry.title,
    en.title,
    entry.code,
    en.code,
    entry.alt,
    entry.object?.name,
    entry.object ? worldName(entry.object, 'en') : undefined,
    entry.discovered,
    en.discovered,
    ...(entry.keys || []),
    ...(entry.probePhotos?.flatMap((p) => {
      const pEn = localizedProbePhoto(p, 'en')
      return [p.probe, pEn.probe, p.title, pEn.title, p.id]
    }) || []),
  ]
}
