import * as T from 'three'
import {
  AU_KM,
  AU_LIGHT_HOURS,
  createRadialMapper,
  epochPlanetPosition,
  formatMissionDate,
  formatMissionDateTime,
  planetHeliocentricAU,
} from '../data/voyager'
import {
  NH_ARCHIVE_END_MS,
  NH_ARROKOTH_YEAR,
  NH_END_MS,
  NH_END_YEAR,
  NH_JUPITER_YEAR,
  NH_PLUTO_YEAR,
  NH_START_YEAR,
  msToYear,
  newHorizonsEncounters,
  newHorizonsMilestones,
  nhMilestoneShort,
  yearToMs,
  type NewHorizonsFlyby,
  type NewHorizonsMilestone,
  type NewHorizonsStats,
} from '../data/newHorizons'
import data from '../data/newHorizonsTrack.json'
import { pick, type Locale } from '../i18n'
import { clamp, rad, tau, v3 } from './math'
import type { Label, ScreenPoint, World } from './types'

const MU_SUN = 1.32712440018e11 // km^3 / s^2
const CURVE_SAMPLES = 440
const TUBE_RADIAL = 6
const PULSE_COUNT = 16

type Project = (pos: T.Vector3) => ScreenPoint | null

// ── 1. SPICE Hermite + RK4 Solar-Gravity Ballistic Ephemeris ──

function buildFullHeliocentricRows(): number[][] {
  const rows: number[][] = data.overview.map((r) => [...r])
  const last = rows[rows.length - 1]
  let t = last[0]
  let rx = last[1], ry = last[2], rz = last[3]
  let vx = last[4], vy = last[5], vz = last[6]
  const dt = 10 * 86400 // 10-day RK4 step in seconds

  const accel = (x: number, y: number, z: number): [number, number, number] => {
    const r2 = x * x + y * y + z * z
    const inv = -MU_SUN / (r2 * Math.sqrt(r2))
    return [x * inv, y * inv, z * inv]
  }

  while (t < NH_END_MS + 86400_000) {
    const step = Math.min(dt, (NH_END_MS + 86400_000 - t) / 1000)
    if (step <= 1) break
    const [a1x, a1y, a1z] = accel(rx, ry, rz)
    const r2x = rx + 0.5 * step * vx, r2y = ry + 0.5 * step * vy, r2z = rz + 0.5 * step * vz
    const v2x = vx + 0.5 * step * a1x, v2y = vy + 0.5 * step * a1y, v2z = vz + 0.5 * step * a1z
    const [a2x, a2y, a2z] = accel(r2x, r2y, r2z)
    const r3x = rx + 0.5 * step * v2x, r3y = ry + 0.5 * step * v2y, r3z = rz + 0.5 * step * v2z
    const v3x = vx + 0.5 * step * a2x, v3y = vy + 0.5 * step * a2y, v3z = vz + 0.5 * step * a2z
    const [a3x, a3y, a3z] = accel(r3x, r3y, r3z)
    const r4x = rx + step * v3x, r4y = ry + step * v3y, r4z = rz + step * v3z
    const v4x = vx + step * a3x, v4y = vy + step * a3y, v4z = vz + step * a3z
    const [a4x, a4y, a4z] = accel(r4x, r4y, r4z)

    rx += (step / 6) * (vx + 2 * v2x + 2 * v3x + v4x)
    ry += (step / 6) * (vy + 2 * v2y + 2 * v3y + v4y)
    rz += (step / 6) * (vz + 2 * v2z + 2 * v3z + v4z)
    vx += (step / 6) * (a1x + 2 * a2x + 2 * a3x + a4x)
    vy += (step / 6) * (a1y + 2 * a2y + 2 * a3y + a4y)
    vz += (step / 6) * (a1z + 2 * a2z + 2 * a3z + a4z)
    t += step * 1000
    rows.push([t, rx, ry, rz, vx, vy, vz])
  }
  return rows
}

// SPICE states are geometric ECLIPJ2000, position in km, velocity in km/s.
function sampleSpiceTrack(track: number[][], timeMs: number, position: T.Vector3, velocity: T.Vector3) {
  let lo = 0
  let hi = track.length - 1
  if (timeMs <= track[0][0]) {
    const r = track[0]
    position.set(r[1], r[2], r[3])
    velocity.set(r[4], r[5], r[6])
    return
  }
  if (timeMs >= track[hi][0]) {
    const r = track[hi]
    position.set(r[1], r[2], r[3])
    velocity.set(r[4], r[5], r[6])
    return
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1
    if (track[mid][0] <= timeMs) lo = mid
    else hi = mid
  }
  const a = track[lo]
  const b = track[hi]
  if (b[7]) {
    const row = timeMs < b[0] ? a : b
    position.set(row[1], row[2], row[3])
    velocity.set(row[4], row[5], row[6])
    return
  }
  const span = (b[0] - a[0]) / 1000
  const u = clamp((timeMs - a[0]) / (b[0] - a[0]), 0, 1)
  const u2 = u * u
  const u3 = u2 * u
  for (let axis = 0; axis < 3; axis++) {
    const p0 = a[axis + 1], p1 = b[axis + 1]
    const v0 = a[axis + 4], v1 = b[axis + 4]
    position.setComponent(
      axis,
      (2 * u3 - 3 * u2 + 1) * p0 +
        (u3 - 2 * u2 + u) * span * v0 +
        (-2 * u3 + 3 * u2) * p1 +
        (u3 - u2) * span * v1,
    )
    velocity.setComponent(
      axis,
      ((6 * u2 - 6 * u) * (p0 - p1)) / span +
        (3 * u2 - 4 * u + 1) * v0 +
        (3 * u2 - 2 * u) * v1,
    )
  }
}

interface EncounterPass {
  id: NewHorizonsFlyby
  body: World
  minYear: number
  maxYear: number
  years: number[]
  nearRadius: number
  apply: (year: number, out: T.Vector3) => void
}

function createEncounterPass(
  id: NewHorizonsFlyby,
  body: World,
  rawSamples: number[][],
  closestKm: number,
  nearRadius: number,
  farRadius: number,
  blendSigmaYears: number,
  mappedAt: (year: number) => T.Vector3,
): EncounterPass {
  const maxKm = Math.max(
    closestKm * 1.15,
    ...rawSamples.map((r) => Math.hypot(r[1], r[2], r[3])),
  )
  const denom = Math.max(1e-4, Math.log(maxKm / closestKm))
  // Downsample dense 180-pt SPICE table to ~37 crisp curve vertices preserving closest approach
  const stride = Math.max(1, Math.floor(rawSamples.length / 36))
  const picked: number[][] = []
  const caIdx = rawSamples.reduce(
    (best, row, idx) =>
      Math.hypot(row[1], row[2], row[3]) <
      Math.hypot(rawSamples[best][1], rawSamples[best][2], rawSamples[best][3])
        ? idx
        : best,
    0,
  )
  for (let i = 0; i < rawSamples.length; i++) {
    if (i === 0 || i === rawSamples.length - 1 || i === caIdx || i % stride === 0) {
      picked.push(rawSamples[i])
    }
  }

  const samples = picked.map((row) => {
    const year = msToYear(row[0])
    const vec = v3(row[1], row[3], -row[2]) // ECLIPJ2000 (x, y, z) -> scene (x, z, -y)
    const distKm = Math.max(closestKm, vec.length())
    const t = clamp(Math.log(distKm / closestKm) / denom, 0, 1)
    const radius = nearRadius + (farRadius - nearRadius) * t
    const planetPos = epochPlanetPosition(body, year, v3())
    const pos = vec.setLength(radius).add(planetPos)
    return { year, pos, delta: pos.clone().sub(mappedAt(year)) }
  })

  const first = samples[0]
  const last = samples[samples.length - 1]
  return {
    id,
    body,
    minYear: first.year,
    maxYear: last.year,
    years: samples.map((s) => s.year),
    nearRadius,
    apply(year: number, out: T.Vector3) {
      if (year < first.year || year > last.year) {
        const edge = year < first.year ? first : last
        const dt = (year - edge.year) / blendSigmaYears
        if (Math.abs(dt) < 4.2) {
          out.addScaledVector(edge.delta, Math.exp(-0.5 * dt * dt))
        }
        return
      }
      let lo = 0
      let hi = samples.length - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >>> 1
        if (samples[mid].year <= year) lo = mid
        else hi = mid
      }
      const a = samples[lo]
      const b = samples[hi]
      const t = a === b ? 0 : clamp((year - a.year) / (b.year - a.year), 0, 1)
      out.lerpVectors(a.pos, b.pos, t)
    },
  }
}

export interface NewHorizonsSample {
  year: number
  timeMs: number
  pos: T.Vector3
  rAU: number
  earthAU: number
  earthBillionKm: number
  lightHours: number
  speedKmS: number
  lonDeg: number
  latDeg: number
  activeEncounter: NewHorizonsFlyby | null
  targetDistanceKm: number | null
  targetSpeedKmS: number | null
  caDeltaSec: number | null
  encounterClosestKm: number | null
  encounterTimeMs: number | null
  isPostArchive: boolean
}

function createNewHorizonsEphemeris(
  worlds: World[],
  planets: World[],
  mapOuterAU: (au: number) => number,
) {
  const mapper = createRadialMapper(planets, mapOuterAU)
  const fullRows = buildFullHeliocentricRows()
  const earth = worlds.find((w) => w.id === 'Earth')!
  const jupiter = worlds.find((w) => w.id === 'Jupiter')!
  const pluto = worlds.find((w) => w.id === 'Pluto')!
  const arrokoth = worlds.find((w) => w.id === 'Arrokoth')!

  const helioPosKm = v3()
  const helioVelKmS = v3()
  const relPosKm = v3()
  const relVelKmS = v3()
  const helioAUTmp = v3()
  const earthAUTmp = v3()

  function mapRawScene(year: number, out = v3()) {
    const timeMs = yearToMs(clamp(year, NH_START_YEAR, NH_END_YEAR))
    sampleSpiceTrack(fullRows, timeMs, helioPosKm, helioVelKmS)
    const rKm = Math.max(1, helioPosKm.length())
    const rAU = rKm / AU_KM
    const rScene = mapper.auToScene(rAU)
    // ECLIPJ2000 (x, y, z) -> scene (x, z, -y)
    return out.set(helioPosKm.x, helioPosKm.z, -helioPosKm.y).multiplyScalar(rScene / rKm)
  }

  // Launch anchor right off Earth's sunlit limb
  const launchRaw = mapRawScene(NH_START_YEAR, v3())
  const launchEarth = epochPlanetPosition(earth, NH_START_YEAR, v3())
  const launchDesired = launchEarth.clone().add(v3(0, earth.r * 1.55 + 0.8, 0))
  const launchDelta = launchDesired.sub(launchRaw)

  // Real SPICE encounter passes scaled cleanly around each live 3D world
  const jupiterPass = createEncounterPass(
    'jupiter',
    jupiter,
    data.encounters.jupiter.samples,
    data.encounters.jupiter.distanceKm,
    jupiter.extent * 1.12,
    jupiter.extent * 1.52,
    0.32,
    (y) => mapRawScene(y, v3()),
  )
  const plutoPass = createEncounterPass(
    'pluto',
    pluto,
    data.encounters.pluto.samples,
    data.encounters.pluto.distanceKm,
    pluto.r * 2.15,
    pluto.extent * 1.18,
    0.65,
    (y) => mapRawScene(y, v3()),
  )
  const arrokothPass = createEncounterPass(
    'arrokoth',
    arrokoth,
    data.encounters.arrokoth.samples,
    data.encounters.arrokoth.distanceKm,
    arrokoth.r * 3.85,
    arrokoth.r * 7.8,
    0.55,
    (y) => mapRawScene(y, v3()),
  )
  const passes = [jupiterPass, plutoPass, arrokothPass]
  const planetTmp = v3()

  function sample(year: number, outPos = v3()): NewHorizonsSample {
    const y = clamp(year, NH_START_YEAR, NH_END_YEAR)
    const timeMs = yearToMs(y)
    sampleSpiceTrack(fullRows, timeMs, helioPosKm, helioVelKmS)

    const rKm = Math.max(1, helioPosKm.length())
    const rAU = rKm / AU_KM
    const rScene = mapper.auToScene(rAU)
    outPos.set(helioPosKm.x, helioPosKm.z, -helioPosKm.y).multiplyScalar(rScene / rKm)

    // Smooth launch offset from Earth
    const launchDt = (y - NH_START_YEAR) / 0.08
    if (Math.abs(launchDt) < 3.6) {
      outPos.addScaledVector(launchDelta, Math.exp(-0.5 * launchDt * launchDt))
    }

    // Apply real SPICE encounter geometries
    for (const pass of passes) {
      pass.apply(y, outPos)
    }

    // Soft collision guard so the probe never pierces enlarged planet globes during playback
    const guards: [World, number, number][] = [
      [earth, NH_START_YEAR, earth.r * 1.5 + 0.6],
      [jupiter, NH_JUPITER_YEAR, jupiter.r * 1.45 + 1.0],
      [pluto, NH_PLUTO_YEAR, pluto.r * 1.65 + 0.3],
      [arrokoth, NH_ARROKOTH_YEAR, arrokoth.r * 2.4 + 0.3],
    ]
    for (const [world, encYear, minDist] of guards) {
      if (Math.abs(y - encYear) > 0.35) continue
      const c = epochPlanetPosition(world, y, planetTmp)
      const dist = outPos.distanceTo(c)
      if (dist < minDist) {
        if (dist < 1e-4) outPos.set(c.x, c.y + minDist, c.z)
        else outPos.sub(c).setLength(minDist).add(c)
      }
    }

    const speedKmS = helioVelKmS.length()
    const lonDeg = ((Math.atan2(helioPosKm.y, helioPosKm.x) * 180) / Math.PI + 360) % 360
    const latDeg = (Math.asin(clamp(helioPosKm.z / rKm, -1, 1)) * 180) / Math.PI

    // Exact Earth distance & light-time
    helioAUTmp.set(helioPosKm.x / AU_KM, helioPosKm.z / AU_KM, -helioPosKm.y / AU_KM)
    planetHeliocentricAU('Earth', y, earthAUTmp)
    const earthAU = Math.max(0.0001, helioAUTmp.distanceTo(earthAUTmp))
    const earthBillionKm = (earthAU * AU_KM) / 1e9
    const lightHours = earthAU * AU_LIGHT_HOURS

    // Check active SPICE encounter window
    let activeEncounter: NewHorizonsFlyby | null = null
    let targetDistanceKm: number | null = null
    let targetSpeedKmS: number | null = null
    let caDeltaSec: number | null = null
    let encounterClosestKm: number | null = null
    let encounterTimeMs: number | null = null

    for (const id of ['jupiter', 'pluto', 'arrokoth'] as const) {
      const enc = data.encounters[id]
      const meta = newHorizonsEncounters[id]
      const samples = enc.samples
      const t0 = samples[0][0]
      const t1 = samples[samples.length - 1][0]
      // Show encounter telemetry inside SPICE window or within brief display margin
      const displayPadMs = id === 'jupiter' ? 36 * 3600_000 : id === 'pluto' ? 3 * 3600_000 : 45 * 60_000
      if (timeMs >= t0 - displayPadMs && timeMs <= t1 + displayPadMs) {
        activeEncounter = id
        encounterClosestKm = enc.distanceKm
        encounterTimeMs = enc.time
        caDeltaSec = (timeMs - enc.time) / 1000
        if (timeMs >= t0 && timeMs <= t1) {
          sampleSpiceTrack(samples, timeMs, relPosKm, relVelKmS)
          targetDistanceKm = relPosKm.length()
          targetSpeedKmS = relVelKmS.length()
        } else {
          // Smooth ballistic distance estimate just outside the high-rate SPICE window
          const edgeRow = timeMs < t0 ? samples[0] : samples[samples.length - 1]
          const dtSec = (timeMs - edgeRow[0]) / 1000
          relPosKm.set(
            edgeRow[1] + edgeRow[4] * dtSec,
            edgeRow[2] + edgeRow[5] * dtSec,
            edgeRow[3] + edgeRow[6] * dtSec,
          )
          targetDistanceKm = relPosKm.length()
          targetSpeedKmS = meta.speedKmS
        }
        break
      }
    }

    return {
      year: y,
      timeMs,
      pos: outPos,
      rAU,
      earthAU,
      earthBillionKm,
      lightHours,
      speedKmS,
      lonDeg,
      latDeg,
      activeEncounter,
      targetDistanceKm,
      targetSpeedKmS,
      caDeltaSec,
      encounterClosestKm,
      encounterTimeMs,
      isPostArchive: timeMs > NH_ARCHIVE_END_MS,
    }
  }

  function statsAt(year: number, lang: Locale = 'zh', s = sample(year)): NewHorizonsStats {
    return {
      year: s.year,
      timeMs: s.timeMs,
      dateLabel: formatMissionDate(s.year, lang),
      dateTimeLabel: formatMissionDateTime(s.year, lang),
      sunAU: s.rAU,
      earthAU: s.earthAU,
      earthBillionKm: s.earthBillionKm,
      lightHours: s.lightHours,
      speedKmS: s.speedKmS,
      latDeg: s.latDeg,
      lonDeg: s.lonDeg,
      activeEncounter: s.activeEncounter,
      targetDistanceKm: s.targetDistanceKm,
      targetSpeedKmS: s.targetSpeedKmS,
      caDeltaSec: s.caDeltaSec,
      encounterClosestKm: s.encounterClosestKm,
      encounterTimeMs: s.encounterTimeMs,
      isPostArchive: s.isPostArchive,
    }
  }

  function nearestMilestoneId(year: number) {
    let active = newHorizonsMilestones[0].id
    for (const m of newHorizonsMilestones) {
      if (year >= m.year - 1e-5) active = m.id
    }
    return active
  }

  return {
    mapper,
    sample,
    statsAt,
    nearestMilestoneId,
    encounterYears: [...jupiterPass.years, ...plutoPass.years, ...arrokothPass.years],
    targets: { earth, jupiter, pluto, arrokoth },
  }
}

// ── 2. Procedural 3D New Horizons Spacecraft ("Grand Piano" + 2.1m Dish + RTG + LORRI) ──

function buildNewHorizonsSpacecraft(): {
  craft: T.Group
  lorriTip: T.Vector3
} {
  const craft = new T.Group()

  // Materials
  const dishMat = new T.MeshPhongMaterial({
    color: 0xf0f5fc,
    emissive: 0x263448,
    specular: 0xa4c8ea,
    shininess: 42,
    side: T.DoubleSide,
  })
  const rimMat = new T.MeshPhongMaterial({
    color: 0xc8d8eb,
    emissive: 0x1a2838,
    shininess: 52,
  })
  const goldFoilMat = new T.MeshPhongMaterial({
    color: 0xebb648,
    emissive: 0x452b09,
    specular: 0xffe9a8,
    shininess: 86,
  })
  const goldWarmMat = new T.MeshPhongMaterial({
    color: 0xd99b34,
    emissive: 0x382006,
    specular: 0xffdc92,
    shininess: 72,
  })
  const darkMetalMat = new T.MeshPhongMaterial({
    color: 0x283342,
    emissive: 0x0d1420,
    specular: 0x6c86a4,
    shininess: 42,
  })
  const silverMetalMat = new T.MeshPhongMaterial({
    color: 0xb6c7d8,
    emissive: 0x1a2634,
    specular: 0xd8ecff,
    shininess: 68,
  })
  const rtgBodyMat = new T.MeshPhongMaterial({
    color: 0x2a303a,
    emissive: 0x2c1408,
    specular: 0x7a8ca0,
    shininess: 38,
  })
  const rtgGlowMat = new T.MeshBasicMaterial({ color: 0xff9f4e })
  const lensMat = new T.MeshPhongMaterial({
    color: 0x56dcff,
    emissive: 0x1a82b4,
    specular: 0xe6faff,
    shininess: 115,
  })
  const sdcMat = new T.MeshPhongMaterial({
    color: 0x7ea6c8,
    emissive: 0x14283e,
    specular: 0xc8e4ff,
    shininess: 80,
  })

  // 1. Iconic 2.1m White High-Gain Parabolic Dish Antenna (+Z boresight toward Earth)
  const dishPoints: T.Vector2[] = []
  for (let i = 0; i <= 18; i++) {
    const t = i / 18
    const r = 0.035 + t * 0.72
    const z = 0.14 + t * t * 0.22
    dishPoints.push(new T.Vector2(r, z))
  }
  const dishGeo = new T.LatheGeometry(dishPoints, 40)
  dishGeo.rotateX(Math.PI / 2)
  const dish = new T.Mesh(dishGeo, dishMat)
  craft.add(dish)

  // Rim collar
  const rim = new T.Mesh(new T.TorusGeometry(0.752, 0.02, 10, 44), rimMat)
  rim.position.z = 0.36
  craft.add(rim)

  // Dish rear support drum connecting dish to triangular bus (kept behind dish center z=0.14)
  const pedestal = new T.Mesh(new T.CylinderGeometry(0.24, 0.3, 0.16, 18), darkMetalMat)
  pedestal.rotation.x = Math.PI / 2
  pedestal.position.z = 0.04
  craft.add(pedestal)

  // Cassegrain sub-reflector + Medium-Gain Antenna (MGA) top horn + 3 tripod struts
  const sub = new T.Mesh(new T.CylinderGeometry(0.085, 0.11, 0.048, 18), silverMetalMat)
  sub.rotation.x = Math.PI / 2
  sub.position.z = 0.52
  craft.add(sub)

  const mga = new T.Mesh(new T.CylinderGeometry(0.065, 0.045, 0.11, 16), dishMat)
  mga.rotation.x = Math.PI / 2
  mga.position.z = 0.6
  craft.add(mga)

  for (let i = 0; i < 3; i++) {
    const a = (i * tau) / 3 + 0.52
    const p0 = v3(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.22)
    const p1 = v3(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.52)
    const dir = p1.clone().sub(p0)
    const strut = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, dir.length(), 6), silverMetalMat)
    strut.position.copy(p0).addScaledVector(dir, 0.5)
    strut.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.normalize())
    craft.add(strut)
  }

  // 2. Iconic Golden Kapton Triangular "Grand Piano" Bus (beveled triangle prism)
  const tri = new T.Shape()
  const triPts: [number, number][] = [
    [0.0, 0.72], // top-front apex (science / Alice side)
    [-0.78, -0.44], // lower-left vertex (RTG mount corner)
    [0.74, -0.46], // lower-right vertex (LORRI / Ralph corner)
  ]
  tri.moveTo(triPts[0][0], triPts[0][1])
  tri.lineTo(triPts[1][0], triPts[1][1])
  tri.lineTo(triPts[2][0], triPts[2][1])
  tri.closePath()

  const busGeo = new T.ExtrudeGeometry(tri, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 2,
  })
  busGeo.translate(0, 0, -0.34)
  const bus = new T.Mesh(busGeo, goldFoilMat)
  craft.add(bus)

  // Secondary recessed equipment deck & dark thermal louvers along bus edges
  const deckPlate = new T.Mesh(new T.CylinderGeometry(0.36, 0.4, 0.08, 6), goldWarmMat)
  deckPlate.rotation.x = Math.PI / 2
  deckPlate.position.set(0, -0.04, -0.39)
  craft.add(deckPlate)

  const louver = new T.Mesh(new T.BoxGeometry(0.54, 0.08, 0.22), darkMetalMat)
  louver.position.set(0.0, -0.49, -0.17)
  craft.add(louver)

  // 3. Iconic Black Finned GPHS-RTG Nuclear Generator (extending off lower-left vertex)
  const rtgDir = v3(-0.84, -0.48, -0.24).normalize()
  const rtgBase = v3(-0.58, -0.34, -0.17)

  const rtgYoke = new T.Mesh(new T.CylinderGeometry(0.075, 0.11, 0.22, 10), silverMetalMat)
  rtgYoke.position.copy(rtgBase).addScaledVector(rtgDir, 0.14)
  rtgYoke.quaternion.setFromUnitVectors(v3(0, 1, 0), rtgDir)
  craft.add(rtgYoke)

  const rtgGroup = new T.Group()
  rtgGroup.position.copy(rtgBase).addScaledVector(rtgDir, 0.62)
  rtgGroup.quaternion.setFromUnitVectors(v3(0, 1, 0), rtgDir)
  const rtgCore = new T.Mesh(new T.CylinderGeometry(0.115, 0.125, 0.78, 16), rtgBodyMat)
  rtgGroup.add(rtgCore)
  // 8 radial radiator fins along the RTG cylinder
  const finGeo = new T.BoxGeometry(0.016, 0.72, 0.095)
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8
    const fin = new T.Mesh(finGeo, rtgBodyMat)
    fin.position.set(Math.sin(a) * 0.145, 0, Math.cos(a) * 0.145)
    fin.rotation.y = a
    rtgGroup.add(fin)
  }
  // Subtle warm thermal infrared glow collars
  for (const yOff of [-0.24, 0.0, 0.24]) {
    const glow = new T.Mesh(new T.TorusGeometry(0.122, 0.01, 6, 18), rtgGlowMat)
    glow.rotation.x = Math.PI / 2
    glow.position.y = yOff
    rtgGroup.add(glow)
  }
  craft.add(rtgGroup)

  // 4. LORRI Telescope (Long Range Reconnaissance Imager — protruding on right science flank)
  const lorriPos = v3(0.64, -0.18, -0.18)
  const lorriBarrel = new T.Mesh(new T.CylinderGeometry(0.09, 0.105, 0.42, 18), darkMetalMat)
  lorriBarrel.rotation.z = -Math.PI / 2
  lorriBarrel.position.copy(lorriPos)
  craft.add(lorriBarrel)

  const lorriBaffle = new T.Mesh(new T.CylinderGeometry(0.11, 0.09, 0.1, 18), silverMetalMat)
  lorriBaffle.rotation.z = -Math.PI / 2
  lorriBaffle.position.set(lorriPos.x + 0.23, lorriPos.y, lorriPos.z)
  craft.add(lorriBaffle)

  const lorriLens = new T.Mesh(new T.CylinderGeometry(0.072, 0.072, 0.03, 18), lensMat)
  lorriLens.rotation.z = -Math.PI / 2
  lorriLens.position.set(lorriPos.x + 0.27, lorriPos.y, lorriPos.z)
  craft.add(lorriLens)

  // 5. Ralph (MVIC/LEISA) & Alice Science Instruments on upper-right edge
  const ralph = new T.Mesh(new T.BoxGeometry(0.24, 0.18, 0.2), goldWarmMat)
  ralph.position.set(0.46, 0.18, -0.16)
  craft.add(ralph)

  const ralphHood = new T.Mesh(new T.CylinderGeometry(0.048, 0.058, 0.12, 12), darkMetalMat)
  ralphHood.rotation.z = -Math.PI / 2
  ralphHood.position.set(0.61, 0.18, -0.16)
  craft.add(ralphHood)

  const alice = new T.Mesh(new T.BoxGeometry(0.18, 0.14, 0.18), darkMetalMat)
  alice.position.set(0.18, 0.48, -0.16)
  craft.add(alice)

  // 6. SWAP + PEPSSI + Venetia Burney Student Dust Counter (SDC) panel
  const swap = new T.Mesh(new T.CylinderGeometry(0.075, 0.09, 0.14, 14), silverMetalMat)
  swap.position.set(-0.24, 0.34, -0.16)
  craft.add(swap)

  const pepssi = new T.Mesh(new T.SphereGeometry(0.072, 12, 10), silverMetalMat)
  pepssi.position.set(-0.36, 0.16, -0.18)
  craft.add(pepssi)

  const sdcPanel = new T.Mesh(new T.BoxGeometry(0.38, 0.24, 0.025), sdcMat)
  sdcPanel.position.set(0.06, -0.12, -0.43)
  craft.add(sdcPanel)

  // 7. Twin Star Trackers & Aft Low-Gain Antenna (LGA)
  const aftLga = new T.Mesh(new T.CylinderGeometry(0.025, 0.04, 0.26, 10), silverMetalMat)
  aftLga.rotation.x = Math.PI / 2
  aftLga.position.set(0, -0.02, -0.54)
  craft.add(aftLga)

  return { craft, lorriTip: v3(lorriPos.x + 0.27, lorriPos.y, lorriPos.z) }
}

function createBeaconSpriteTexture(): T.CanvasTexture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const mid = size / 2

  const radGrad = g.createRadialGradient(mid, mid, 2, mid, mid, mid)
  radGrad.addColorStop(0, 'rgba(255, 250, 232, 1.0)')
  radGrad.addColorStop(0.18, 'rgba(255, 206, 120, 0.92)')
  radGrad.addColorStop(0.42, 'rgba(92, 224, 255, 0.30)')
  radGrad.addColorStop(0.76, 'rgba(92, 224, 255, 0.05)')
  radGrad.addColorStop(1, 'rgba(92, 224, 255, 0)')
  g.fillStyle = radGrad
  g.fillRect(0, 0, size, size)

  // Outer hexagonal-accent targeting ring
  g.strokeStyle = 'rgba(255, 212, 128, 0.84)'
  g.lineWidth = 2.4
  g.beginPath()
  g.arc(mid, mid, 35, 0, tau)
  g.stroke()

  g.strokeStyle = 'rgba(116, 238, 255, 0.88)'
  g.lineWidth = 2.2
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4
    g.beginPath()
    g.moveTo(mid + Math.cos(a) * 40, mid + Math.sin(a) * 40)
    g.lineTo(mid + Math.cos(a) * 52, mid + Math.sin(a) * 52)
    g.stroke()
  }

  const tex = new T.CanvasTexture(c)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

function createCircleLine(
  radius: number,
  color: number,
  opacity: number,
  segments = 160,
  dashed = false,
): T.Line {
  const pts: T.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * tau
    pts.push(v3(Math.cos(a) * radius, 0, -Math.sin(a) * radius))
  }
  const geo = new T.BufferGeometry().setFromPoints(pts)
  const mat = dashed
    ? new T.LineDashedMaterial({
        color,
        transparent: true,
        opacity,
        dashSize: radius * 0.028,
        gapSize: radius * 0.02,
        depthWrite: false,
      })
    : new T.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      })
  const line = new T.Line(geo, mat)
  if (dashed) line.computeLineDistances()
  return line
}

function createScanConeMaterial(): T.ShaderMaterial {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new T.Color(0x6ae8ff) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        // vUv.y = 1 at apex (spacecraft), 0 at base (target body)
        float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        float edge = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDir))), 1.35);
        float sweep = 0.65 + 0.35 * sin(vUv.y * 28.0 - uTime * 6.5);
        float alpha = (0.14 + 0.48 * edge) * along * sweep * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  })
}

const paletteStops: [number, number][] = [
  [NH_START_YEAR, 0xffcd6e], // Launch Solar Gold
  [NH_JUPITER_YEAR, 0xff924c], // Jupiter Gravity Assist Amber
  [2011.5, 0x4ad8ff], // Outer Giant Cruise Cyan
  [NH_PLUTO_YEAR, 0x84f0ff], // Pluto–Charon Ice Cyan
  [NH_ARROKOTH_YEAR, 0xb298ff], // Arrokoth Deep Kuiper Violet-Blue
  [2021.3, 0x6ae6d4], // 50 AU Kuiper Cliff Aqua
  [NH_END_YEAR, 0x7df0ff], // Deep Space Cruise
]
const palette = paletteStops.map(([year, hex]) => ({ year, color: new T.Color(hex) }))

function trajectoryColor(year: number, out: T.Color) {
  let i = 1
  while (i < palette.length - 1 && palette[i].year < year) i++
  const a = palette[i - 1]
  const b = palette[i]
  return out.lerpColors(a.color, b.color, clamp((year - a.year) / (b.year - a.year), 0, 1))
}

export interface NewHorizonsMilestoneNode {
  milestone: NewHorizonsMilestone
  pos: T.Vector3
  mesh: T.Mesh
  tag: HTMLSpanElement
}

// ── 3. Main Scene-Integrated New Horizons 3D Model ──

export function createNewHorizonsModel(
  scene: T.Scene,
  webgl: boolean,
  worlds: World[],
  planets: World[],
  mapOuterAU: (au: number) => number,
  tag: (name: string, cls?: string) => HTMLSpanElement,
) {
  const ephemeris = createNewHorizonsEphemeris(worlds, planets, mapOuterAU)
  const { earth, jupiter, pluto, arrokoth } = ephemeris.targets
  const accent = 0x70e4ff

  const root = new T.Group()
  root.visible = false
  scene.add(root)

  // Sample curve densely around early flight AND exact encounter timestamps!
  const baseYears = Array.from({ length: CURVE_SAMPLES }, (_, i) =>
    NH_START_YEAR + (NH_END_YEAR - NH_START_YEAR) * (i / (CURVE_SAMPLES - 1)) ** 1.24,
  )
  const sampleYears = [
    ...new Set([
      ...baseYears,
      ...ephemeris.encounterYears,
      ...newHorizonsMilestones.map((m) => m.year),
    ]),
  ].sort((a, b) => a - b)
  const samples = sampleYears.length

  const curvePts: T.Vector3[] = []
  const shadowPts: T.Vector3[] = []
  const colorArray = new Float32Array(samples * 3)
  const tmpColor = new T.Color()

  for (const [i, year] of sampleYears.entries()) {
    const s = ephemeris.sample(year, v3())
    curvePts.push(s.pos)
    shadowPts.push(v3(s.pos.x, 0, s.pos.z))
    trajectoryColor(year, tmpColor)
    colorArray[i * 3] = tmpColor.r
    colorArray[i * 3 + 1] = tmpColor.g
    colorArray[i * 3 + 2] = tmpColor.b
  }

  // Full upcoming dashed reference path
  const refGeo = new T.BufferGeometry().setFromPoints(curvePts)
  const refMat = new T.LineDashedMaterial({
    color: 0x76b8e8,
    transparent: true,
    opacity: 0.28,
    dashSize: 4.5,
    gapSize: 3.5,
    depthWrite: false,
  })
  const fullRefLine = new T.Line(refGeo, refMat)
  fullRefLine.computeLineDistances()
  root.add(fullRefLine)

  // Active traveled trajectory core line (vertex gradient + live interpolated tip)
  const activePositions = new Float32Array((samples + 1) * 3)
  const activeColors = new Float32Array((samples + 1) * 3)
  for (let i = 0; i < samples; i++) {
    curvePts[i].toArray(activePositions, i * 3)
    activeColors[i * 3] = colorArray[i * 3]
    activeColors[i * 3 + 1] = colorArray[i * 3 + 1]
    activeColors[i * 3 + 2] = colorArray[i * 3 + 2]
  }
  const activePosAttr = new T.BufferAttribute(activePositions, 3)
  const activeColAttr = new T.BufferAttribute(activeColors, 3)
  const activeLineGeo = new T.BufferGeometry()
  activeLineGeo.setAttribute('position', activePosAttr)
  activeLineGeo.setAttribute('color', activeColAttr)
  const activeLineMat = new T.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  })
  const activeLine = new T.Line(activeLineGeo, activeLineMat)
  activeLine.frustumCulled = false
  root.add(activeLine)

  // Luminous 3D Tube halo (WebGL only, O(1) drawRange slicing)
  let activeTube: T.Mesh | null = null
  let activeTubeMat: T.MeshBasicMaterial | null = null
  if (webgl) {
    const spline = new T.CatmullRomCurve3(curvePts, false, 'centripetal', 0.25)
    spline.getUtoTmapping = (u: number) => u
    const tubeSegs = samples - 1
    const tubeGeo = new T.TubeGeometry(spline, tubeSegs, 0.22, TUBE_RADIAL, false)
    const vCount = tubeGeo.attributes.position.count
    const tubeColors = new Float32Array(vCount * 3)
    const ringVerts = TUBE_RADIAL + 1
    for (let seg = 0; seg <= tubeSegs; seg++) {
      const yr = sampleYears[Math.min(samples - 1, seg)]
      trajectoryColor(yr, tmpColor)
      for (let r = 0; r < ringVerts; r++) {
        const idx = (seg * ringVerts + r) * 3
        if (idx + 2 < tubeColors.length) {
          tubeColors[idx] = tmpColor.r
          tubeColors[idx + 1] = tmpColor.g
          tubeColors[idx + 2] = tmpColor.b
        }
      }
    }
    tubeGeo.setAttribute('color', new T.BufferAttribute(tubeColors, 3))
    activeTubeMat = new T.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.34,
      blending: T.AdditiveBlending,
      depthWrite: false,
    })
    activeTube = new T.Mesh(tubeGeo, activeTubeMat)
    activeTube.frustumCulled = false
    root.add(activeTube)
  }

  // Ecliptic plane dashed projection + vertical altitude drop-stem
  const shadowGeo = new T.BufferGeometry().setFromPoints([...shadowPts, shadowPts[samples - 1]])
  const shadowMat = new T.LineDashedMaterial({
    color: accent,
    dashSize: 2.8,
    gapSize: 2.0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  })
  const eclipticShadowLine = new T.Line(shadowGeo, shadowMat)
  eclipticShadowLine.computeLineDistances()
  const shadowPositions = shadowGeo.attributes.position
  const shadowDistances = shadowGeo.attributes.lineDistance
  const staticDistances = shadowDistances.array.slice()
  eclipticShadowLine.frustumCulled = false
  root.add(eclipticShadowLine)

  const stemPositions = new Float32Array(6)
  const stemGeo = new T.BufferGeometry()
  stemGeo.setAttribute('position', new T.BufferAttribute(stemPositions, 3))
  const stemMat = new T.LineDashedMaterial({
    color: accent,
    transparent: true,
    opacity: 0.45,
    dashSize: 2.5,
    gapSize: 2.0,
    depthWrite: false,
  })
  const altitudeStem = new T.Line(stemGeo, stemMat)
  const stemDistances = new T.Float32BufferAttribute([0, 0], 1)
  stemGeo.setAttribute('lineDistance', stemDistances)
  altitudeStem.frustumCulled = false
  root.add(altitudeStem)

  const footRing = createCircleLine(2.2, accent, 0.5, 32, false)
  root.add(footRing)

  // 50 AU Kuiper Cliff Reference Ring
  const fiftyAUR = ephemeris.mapper.auToScene(50)
  const fiftyRing = createCircleLine(fiftyAUR, 0x6ae6d4, 0.28, 180, true)
  root.add(fiftyRing)
  const fiftyLandmark = v3(Math.cos(308 * rad) * fiftyAUR, 0, -Math.sin(308 * rad) * fiftyAUR)
  const fiftyLabel = tag('', 'voyager-bound')

  // Earth -> New Horizons Light-Speed Radio Communication Beam + Flowing Photon Pulses
  const radioPositions = new Float32Array(6)
  const radioGeo = new T.BufferGeometry()
  radioGeo.setAttribute('position', new T.BufferAttribute(radioPositions, 3))
  const radioMat = new T.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.32,
    blending: T.AdditiveBlending,
    depthWrite: false,
  })
  const radioBeam = new T.Line(radioGeo, radioMat)
  radioBeam.frustumCulled = false
  root.add(radioBeam)

  const pulsePositions = new Float32Array(PULSE_COUNT * 3)
  const pulseAlphas = new Float32Array(PULSE_COUNT)
  const pulseGeo = new T.BufferGeometry()
  pulseGeo.setAttribute('position', new T.BufferAttribute(pulsePositions, 3))
  pulseGeo.setAttribute('aAlpha', new T.BufferAttribute(pulseAlphas, 1))
  const pulseMat = webgl
    ? new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        uniforms: {
          uPixelRatio: { value: 1 },
          uColor: { value: new T.Color(0x88f0ff) },
        },
        vertexShader: `
          attribute float aAlpha;
          uniform float uPixelRatio;
          varying float vAlpha;
          void main() {
            vAlpha = aAlpha;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPos;
            gl_PointSize = clamp(8.0 * uPixelRatio, 5.0, 15.0);
          }
        `,
        fragmentShader: `
          varying float vAlpha;
          uniform vec3 uColor;
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float r2 = dot(p, p);
            if (r2 > 1.0) discard;
            float core = exp(-4.2 * r2);
            gl_FragColor = vec4(uColor, core * vAlpha * 0.95);
          }
        `,
      })
    : new T.PointsMaterial({
        color: 0x88f0ff,
        size: 3.2,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
  const radioPulses = new T.Points(pulseGeo, pulseMat)
  radioPulses.frustumCulled = false
  root.add(radioPulses)

  // Procedural 3D New Horizons Spacecraft + LORRI Optical Scan Cone + Locator Beacon
  const probeAnchor = new T.Group()
  root.add(probeAnchor)

  const { craft: spacecraft } = buildNewHorizonsSpacecraft()
  probeAnchor.add(spacecraft)

  // Subtle fill light attached to probe so close-up golden foil, dish, RTG & LORRI gleam naturally
  const probeLight = new T.PointLight(0xffe8c8, 0.72, 22, 1.5)
  probeLight.position.set(2.4, 2.8, 3.0)
  probeAnchor.add(probeLight)

  // LORRI/Ralph Optical Encounter Scan Cone (cone tip at origin, opening along +Y, oriented toward target!)
  const scanGeo = new T.ConeGeometry(1, 1, 28, 1, true)
  scanGeo.translate(0, -0.5, 0) // apex at y=0, base at y=-1
  const scanMat = webgl
    ? createScanConeMaterial()
    : new T.MeshBasicMaterial({
        color: 0x6ae8ff,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
        depthWrite: false,
      })
  const scanCone = new T.Mesh(scanGeo, scanMat)
  scanCone.visible = false
  scanCone.renderOrder = 6
  root.add(scanCone)

  const beaconTex = createBeaconSpriteTexture()
  const beaconMat = new T.SpriteMaterial({
    map: beaconTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: false,
    blending: T.AdditiveBlending,
  })
  const beaconSprite = new T.Sprite(beaconMat)
  beaconSprite.renderOrder = 10
  probeAnchor.add(beaconSprite)

  // Historical Milestone Diamonds & Labels
  const milestoneGeo = new T.OctahedronGeometry(1.05, 0)
  const milestoneNodes: NewHorizonsMilestoneNode[] = newHorizonsMilestones.map((m) => {
    const pos = ephemeris.sample(m.year, v3()).pos
    const isHero = m.id === 'pluto' || m.id === 'arrokoth'
    const mat = new T.MeshBasicMaterial({
      color: isHero ? 0xffcf78 : trajectoryColor(m.year, tmpColor).getHex(),
      transparent: true,
      opacity: 0.9,
    })
    const mesh = new T.Mesh(milestoneGeo, mat)
    mesh.position.copy(pos)
    root.add(mesh)
    const labelEl = tag(nhMilestoneShort(m, 'zh'), isHero ? 'star' : 'voyager-ms')
    return { milestone: m, pos, mesh, tag: labelEl }
  })

  const probeTag = tag(pick('新视野号', 'New Horizons'), 'hot nh-probe-tag')

  // Live state
  let currentSample: NewHorizonsSample = ephemeris.sample(NH_PLUTO_YEAR, v3())
  const probePos = currentSample.pos.clone()
  let lastEndpoint = samples

  function setYear(year: number) {
    if (lastEndpoint < samples) {
      curvePts[lastEndpoint].toArray(activePositions, lastEndpoint * 3)
      const shadow = shadowPts[lastEndpoint]
      shadowPositions.setXYZ(lastEndpoint, shadow.x, 0, shadow.z)
      shadowDistances.setX(lastEndpoint, staticDistances[lastEndpoint])
      activeColors.set(colorArray.subarray(lastEndpoint * 3, lastEndpoint * 3 + 3), lastEndpoint * 3)
    }
    currentSample = ephemeris.sample(year, probePos)
    probeAnchor.position.copy(probePos)

    let count = 1
    while (count < samples && sampleYears[count] <= currentSample.year) count++
    const drawPts = Math.min(samples, count)
    lastEndpoint = drawPts

    activePositions[drawPts * 3] = probePos.x
    activePositions[drawPts * 3 + 1] = probePos.y
    activePositions[drawPts * 3 + 2] = probePos.z
    trajectoryColor(currentSample.year, tmpColor)
    activeColors[drawPts * 3] = tmpColor.r
    activeColors[drawPts * 3 + 1] = tmpColor.g
    activeColors[drawPts * 3 + 2] = tmpColor.b
    activePosAttr.needsUpdate = true
    activeColAttr.needsUpdate = true
    activeLineGeo.setDrawRange(0, drawPts + 1)

    if (activeTube) {
      const segs = Math.max(0, drawPts - 1)
      activeTube.geometry.setDrawRange(0, segs * TUBE_RADIAL * 6)
    }

    const previous = shadowPts[drawPts - 1]
    shadowPositions.setXYZ(drawPts, probePos.x, 0, probePos.z)
    shadowDistances.setX(
      drawPts,
      staticDistances[drawPts - 1] + Math.hypot(probePos.x - previous.x, probePos.z - previous.z),
    )
    shadowPositions.needsUpdate = shadowDistances.needsUpdate = true
    shadowGeo.setDrawRange(0, drawPts + 1)

    stemPositions[0] = probePos.x
    stemPositions[1] = probePos.y
    stemPositions[2] = probePos.z
    stemPositions[3] = probePos.x
    stemPositions[4] = 0
    stemPositions[5] = probePos.z
    stemGeo.attributes.position.needsUpdate = true
    stemDistances.setX(1, Math.abs(probePos.y))
    stemDistances.needsUpdate = true
    const hasElevation = Math.abs(probePos.y) > 1.2
    altitudeStem.visible = hasElevation
    footRing.visible = hasElevation
    footRing.position.set(probePos.x, 0, probePos.z)

    for (const node of milestoneNodes) {
      const reached = currentSample.year >= node.milestone.year - 0.03
      const mat = node.mesh.material as T.MeshBasicMaterial
      mat.opacity = reached ? 0.95 : 0.32
    }
  }

  function setVisibility(active: boolean) {
    root.visible = active
  }

  const scanDir = v3()
  const downAxis = v3(0, -1, 0)
  const encTargetQuat = new T.Quaternion()
  const earthQuat = new T.Quaternion()
  const mat4Tmp = new T.Matrix4()
  const rightTmp = v3()
  const upTmp = v3()

  function encounterBody(id: NewHorizonsFlyby | null): World | null {
    if (id === 'jupiter') return jupiter
    if (id === 'pluto') return pluto
    if (id === 'arrokoth') return arrokoth
    return null
  }

  function update(
    camera: T.PerspectiveCamera,
    ambientTime: number,
    pixelRatio: number,
    isProbeView = false,
  ) {
    if (!root.visible) return

    const camDist = camera.position.distanceTo(probePos)
    const encWorld = encounterBody(currentSample.activeEncounter)

    // Attitude control: point 2.1m High-Gain Dish toward Earth during cruise (and in 3D probe inspection);
    // slew science deck (+X LORRI barrel) toward target body during Jupiter / Pluto / Arrokoth encounters!
    spacecraft.lookAt(earth.pos)
    earthQuat.copy(spacecraft.quaternion)
    if (encWorld && !isProbeView) {
      const toTarget = scanDir.subVectors(encWorld.pos, probePos).normalize()
      // Build orthonormal basis where +X points at encounter target (LORRI boresight) and +Z favors Earth
      upTmp.set(0, 1, 0)
      if (Math.abs(toTarget.dot(upTmp)) > 0.96) upTmp.set(1, 0, 0)
      rightTmp.crossVectors(toTarget, upTmp).normalize() // +Z
      upTmp.crossVectors(rightTmp, toTarget).normalize() // +Y
      mat4Tmp.makeBasis(toTarget, upTmp, rightTmp)
      encTargetQuat.setFromRotationMatrix(mat4Tmp)
      // Smooth slew weight peaking at closest approach
      const halfSpan =
        currentSample.activeEncounter === 'jupiter'
          ? 28 * 3600
          : currentSample.activeEncounter === 'pluto'
            ? 35 * 60
            : 12 * 60
      const w = clamp(1 - Math.abs(currentSample.caDeltaSec ?? halfSpan) / halfSpan, 0, 1)
      spacecraft.quaternion.slerpQuaternions(earthQuat, encTargetQuat, w * 0.92)
    }

    // Distance-adaptive holographic beacon crossfade
    const beaconFade = isProbeView ? 0 : clamp((camDist - 18) / 48, 0, 1)
    beaconSprite.visible = beaconFade > 0.01
    const pulse = 1 + 0.09 * Math.sin(ambientTime * 3.2)
    beaconSprite.scale.setScalar(Math.max(2.6, camDist * 0.04) * pulse)
    beaconMat.opacity = beaconFade * 0.92

    // Smart spacecraft scaling:
    // Full 1.0x in dedicated 3D probe close-up, proportional near tiny Arrokoth/Pluto so zero clipping!
    let nearShrink = 1.0
    if (!isProbeView) {
      const distArrokoth = probePos.distanceTo(arrokoth.pos)
      const distPluto = probePos.distanceTo(pluto.pos)
      if (distArrokoth < 5.5) {
        nearShrink = Math.min(nearShrink, clamp(0.42 + (distArrokoth - 1.8) * 0.14, 0.42, 1.0))
      }
      if (distPluto < 6.5) {
        nearShrink = Math.min(nearShrink, clamp(0.58 + (distPluto - 2.2) * 0.1, 0.58, 1.0))
      }
    }
    const baseCraftScale = camDist < 16 ? 1.0 : clamp(1.0 + (camDist - 16) * 0.014, 1.0, 2.5)
    const craftScale = baseCraftScale * (camDist < 22 ? nearShrink : 1.0)
    spacecraft.scale.setScalar(craftScale)

    // LORRI/Ralph volumetric observation scan cone during active encounter close-ups!
    if (encWorld && !isProbeView && camDist < 140) {
      const dist = probePos.distanceTo(encWorld.pos)
      if (dist > encWorld.r * 0.9 && dist < 48) {
        scanCone.visible = true
        scanCone.position.copy(probePos)
        scanDir.subVectors(encWorld.pos, probePos).normalize()
        scanCone.quaternion.setFromUnitVectors(downAxis, scanDir)
        const coneLen = Math.max(0.5, dist - encWorld.r * 0.25)
        const coneRadius = encWorld.r * (currentSample.activeEncounter === 'arrokoth' ? 1.05 : 0.82)
        scanCone.scale.set(coneRadius, coneLen, coneRadius)
        if (scanMat instanceof T.ShaderMaterial) {
          scanMat.uniforms.uTime.value = ambientTime
          scanMat.uniforms.uOpacity.value = clamp(1 - camDist / 135, 0.22, 0.72)
          scanMat.uniforms.uColor.value.setHex(
            currentSample.activeEncounter === 'arrokoth'
              ? 0xffb874
              : currentSample.activeEncounter === 'pluto'
                ? 0x76eeff
                : 0xffd078,
          )
        }
      } else {
        scanCone.visible = false
      }
    } else {
      scanCone.visible = false
    }

    // Keep close-up view clean
    const hideLines = camDist < 10
    activeLine.visible = !hideLines
    fullRefLine.visible = camDist > 12
    altitudeStem.visible = camDist > 16 && Math.abs(probePos.y) > 1.2
    footRing.visible = altitudeStem.visible

    if (activeTube && activeTubeMat) {
      activeTube.visible = camDist > 11
      activeTubeMat.opacity = clamp((camDist - 9) / 26, 0.05, 0.34)
    }

    // Spin milestone diamonds and hide any diamond overlapping the spacecraft up close
    for (const node of milestoneNodes) {
      node.mesh.rotation.y = ambientTime * 0.9
      const d = camera.position.distanceTo(node.pos)
      const nearProbe = node.pos.distanceTo(probePos) < 4.5 && camDist < 42
      node.mesh.visible = !nearProbe && d > 15
      const s = clamp(d * 0.0042, 0.45, 2.1)
      const reached = currentSample.year >= node.milestone.year - 0.03
      node.mesh.scale.setScalar(s * (reached ? 1.0 : 0.65))
    }

    // Earth -> New Horizons light-speed radio communication beam & flowing photon pulses
    radioPositions[0] = earth.pos.x
    radioPositions[1] = earth.pos.y
    radioPositions[2] = earth.pos.z
    radioPositions[3] = probePos.x
    radioPositions[4] = probePos.y
    radioPositions[5] = probePos.z
    radioGeo.attributes.position.needsUpdate = true

    const beamDist = earth.pos.distanceTo(probePos)
    const showBeam = beamDist > 6 && camDist > 16 && !encWorld
    radioBeam.visible = showBeam
    radioPulses.visible = showBeam
    if (showBeam) {
      if (pulseMat instanceof T.ShaderMaterial) {
        pulseMat.uniforms.uPixelRatio.value = pixelRatio
      }
      // Common 4 light-hours/sec reference clock matching Voyager!
      const flowRate = 4 / Math.max(0.8, currentSample.lightHours)
      for (let i = 0; i < PULSE_COUNT; i++) {
        const t = ((i / PULSE_COUNT + ambientTime * flowRate) % 1 + 1) % 1
        pulsePositions[i * 3] = earth.pos.x + (probePos.x - earth.pos.x) * t
        pulsePositions[i * 3 + 1] = earth.pos.y + (probePos.y - earth.pos.y) * t
        pulsePositions[i * 3 + 2] = earth.pos.z + (probePos.z - earth.pos.z) * t
        pulseAlphas[i] = Math.sin(t * Math.PI)
      }
      pulseGeo.attributes.position.needsUpdate = true
      pulseGeo.attributes.aAlpha.needsUpdate = true
    }
  }

  function collectLabels(
    project: Project,
    width: number,
    height: number,
    markers: Label[],
    activeMilestoneId: string,
    lang: Locale,
    hideProbeLabel = false,
    showMilestones = true,
  ) {
    if (!root.visible) return

    const pq = project(probePos)
    if (!hideProbeLabel && pq && pq.x > 10 && pq.x < width - 10 && pq.y > 10 && pq.y < height - 10) {
      const labelText = pick('新视野号', 'New Horizons', lang)
      if (probeTag.textContent !== labelText) probeTag.textContent = labelText
      markers.unshift({ el: probeTag, q: pq, r: 10 })
    }

    if (!showMilestones) return

    for (const node of milestoneNodes) {
      const q = project(node.pos)
      if (!q || q.x < 10 || q.x > width - 10 || q.y < 10 || q.y > height - 10) continue
      if (
        (hideProbeLabel && node.pos.distanceTo(probePos) < 5) ||
        (pq && Math.hypot(q.x - pq.x, q.y - pq.y) < 28)
      )
        continue
      const isActive = node.milestone.id === activeMilestoneId
      node.tag.classList.toggle('is-active', isActive)
      markers.push({ el: node.tag, q, r: 6 })
    }

    const fq = project(fiftyLandmark)
    if (fq && fq.x > 16 && fq.x < width - 16 && fq.y > 16 && fq.y < height - 16) {
      markers.push({ el: fiftyLabel, q: fq, r: 4 })
    }
  }

  function pickAt(
    x: number,
    y: number,
    project: Project,
  ): { kind: 'probe' } | { kind: 'milestone'; milestone: NewHorizonsMilestone } | null {
    if (!root.visible) return null
    const pq = project(probePos)
    if (pq && Math.hypot(x - pq.x, y - pq.y) < 18) {
      return { kind: 'probe' }
    }
    for (const node of milestoneNodes) {
      if (!node.mesh.visible) continue
      const q = project(node.pos)
      if (q && Math.hypot(x - q.x, y - q.y) < 15) {
        return { kind: 'milestone', milestone: node.milestone }
      }
    }
    return null
  }

  function draw2D(ctx: CanvasRenderingContext2D, project: Project) {
    if (!root.visible) return
    ctx.save()

    // 50 AU Kuiper Cliff dashed ring
    ctx.strokeStyle = 'rgba(106, 230, 212, 0.28)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    const fAttr = fiftyRing.geometry.attributes.position
    const tmpP = v3()
    let started = false
    for (let i = 0; i < fAttr.count; i++) {
      const q = project(tmpP.fromBufferAttribute(fAttr, i))
      if (q && started) ctx.lineTo(q.x, q.y)
      else if (q) ctx.moveTo(q.x, q.y)
      started = !!q
    }
    ctx.stroke()

    if (fullRefLine.visible) {
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(118, 184, 232, 0.34)'
      ctx.beginPath()
      started = false
      for (const point of curvePts) {
        const q = project(point)
        if (q && started) ctx.lineTo(q.x, q.y)
        else if (q) ctx.moveTo(q.x, q.y)
        started = !!q
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    const drawCount = activeLineGeo.drawRange.count
    ctx.lineWidth = 2.2
    ctx.globalAlpha = 0.94
    let prev: ScreenPoint | null = null
    for (let i = 0; activeLine.visible && i < drawCount; i++) {
      const q = project(tmpP.fromArray(activePositions, i * 3))
      if (prev && q) {
        ctx.strokeStyle = tmpColor.fromArray(activeColors, i * 3).getStyle()
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(q.x, q.y)
        ctx.stroke()
      }
      prev = q
    }
    ctx.globalAlpha = 1

    // Radio beam & pulses
    const eq = project(earth.pos)
    const pq = project(probePos)
    if (radioBeam.visible && eq && pq) {
      ctx.strokeStyle = 'rgba(112, 228, 255, 0.34)'
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(eq.x, eq.y)
      ctx.lineTo(pq.x, pq.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#b9f9ff'
      for (let i = 0; i < PULSE_COUNT && radioPulses.visible; i++) {
        const pulse = project(tmpP.fromArray(pulsePositions, i * 3))
        if (pulse) ctx.fillRect(pulse.x, pulse.y, 2, 2)
      }
    }

    // Milestone diamonds
    for (const node of milestoneNodes) {
      if (!node.mesh.visible) continue
      const q = project(node.pos)
      if (!q) continue
      const mat = node.mesh.material as T.MeshBasicMaterial
      ctx.globalAlpha = mat.opacity
      ctx.fillStyle = mat.color.getStyle()
      ctx.beginPath()
      ctx.moveTo(q.x, q.y - 3.5)
      ctx.lineTo(q.x + 3.5, q.y)
      ctx.lineTo(q.x, q.y + 3.5)
      ctx.lineTo(q.x - 3.5, q.y)
      ctx.fill()
    }
    ctx.restore()
  }

  function drawProbe2D(ctx: CanvasRenderingContext2D, project: Project, q: ScreenPoint) {
    ctx.save()
    if (q.z < 26) drawCanvasSpacecraft(ctx, project, spacecraft)
    else {
      ctx.fillStyle = '#ffd07c'
      ctx.beginPath()
      ctx.arc(q.x, q.y, 4.4, 0, tau)
      ctx.fill()
      ctx.strokeStyle = 'rgba(116, 238, 255, 0.88)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(q.x, q.y, 9, 0, tau)
      ctx.stroke()
    }
    ctx.restore()
  }

  function milestoneMapLabel(m: NewHorizonsMilestone, lang: Locale) {
    if (m.id === 'pluto') return pick('冥王星飞掠', 'Pluto flyby', lang)
    if (m.id === 'arrokoth') return pick('阿罗科斯飞掠', 'Arrokoth flyby', lang)
    return nhMilestoneShort(m, lang)
  }

  function refreshLabels(lang: Locale) {
    probeTag.textContent = pick('新视野号', 'New Horizons', lang)
    fiftyLabel.textContent = pick('50 AU · 柯伊伯带外缘', '50 AU · Kuiper Cliff', lang)
    for (const node of milestoneNodes) {
      node.tag.textContent = milestoneMapLabel(node.milestone, lang)
    }
  }

  function dispose() {
    const geometries = new Set<T.BufferGeometry>()
    const materials = new Set<T.Material>()
    root.traverse((node) => {
      if (node instanceof T.Line || node instanceof T.Mesh || node instanceof T.Points || node instanceof T.Sprite) {
        geometries.add(node.geometry)
        if (Array.isArray(node.material)) node.material.forEach((m) => materials.add(m))
        else materials.add(node.material)
      }
    })
    for (const g of geometries) g.dispose()
    for (const m of materials) m.dispose()
    beaconTex.dispose()
    scene.remove(root)
    probeTag.remove()
    fiftyLabel.remove()
    for (const n of milestoneNodes) n.tag.remove()
  }

  refreshLabels('zh')
  setYear(NH_PLUTO_YEAR)

  return {
    root,
    ephemeris,
    probePos,
    milestoneNodes,
    getSample: () => currentSample,
    setYear,
    setVisibility,
    update,
    collectLabels,
    pickAt,
    draw2D,
    drawProbe2D,
    refreshLabels,
    dispose,
  }
}

function drawCanvasSpacecraft(ctx: CanvasRenderingContext2D, project: Project, craft: T.Group) {
  const faces: { pts: ScreenPoint[]; depth: number; color: string }[] = []
  const point = v3()
  const color = new T.Color()
  craft.traverse((node) => {
    if (!(node instanceof T.Mesh)) return
    const vertices = node.geometry.attributes.position
    const screen = Array.from({ length: vertices.count }, (_, i) =>
      project(point.fromBufferAttribute(vertices, i).applyMatrix4(node.matrixWorld)),
    )
    const indices = node.geometry.index
    const count = indices?.count ?? vertices.count
    const matColor = (node.material as T.MeshPhongMaterial).color ?? new T.Color(0xe8c474)
    for (let i = 0; i < count; i += 3) {
      const a = screen[indices ? indices.getX(i) : i]
      const b = screen[indices ? indices.getX(i + 1) : i + 1]
      const c = screen[indices ? indices.getX(i + 2) : i + 2]
      if (!a || !b || !c) continue
      const shade = 0.65 + 0.35 * Math.abs((b.x - a.x) / (Math.hypot(b.x - a.x, b.y - a.y) || 1))
      faces.push({
        pts: [a, b, c],
        depth: a.z + b.z + c.z,
        color: color.copy(matColor).multiplyScalar(shade).getStyle(),
      })
    }
  })
  faces.sort((a, b) => b.depth - a.depth)
  ctx.lineWidth = 0.5
  ctx.setLineDash([])
  for (const { pts: [a, b, c], color: style } of faces) {
    ctx.fillStyle = ctx.strokeStyle = style
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}
