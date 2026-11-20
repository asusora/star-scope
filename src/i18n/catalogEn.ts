import type { Belt, Moon, ProbePhoto, World } from '../scene/types'
import { locale, type Locale } from './index'

export interface WorldEn {
  name: string
  kind: string
  discovered: string
  summary?: string
}

export const worldEn: Record<string, WorldEn> = {
  Mercury: { name: 'Mercury', kind: 'Planet', discovered: 'Known since antiquity' },
  Venus: { name: 'Venus', kind: 'Planet', discovered: 'Known since antiquity' },
  Earth: { name: 'Earth', kind: 'Planet', discovered: 'Known since antiquity' },
  Mars: { name: 'Mars', kind: 'Planet', discovered: 'Known since antiquity' },
  Jupiter: { name: 'Jupiter', kind: 'Planet', discovered: 'Known since antiquity' },
  Saturn: { name: 'Saturn', kind: 'Planet', discovered: 'Known since antiquity' },
  Uranus: { name: 'Uranus', kind: 'Planet', discovered: '1781' },
  Neptune: { name: 'Neptune', kind: 'Planet', discovered: '1846' },

  Ceres: {
    name: 'Ceres',
    kind: 'Dwarf Planet',
    discovered: '1801',
    summary:
      'The largest body in the main asteroid belt and the only dwarf planet in the inner solar system. Dawn revealed bright sodium-carbonate domes in Occator Crater and the cryovolcano Ahuna Mons.',
  },
  Vesta: {
    name: 'Vesta',
    kind: 'Protoplanet Asteroid',
    discovered: '1807',
    summary:
      'The second-most massive body in the main belt. Dawn mapped its massive south-polar Rheasilvia impact basin, a 22 km central peak, and equatorial troughs.',
  },
  Pallas: {
    name: 'Pallas',
    kind: 'Asteroid',
    discovered: '1802',
    summary:
      'A large, highly inclined main-belt asteroid. High-resolution VLT imaging revealed a heavily battered surface dotted with craters like a golf ball.',
  },
  Juno: {
    name: 'Juno',
    kind: 'Asteroid',
    discovered: '1804',
    summary:
      'A large stony S-type main-belt asteroid bearing a relatively fresh impact crater roughly 100 km across.',
  },
  Hygiea: {
    name: 'Hygiea',
    kind: 'Carbonaceous Asteroid',
    discovered: '1849',
    summary:
      'The fourth-largest body in the main belt, coated in dark carbon-rich material. VLT observations show it is nearly spherical, making it a dwarf planet candidate.',
  },
  Psyche: {
    name: 'Psyche',
    kind: 'Metallic Asteroid',
    discovered: '1852',
    summary:
      "Target of NASA's Psyche mission, rich in iron-nickel metal and silicate rock, thought to be the exposed metallic core remnant of an early planetesimal.",
  },
  Eurybates: {
    name: 'Eurybates',
    kind: 'Jupiter Trojan',
    discovered: '1973',
    summary:
      "Orbiting 60° ahead of Jupiter in the L4 Greek camp, Eurybates is the first Trojan target for NASA's Lucy spacecraft; Hubble discovered its small moon Queta.",
  },
  Patroclus: {
    name: 'Patroclus',
    kind: 'Binary Trojan',
    discovered: '1906',
    summary:
      "Orbiting 60° behind Jupiter in the L5 Trojan camp, Patroclus and its nearly equal-sized companion Menoetius form a dark-red icy binary targeted by NASA's Lucy mission.",
  },
  Chiron: {
    name: 'Chiron',
    kind: 'Centaur',
    discovered: '1977',
    summary:
      'The first discovered centaur, orbiting between Saturn and Uranus and also cataloged as comet 95P. JWST detected surface water ice, methane, and CO2, while stellar occultations revealed an evolving ring disk and faint coma.',
  },
  Chariklo: {
    name: 'Chariklo',
    kind: 'Ringed Centaur',
    discovered: '1997',
    summary:
      'The largest known centaur between Saturn and Uranus and the first small body confirmed to possess dense twin icy rings (Oiapoque and Chuí), where JWST confirmed crystalline water ice.',
  },
  Pholus: {
    name: 'Pholus',
    kind: 'Centaur',
    discovered: '1992',
    summary:
      'An ultra-red centaur crossing the orbits of the giant planets, coated in radiation-processed organic tholins and methanol ice.',
  },
  Pluto: {
    name: 'Pluto',
    kind: 'Dwarf Planet',
    discovered: '1930',
    summary:
      'Archetypal Kuiper Belt dwarf planet. New Horizons revealed the heart-shaped nitrogen-ice plains of Tombaugh Regio, dark-red Cthulhu Macula, tenuous blue atmospheric hazes, and five moons.',
  },
  Orcus: {
    name: 'Orcus',
    kind: 'Dwarf Planet Candidate',
    discovered: '2004',
    summary:
      'In a 3:2 resonance with Neptune opposite Pluto in phase, earning the nickname "anti-Pluto." Spectra show bright crystalline water ice and ammonia hydrate alongside its dark-red moon Vanth.',
  },
  Haumea: {
    name: 'Haumea',
    kind: 'Dwarf Planet',
    discovered: '2004',
    summary:
      'A Kuiper Belt dwarf planet spinning in just ~3.9 hours, stretching it into a triaxial ellipsoid coated in pure crystalline water ice, with a dark-red spot, a narrow ring, and two moons.',
  },
  Quaoar: {
    name: 'Quaoar',
    kind: 'Dwarf Planet',
    discovered: '2002',
    summary:
      'A large classical Kuiper Belt dwarf planet. Stellar occultations and CHEOPS surprisingly revealed two dense rings orbiting well outside its Roche limit, beyond which lies its moon Weywot.',
  },
  Arrokoth: {
    name: 'Arrokoth',
    kind: 'Kuiper Belt Object',
    discovered: '2014',
    summary:
      'The farthest object ever explored up close by a spacecraft (New Horizons, 2019), a flattened snowman-like contact binary with deep brick-red terrain, a bright fine-grained neck, and ~98° axial tilt.',
  },
  Makemake: {
    name: 'Makemake',
    kind: 'Dwarf Planet',
    discovered: '2005',
    summary:
      'The second-brightest known Kuiper Belt object, rich in frozen methane, ethane, and reddish tholins, accompanied by a faint moon (MK 2) discovered by Hubble.',
  },
  Gonggong: {
    name: 'Gonggong',
    kind: 'Dwarf Planet',
    discovered: '2007',
    summary:
      'A large scattered-disc dwarf planet in 3:10 resonance with Neptune, named after the Chinese water deity. One of the reddest large worlds in the solar system, orbited by the Hubble-discovered moon Xiangliu.',
  },
  Eris: {
    name: 'Eris',
    kind: 'Dwarf Planet',
    discovered: '2005',
    summary:
      'The most massive known dwarf planet, following a steep 43.9° orbit deep into the scattered disc, covered in high-albedo nitrogen and methane frost and orbited by its large moon Dysnomia.',
  },
  Farfarout: {
    name: 'Farfarout',
    kind: 'Extreme Scattered Object',
    discovered: '2018',
    summary:
      'The most distant known solar system object currently observed (at ~132 AU), swinging on a highly eccentric orbit from Neptune’s edge deep into the scattered disc.',
  },
  VP113: {
    name: '2012 VP113',
    kind: 'Detached Dwarf Planet',
    discovered: '2012',
    summary:
      'The second Sedna-like detached object discovered, with a perihelion of 80.5 AU well beyond Neptune’s gravitational pull and a pale pinkish frost surface.',
  },
  Sedna: {
    name: 'Sedna',
    kind: 'Inner Oort Cloud Dwarf Planet',
    discovered: '2003',
    summary:
      'An extreme inner Oort cloud dwarf planet whose orbit spans 76 AU to 937 AU (~11,400-year period). Cosmic-ray irradiation gives it a deep crimson hue, with ethane and acetylene ices detected by JWST.',
  },
}

export const upcomingMissionsEn: Record<string, string> = {
  Psyche: 'None yet (Psyche mission en route, arrival 2029)',
  Eurybates: 'None yet (Lucy mission en route, flyby 2027)',
  Patroclus: 'None yet (Lucy mission en route, flyby 2033)',
}

const moonDiscoveryEn: Record<string, string> = {
  'Earth-Moon': 'Known since antiquity',
  'Jupiter-Themisto': '1975 (rediscovered 2000)',
  'Saturn-Janus': '1966',
  'Saturn-Epimetheus': '1966 (confirmed separate 1977)',
  'Uranus-Perdita': '1999 (from 1986 imagery)',
  'Neptune-Larissa': '1981 (confirmed 1989)',
  'Makemake-MK 2': '2015 (announced 2016)',
}

export function worldName(p: World, lang: Locale = locale.value): string {
  return lang === 'en' ? worldEn[p.id]?.name ?? p.id : p.name
}

export function worldKind(p: World, lang: Locale = locale.value): string {
  return lang === 'en' ? worldEn[p.id]?.kind ?? 'Planet' : p.kind || '行星'
}

export function worldDiscovered(p: World, lang: Locale = locale.value): string {
  return lang === 'en'
    ? worldEn[p.id]?.discovered ?? 'Not listed'
    : p.discovered || '未列出'
}

export function worldSummary(p: World, lang: Locale = locale.value): string | undefined {
  return lang === 'en' ? worldEn[p.id]?.summary : p.summary
}

export function moonLabel(m: Moon, lang: Locale = locale.value): string {
  return lang === 'en' ? m.name : m.label
}

export function moonNumberName(m: Moon, lang: Locale = locale.value): string {
  if (lang === 'zh') return m.numberName
  return m.num ? `${worldName(m.parent, 'en')} ${m.num}` : ''
}

export function moonDiscovered(m: Moon, lang: Locale = locale.value): string {
  if (lang === 'zh') return m.discovered || '未列出'
  return moonDiscoveryEn[`${m.parent.id}-${m.name}`] || (m.year ? String(m.year) : 'Not listed')
}

export function moonOtherNames(m: Moon, lang: Locale = locale.value): string[] {
  if (lang === 'zh') return m.otherNames
  const numName = moonNumberName(m, 'en')
  return [...new Set([numName, m.des].filter((s): s is string => !!s && s !== m.name))]
}

export interface DeepEn {
  title: string
  distance?: string
  place?: string
  type?: string
  days?: string
  discovered: string
  body: string
  caption: string
  credit: string
}

export const deepEn: Record<string, DeepEn> = {
  m31: {
    title: 'Andromeda Galaxy',
    distance: '~2.5 million ly',
    place: 'Andromeda',
    discovered: 'Known since antiquity (recorded 964 CE)',
    body: 'A companion giant spiral in our Local Group. Its galactic disk is steeply inclined to our line of sight, appearing as an elongated oval. The photo is a Hubble mosaic spanning part of the disk.',
    caption: 'Hubble Space Telescope observation',
    credit: 'NASA, ESA, PHAT Team, J. Dalcanton, B. F. Williams, L. C. Johnson & R. Gendler',
  },
  m33: {
    title: 'Triangulum Galaxy',
    distance: '~3.0 million ly',
    place: 'Triangulum',
    discovered: 'Before 1654 (cataloged 1764)',
    body: 'Another spiral galaxy in the Local Group. Dense clusters of young blue stars and glowing star-forming nebulae trace its sweeping arms.',
    caption: 'Hubble Space Telescope observation',
    credit: 'NASA, ESA, M. Durbin, J. Dalcanton & B. F. Williams',
  },
  m51: {
    title: 'Whirlpool Galaxy',
    distance: '~31 million ly',
    place: 'Canes Venatici',
    discovered: '1773',
    body: 'Seen almost face-on from Earth, M51 displays two grand spiral arms winding outward toward its gravitationally interacting companion galaxy NGC 5195.',
    caption: 'Hubble Space Telescope observation',
    credit: 'NASA, ESA, S. Beckwith & Hubble Heritage Team (STScI/AURA)',
  },
  m104: {
    title: 'Sombrero Galaxy',
    distance: '~28 million ly',
    place: 'Virgo',
    discovered: '1781',
    body: 'Viewed nearly edge-on, a crisp dark lane of interstellar dust slices across its luminous central bulge, creating a broad-brimmed silhouette.',
    caption: 'Hubble Space Telescope observation',
    credit: 'NASA & Hubble Heritage Team (STScI/AURA)',
  },
  m82: {
    title: 'Cigar Galaxy',
    distance: '~12 million ly',
    place: 'Ursa Major',
    discovered: '1774',
    body: 'Seen nearly edge-on, M82 has an elongated cigar-like disk undergoing an intense burst of star formation that drives dramatic red filaments of gas outward from its core.',
    caption: 'Hubble Space Telescope observation',
    credit:
      'NASA, ESA, Hubble Heritage Team (STScI/AURA); ack. J. Gallagher, M. Mountain, P. Puxley',
  },
  m87: {
    title: 'Virgo A',
    distance: '~54 million ly',
    place: 'Virgo',
    discovered: '1781',
    body: 'A giant elliptical galaxy hosting a supermassive black hole at its core, launching a relativistic jet of plasma that glows bright blue in Hubble imagery.',
    caption: 'Hubble Space Telescope observation',
    credit: 'NASA, ESA, Hubble Heritage Team (STScI/AURA); ack. P. Côté, E. Baltz',
  },
  sirius: {
    title: 'Sirius',
    distance: '~8.6 ly',
    place: 'Canis Major',
    type: 'Binary Star',
    discovered: 'Known since antiquity (Sirius B 1862)',
    body: 'Luminous Sirius A and its faint white-dwarf companion Sirius B orbit each other every ~50 years. In Hubble imagery, the primary star’s glare nearly overwhelms its tiny companion.',
    caption: 'Hubble Space Telescope observation',
    credit: 'NASA, ESA, H. Bond (STScI), M. Barstow (University of Leicester)',
  },
  betelgeuse: {
    title: 'Betelgeuse',
    distance: '~600 ly',
    place: 'Orion',
    type: 'Red Supergiant',
    discovered: 'Known since antiquity',
    body: 'Marking Orion’s shoulder, Betelgeuse has an extended chromosphere resolved at millimeter wavelengths by ALMA, revealing an asymmetric bright hot spot on its disk.',
    caption: 'ALMA millimeter-wave observation',
    credit: 'ALMA (ESO/NAOJ/NRAO) / E. O’Gorman / P. Kervella',
  },
  vega: {
    title: 'Vega',
    distance: '~25 ly',
    place: 'Lyra',
    type: 'Main-Sequence Star',
    discovered: 'Known since antiquity',
    body: 'Vega is surrounded by a nearly face-on debris disk. Mid-infrared observations with Webb mapped the warm dust glow, revealing a remarkably smooth disk structure.',
    caption: 'Debris disk around Vega · Webb mid-IR observation',
    credit: 'NASA, ESA, CSA, STScI, K. Su, A. Gáspár (University of Arizona)',
  },
  proxima: {
    title: 'Proxima Centauri',
    distance: '~4.2 ly',
    place: 'Centaurus',
    type: 'Red Dwarf',
    discovered: '1915',
    body: 'The closest known star to the Sun. Far too faint to see with the unaided eye, it erupts with powerful stellar flares and hosts the exoplanet Proxima Centauri b.',
    caption: 'Hubble Space Telescope observation',
    credit: 'ESA/Hubble & NASA',
  },
  'proxima-centauri-b': {
    title: 'Proxima Centauri b',
    days: '11.2 days',
    type: 'Super-Earth',
    discovered: '2016',
    body: 'Orbiting the red dwarf Proxima Centauri, this terrestrial-mass exoplanet completes a full revolution roughly every eleven Earth days.',
    caption: 'Artist’s concept',
    credit: 'NASA Exoplanet Catalog',
  },
  'trappist-1-e': {
    title: 'TRAPPIST-1 e',
    days: '6.1 days',
    type: 'Terrestrial',
    discovered: '2017',
    body: 'One of seven Earth-sized worlds in the compact TRAPPIST-1 system, orbiting a cool ultra-low-mass M-dwarf star.',
    caption: 'Artist’s concept',
    credit: 'NASA Exoplanet Catalog',
  },
  '51-pegasi-b': {
    title: '51 Pegasi b',
    days: '4.2 days',
    type: 'Gas Giant',
    discovered: '1995',
    body: 'The first exoplanet found around a Sun-like star—a scorching hot Jupiter orbiting at a semi-major axis of only ~0.052 AU.',
    caption: 'Artist’s concept',
    credit: 'NASA Exoplanet Catalog',
  },
  '55-cancri-e': {
    title: '55 Cancri e',
    days: '~0.7 days',
    type: 'Super-Earth',
    discovered: '2004',
    body: 'Locked in an ultra-tight orbit around its host star, completing a year in less than a single Earth day.',
    caption: 'Artist’s concept',
    credit: 'NASA Exoplanet Catalog',
  },
  'kepler-452-b': {
    title: 'Kepler-452 b',
    days: '384.8 days',
    type: 'Super-Earth',
    discovered: '2015',
    body: 'Orbiting a Sun-like G-type star at ~1.05 AU, its year is only about 20 days longer than an Earth year.',
    caption: 'Artist’s concept',
    credit: 'NASA Exoplanet Catalog',
  },
  'hd-209458-b': {
    title: 'Osiris',
    days: '~3.5 days',
    type: 'Gas Giant',
    discovered: '1999',
    body: 'A hot Jupiter informally nicknamed "Osiris." As it transits in front of its star, starlight filters through its atmosphere, enabling spectroscopic atmospheric studies.',
    caption: 'Artist’s concept',
    credit: 'NASA, ESA, G. Bacon (STScI)',
  },
}

export interface ProbePhotoEn {
  title: string
  description: string
  probe: string
  date: string
}

export const probePhotoEn: Record<string, ProbePhotoEn> = {
  PIA10179: {
    title: 'MESSENGER First Flyby Overview of Mercury',
    description:
      'Captured during MESSENGER’s first approach, revealing densely cratered ancient terrain across Mercury’s crescent hemisphere.',
    probe: 'MESSENGER',
    date: 'Jan 14, 2008',
  },
  PIA23791: {
    title: 'Mariner 10 Cloud Views of Venus',
    description:
      'Modern reprocessing of Mariner 10 flyby data: approximate natural color on the left and contrast-enhanced cloud bands on the right.',
    probe: 'Mariner 10',
    date: 'Feb 7–8, 1974',
  },
  PIA00114: {
    title: 'Galileo Natural-Color View of Earth',
    description:
      'Captured during Galileo’s first Earth gravity-assist flyby en route to Jupiter, showing South America, the Pacific, and sweeping cloud systems.',
    probe: 'Galileo',
    date: 'Dec 11, 1990',
  },
  PIA00130: {
    title: 'Galileo Lunar North Pole Mosaic',
    description:
      'Assembled from 18 green-filter images captured during Galileo’s lunar flyby, highlighting northern maria and cratered highlands.',
    probe: 'Galileo',
    date: 'Dec 7, 1992',
  },
  PIA24542: {
    title: 'Perseverance Selfie with Ingenuity in Jezero Crater',
    description:
      'Robotic-arm mosaic taken by NASA’s Perseverance rover on the floor of Jezero Crater, with the Ingenuity Mars Helicopter parked to the right.',
    probe: 'Perseverance Rover (WATSON)',
    date: 'Apr 6, 2021',
  },
  PIA19819: {
    title: 'Opportunity Panorama of Marathon Valley',
    description:
      'Natural-color mosaic captured by the Opportunity rover looking across Marathon Valley and "Hinners Point" on the rim of Endeavour Crater.',
    probe: 'Opportunity Rover (Pancam)',
    date: 'Aug 14, 2015',
  },
  PIA10368: {
    title: 'Enhanced-Color Close-up of Phobos',
    description:
      'Taken from 6,800 km away, clearly resolving the giant Stickney Crater on the right and parallel surface grooves.',
    probe: 'Mars Reconnaissance Orbiter (HiRISE)',
    date: 'Mar 23, 2008',
  },
  PIA11826: {
    title: 'High-Resolution Dual Views of Deimos',
    description:
      'Enhanced-color images showing Deimos blanketed in thick, smooth regolith that softens most of its impact craters.',
    probe: 'Mars Reconnaissance Orbiter (HiRISE)',
    date: 'Feb 21, 2009',
  },
  PIA02856: {
    title: 'Cassini True-Color Hemisphere of Jupiter',
    description:
      'True-color view captured during Cassini’s Jupiter flyby, showcasing equatorial belts, zones, and mottled high-latitude vortices.',
    probe: 'Cassini',
    date: 'Dec 13, 2000',
  },
  PIA03530: {
    title: 'Galileo Close-up of Loki Volcano on Io',
    description:
      'High-resolution flyby frame showing the active Loki volcanic caldera, dark lava flows, and bright sulfur-dioxide frost deposits.',
    probe: 'Galileo',
    date: 'Oct 16, 2001',
  },
  PIA00502: {
    title: 'Natural and False-Color Views of Europa',
    description:
      'Approximate natural color on the left paired with an enhanced false-color composite on the right accentuating ice fractures and Pwyll Crater rays.',
    probe: 'Galileo',
    date: 'Sep 7, 1996',
  },
  PIA24681: {
    title: 'Juno Close Flyby of Ganymede',
    description:
      'Green-filter JunoCam close-up resolving ancient dark regions, bright young craters, and sweeping tectonic ridges and troughs.',
    probe: 'Juno (JunoCam)',
    date: 'Jun 7, 2021',
  },
  PIA00516: {
    title: 'Central Zone of Valhalla Basin on Callisto',
    description:
      'High-resolution view into the center of Callisto’s vast multi-ring Valhalla impact structure, mixing bright icy knobs with dark smooth plains.',
    probe: 'Galileo',
    date: 'Nov 4, 1996',
  },
  PIA01074: {
    title: 'Four Galileo Views of Amalthea',
    description:
      'Composite of four flyby perspectives showing the elongated, irregular shape, deep craters, and ridges of Jupiter’s inner moon.',
    probe: 'Galileo',
    date: 'Feb–Jun 1997',
  },
  PIA12513: {
    title: 'Stately Saturn in Natural Color',
    description:
      'Captured near Saturnian equinox with the rings seen nearly edge-on as a razor-thin line across the globe; icy moon Rhea gleams to the right.',
    probe: 'Cassini',
    date: 'Nov 4, 2009',
  },
  PIA21348: {
    title: 'Saturn’s North Polar Hexagon in Near-Infrared',
    description:
      'Late-mission Cassini view over Saturn’s northern hemisphere clearly tracing its iconic six-sided polar jet stream and banded clouds.',
    probe: 'Cassini',
    date: 'Jun 28, 2017',
  },
  PIA02266: {
    title: 'Voyager 1 Flyby of Mimas',
    description:
      'Head-on view dominated by the 130 km Herschel impact crater and its central peak, giving Mimas its unmistakable profile.',
    probe: 'Voyager 1',
    date: 'Nov 12, 1980',
  },
  PIA07758: {
    title: 'Backlit Water-Ice Plumes of Enceladus',
    description:
      'Iconic high-phase Cassini photograph capturing towering geysers of water ice erupting from Enceladus’s south-polar "tiger stripe" fractures.',
    probe: 'Cassini',
    date: 'Nov 27, 2005',
  },
  PIA14622: {
    title: 'Northern Rim of Odysseus Basin on Tethys',
    description:
      'Narrow-angle close-up detailing the northern wall of the giant Odysseus impact basin across Tethys’s ancient cratered ice crust.',
    probe: 'Cassini',
    date: 'Jun 28, 2012',
  },
  PIA11532: {
    title: 'Wispy Ice Cliffs on Dione’s Trailing Hemisphere',
    description:
      'Shows bright wispy filaments across Dione’s trailing side—actually towering tectonic fractures and bright ice cliffs cutting darker terrain.',
    probe: 'Cassini',
    date: 'May 26, 2009',
  },
  PIA14605: {
    title: 'Heavily Cratered Terrain on Rhea',
    description:
      'Close-up revealing overlapping generations of impact craters and subtle tectonic fractures across Rhea’s bright icy crust.',
    probe: 'Cassini',
    date: 'Mar 10, 2012',
  },
  PIA07232: {
    title: 'First Color View from Titan’s Surface',
    description:
      'Humanity’s first photograph from the surface of an outer solar system moon, showing rounded water-ice cobbles beneath Titan’s orange haze.',
    probe: 'Huygens Lander (DISR)',
    date: 'Jan 14, 2005',
  },
  PIA14580: {
    title: 'Spongy, Porous Surface of Hyperion',
    description:
      'Cassini flyby portrait showcasing Hyperion’s bizarre, honeycomb-like landscape of deep, steep-walled craters on a low-density icy body.',
    probe: 'Cassini',
    date: 'Sep 16, 2011',
  },
  PIA08372: {
    title: 'Equatorial Mountain Ridge of Iapetus',
    description:
      'Close-up along the towering ~10 km equatorial ridge bisecting Iapetus’s dark, heavily cratered terrain.',
    probe: 'Cassini',
    date: 'Sep 10, 2007',
  },
  PIA06062: {
    title: 'Cassini Approach Sequence of Phoebe',
    description:
      'Three approach frames captured just prior to Saturn orbit insertion, revealing stark bright-and-dark patches on this dark retrograde outer moon.',
    probe: 'Cassini',
    date: 'Jun 4–7, 2004',
  },
  PIA11534: {
    title: 'Cratered Saturn-Facing Side of Janus',
    description:
      'Detailed view of the irregular, cratered icy moon Janus, which shares a co-orbital swap dance with Epimetheus.',
    probe: 'Cassini',
    date: 'May 25, 2009',
  },
  PIA12725: {
    title: 'Cassini Flyby of Epimetheus',
    description:
      'Taken from ~87,000 km away, capturing the battered Saturn-facing hemisphere of co-orbital moon Epimetheus.',
    probe: 'Cassini',
    date: 'Apr 7, 2010',
  },
  PIA09907: {
    title: 'Atlas Beyond Saturn’s A-Ring Edge',
    description:
      'Atlas shines just outside the bright edge of Saturn’s A ring at upper right, while tiny Daphnis appears inside the Keeler Gap below.',
    probe: 'Cassini',
    date: 'Apr 22, 2008',
  },
  PIA17207: {
    title: 'Prometheus Up Close',
    description:
      'High-resolution flyby of Saturn’s elongated, potato-shaped inner F-ring shepherd moon against the faint backdrop of the rings.',
    probe: 'Cassini',
    date: 'Dec 6, 2015',
  },
  PIA12690: {
    title: 'Flying by Pandora',
    description:
      'Close-up of the porous outer F-ring shepherd moon Pandora, showing shallow craters and soft dusty surface relief.',
    probe: 'Cassini',
    date: 'Jun 3, 2010',
  },
  PIA21436: {
    title: 'Dual Views of Pan in the Encke Gap',
    description:
      'Close flyby revealing Pan’s distinctive walnut/ravioli-like equatorial skirt built from accreted ring particles.',
    probe: 'Cassini',
    date: 'Mar 7, 2017',
  },
  PIA12698: {
    title: 'Daphnis Sculpting Waves in the Keeler Gap',
    description:
      'Tiny Daphnis orbits within the narrow Keeler Gap of Saturn’s A ring, its gravity raising visible ripples along the ring edges.',
    probe: 'Cassini',
    date: 'Jul 5, 2010',
  },
  PIA00032: {
    title: 'Uranus in True and False Color',
    description:
      'Voyager 2 comparison showing Uranus’s pale cyan natural hue on the left and extreme contrast false-color polar hood and bands on the right.',
    probe: 'Voyager 2',
    date: 'Jan 17, 1986',
  },
  PIA00037: {
    title: 'Ariel at Voyager Closest Approach',
    description:
      'Clear-filter close-up highlighting crisscrossing fault valleys (graben), smooth resurfaced plains, and impact craters.',
    probe: 'Voyager 2',
    date: 'Jan 24, 1986',
  },
  PIA00040: {
    title: 'Umbriel and the Bright Wunda Ring',
    description:
      'Portrait of Uranus’s darkest major moon showing its ancient cratered southern hemisphere and the mysterious bright ring inside Wunda Crater.',
    probe: 'Voyager 2',
    date: 'Jan 24, 1986',
  },
  PIA00039: {
    title: 'Highest-Resolution Voyager View of Titania',
    description:
      'Sharpest Voyager 2 mosaic of Uranus’s largest moon, featuring the massive Messina Chasmata canyon system slicing near the terminator.',
    probe: 'Voyager 2',
    date: 'Jan 24, 1986',
  },
  PIA00034: {
    title: 'Oberon at Voyager Closest Approach',
    description:
      'Detailed look at Uranus’s outermost large moon, showing ancient cratered ice, bright ray systems, and a prominent dark-floored crater.',
    probe: 'Voyager 2',
    date: 'Jan 24, 1986',
  },
  PIA00141: {
    title: 'Miranda’s Patchwork Geologic Terrain',
    description:
      'Narrow-angle close-up capturing the dramatic boundary between ancient cratered plains, grooved coronae, and towering ice cliffs.',
    probe: 'Voyager 2',
    date: 'Jan 24, 1986',
  },
  PIA02210: {
    title: 'Voyager 2 Full-Disk View of Neptune',
    description:
      'Contrast-enhanced color image displaying Neptune’s deep methane-blue atmosphere, the Great Dark Spot storm, and bright high-altitude cirrus clouds.',
    probe: 'Voyager 2',
    date: 'Aug 14, 1989',
  },
  PIA02246: {
    title: 'Voyager Color Portrait of Triton',
    description:
      'Color composite showing Triton’s pinkish south-polar nitrogen-ice cap, dark wind-blown geyser streaks, and wrinkled cantaloupe terrain.',
    probe: 'Voyager 2',
    date: 'Aug 20, 1989',
  },
  PIA00054: {
    title: 'Voyager 2 Distant View of Nereid',
    description:
      'The only resolved spacecraft view of Neptune’s eccentric outer moon, enabling measurements of its size and surface reflectivity.',
    probe: 'Voyager 2',
    date: 'Aug 24, 1989',
  },
  PIA00062: {
    title: 'Surface Detail of Proteus',
    description:
      'Close-up of the dark, heavily cratered, polyhedral inner moon discovered during Voyager 2’s 1989 Neptune encounter.',
    probe: 'Voyager 2',
    date: 'Aug 25, 1989',
  },
  PIA19889: {
    title: 'Occator Crater Bright Spots on Ceres',
    description:
      'High-altitude Dawn mapping image showcasing brilliant sodium-carbonate salt domes gleaming across the floor of Occator Crater.',
    probe: 'Dawn',
    date: 'Aug–Oct 2015',
  },
  PIA14778: {
    title: 'Full-Frame Orbital View of Vesta',
    description:
      'Clear-filter Dawn image capturing Vesta’s heavily cratered northern hemisphere, equatorial troughs, and asymmetric profile.',
    probe: 'Dawn',
    date: 'Jul 24, 2011',
  },
  PIA19952: {
    title: 'Enhanced-Color Global Portrait of Pluto',
    description:
      'Blue, red, and infrared New Horizons composite highlighting the stark contrast between heart-shaped Tombaugh Regio and dark-red Cthulhu Macula.',
    probe: 'New Horizons (Ralph)',
    date: 'Jul 14, 2015',
  },
  PIA19968: {
    title: 'Charon in Enhanced Color',
    description:
      'High-resolution New Horizons view revealing Charon’s reddish north-polar Mordor Macula, vast equatorial chasm belt, and smoother southern plains.',
    probe: 'New Horizons (Ralph)',
    date: 'Jul 14, 2015',
  },
  PIA20287: {
    title: 'Pluto’s Moon Nix, Half Illuminated',
    description:
      'MVIC flyby observation resolving Nix’s elongated shape and prominent surface cratering.',
    probe: 'New Horizons (MVIC)',
    date: 'Jul 14, 2015',
  },
  PIA19711: {
    title: 'Hydra Emerges from the Shadows',
    description:
      'LORRI flyby observation revealing the bright, icy, irregularly shaped potato-like form of Pluto’s outermost moon.',
    probe: 'New Horizons (LORRI)',
    date: 'Jul 14, 2015',
  },
  PIA20034: {
    title: 'Double-Lobed Profile of Kerberos',
    description:
      'LORRI composite acquired ~7 hours before closest approach, revealing a tiny, unexpectedly reflective double-lobed moon.',
    probe: 'New Horizons (LORRI)',
    date: 'Jul 14, 2015',
  },
  'styx-lorri': {
    title: 'Approach Composite of Styx',
    description:
      'Captured by LORRI ~12.5 hours before Pluto closest approach from ~631,000 km away, recording Pluto’s smallest and faintest moon.',
    probe: 'New Horizons (LORRI)',
    date: 'Jul 13, 2015',
  },
  'arrokoth-lorri': {
    title: 'Highest-Resolution Flyby View of Arrokoth',
    description:
      'The farthest world ever visited by a spacecraft, revealing a flattened contact binary formed by the gentle merger of two primordial planetesimals.',
    probe: 'New Horizons (LORRI)',
    date: 'Jan 1, 2019',
  },
}

export function localizedProbePhoto(photo: ProbePhoto, lang: Locale = locale.value): ProbePhoto {
  if (lang === 'zh') return photo
  const en = probePhotoEn[photo.id]
  if (!en) return photo
  return {
    ...photo,
    title: en.title,
    description: en.description,
    probe: en.probe,
    date: en.date,
  }
}

export const landscapeRegionEn: Record<string, string> = {
  Mars: 'Wind-Sculpted Mesa',
  Earth: 'Alpine Scree',
  Moon: 'Mare Crater Basin',
  Mercury: 'Impact Basin',
  Venus: 'Basalt Highlands',
  Jupiter: 'Above the Cloud Belts',
  Saturn: 'Upper Cloud Sea',
  Uranus: 'Upper Cloud Sea',
  Neptune: 'Upper Cloud Sea',
  Io: 'Volcanic Plains',
  Titan: 'Icy Dunes & Hills',
  Psyche: 'Iron-Nickel Crater Basin',
  Eurybates: 'Carbonaceous Regolith',
  Patroclus: 'Primordial Dark-Red Ice',
  Menoetius: 'Binary Crimson Mesa',
  Chiron: 'Sublimating Ice Ridge',
  Chariklo: 'Ringed Highland Plain',
  Pholus: 'Crimson Organic Ice',
  Orcus: 'Crystalline Water-Ice Plain',
  Vanth: 'Dark-Red Crater Mesa',
  Quaoar: 'Methane Frost Highlands',
  Arrokoth: 'Bilobed Red-Dust Neck',
  Gonggong: 'Crimson Tholin Ice Plain',
  Farfarout: 'Distant Frozen Wastes',
  VP113: 'Pale Pink Frost Hills',
  Sedna: 'Oort Crimson Tundra',
}

export const solarNotesEn: Record<Belt, { name: string; body: string }> = {
  scattered: {
    name: 'Scattered Disc & Inner Oort',
    body: 'Beyond 50 AU lies the high-inclination, eccentric scattered disc and detached inner Oort zone reaching hundreds to over a thousand AU—home to Gonggong, Eris, Farfarout (~132 AU), and deep-red Sedna (aphelion 937 AU).',
  },
  outer: {
    name: 'Kuiper Belt',
    body: 'An icy disk spanning ~30–50 AU beyond Neptune, home to New Horizons targets Pluto and contact-binary Arrokoth, anti-Pluto Orcus, fast-spinning ringed Haumea, twin-ringed Quaoar, and Makemake.',
  },
  centaur: {
    name: 'Centaur Belt',
    body: 'Icy-rocky minor bodies weaving among Jupiter, Saturn, Uranus, and Neptune with bimodal gray and ultra-red colors, including twin-ringed Chariklo and active ringed comet-centaur Chiron.',
  },
  trojan: {
    name: 'Jupiter Trojans',
    body: 'Two co-orbital asteroid clouds locked 60° ahead (L4 Greek camp) and behind (L5 Trojan camp) Jupiter. NASA’s Lucy spacecraft is en route to explore Eurybates and the equal-mass binary Patroclus-Menoetius.',
  },
  main: {
    name: 'Main Belt & Hilda Group',
    body: 'Between Mars and Jupiter (~2.1–3.3 AU), rocky and metallic remnants from early solar system formation are sculpted by Jupiter’s resonances into Kirkwood gaps and the outer 3:2 triangular Hilda group.',
  },
}

export const galaxyNotesEn = [
  {
    name: 'Solar System Location',
    body: 'The Sun resides in the Orion Spur, roughly 26,000 light-years from the Galactic Center. Click the Solar System marker to zoom back down to planetary orbits.',
  },
  {
    name: 'Galactic Center',
    body: 'The Milky Way is a barred spiral galaxy. Dense stars crowd the warm central bar and bulge; tilting edge-on reveals how the central bulge thickens above the thin disk.',
  },
  {
    name: 'Spiral Arms',
    body: 'Viewed from above the galactic plane, stars, gas, and dust trace graceful spiral arms. The Sun’s Orion Spur sits tucked between the Sagittarius and Perseus arms.',
  },
]

export const deepLandmarkEn: Record<string, string> = {
  '伴星系 NGC 5195': 'Companion NGC 5195',
  星暴外流: 'Starburst Outflow',
  中心喷流: 'Central Jet',
  尘埃盘: 'Debris Disk',
}

export const exoHostEn: Record<string, string> = {
  'proxima-centauri-b': 'Proxima Centauri',
  'trappist-1-e': 'TRAPPIST-1',
  '51-pegasi-b': '51 Pegasi',
  '55-cancri-e': '55 Cancri A',
  'kepler-452-b': 'Kepler-452',
  'hd-209458-b': 'HD 209458',
}
