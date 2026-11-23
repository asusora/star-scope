import * as T from 'three'
import { landscape, landscapeRegion, type Landscape } from './landing/landscape'
import { createExcursion } from './landing/excursion'
import { formatNum, groupLabel, locale, pick, regionLabel, type Locale } from '../i18n'
import {
  galaxyNotesEn,
  moonLabel,
  moonNumberName,
  solarNotesEn,
  worldName,
  worldSummary,
} from '../i18n/catalogEn'
import { localizedEntry } from '../i18n/archiveLocale'
import { comets } from '../data/comets'
import { cometProfile } from '../data/cometProfiles'
import { createCometModel } from './cometModel'
import { sources, thumbs } from '../data/assets'
import { createSolarSystem } from '../data/solar'
import { createPlanetDetail, type PlanetBody } from './planetDetail'
import { createPlanetCanvas } from './planetCanvas'
import { createSolarModels } from './solarModels'
import { createTextureUploads } from './textureUploads'
import { createLabels } from './labels'
import { createArchive, jplFacts, moonSources } from '../data/archive'
import { trappistEntryId, trappistPaper } from '../data/trappist'
import { createDeepModels, galaxyForms, planetarySystems } from './deepModels'
import { createDeepCanvasRenderer } from './deepCanvas'
import { createVoyagerBoundaries, createVoyagerModel } from './voyagerModel'
import { createOortBoundaries } from './oortBoundary'
import {
  NH_ARROKOTH_YEAR,
  NH_END_YEAR,
  NH_JUPITER_YEAR,
  NH_PLUTO_YEAR,
  NH_START_YEAR,
  newHorizonsMilestones,
  newHorizonsPlaybackRate,
  nhMilestoneBody,
  nhMilestoneShort,
  nhMilestoneTitle,
  type NewHorizonsMilestoneId,
  type NewHorizonsView,
} from '../data/newHorizons'
import type { createNewHorizonsModel } from './newHorizonsModel'
import { createPhenomenaModel } from './phenomenaModel'
import {
  computePhenomenonStats,
  getPhenomenon,
  nearestPhenomenonMilestone,
  phenomenonMilestoneBody,
  phenomenonMilestoneTitle,
  phenomenonName,
  phenomenonPlaybackRate,
} from '../data/phenomena'
import {
  VOYAGER_END_YEAR,
  VOYAGER_START_YEAR,
  createRadialMapper,
  milestoneBody,
  milestoneShort,
  milestoneTitle,
  missionMilestones,
  missionStart,
  missionName,
  voyagerIds,
  voyagerPlaybackRate,
} from '../data/voyager'
import type { DeepModel } from './deepTypes'
import { rad, tau, v3, seeded, clamp, orbit, orbitalPosition, skyDirection } from './math'
import {
  Moon,
  World,
  type Label,
  type Note,
  type StageElements,
  type SceneUI,
  type ArchiveEntry,
  type Belt,
  type OrbitPath,
  type ScreenPoint,
  type OrbitMode,
  type VoyagerView,
  type VoyagerMode,
  type VoyagerId,
  type PhenomenonId,
} from './types'
type Point = { x: number; y: number }
type Transition = {
  t: number
  origin: T.Vector3
  from: number
  to: number
  yaw: number
  delta: number
  pitch: number
  endPitch: number
}
export function createAtlas({ canvas, stage, tags, pins }: StageElements, ui: SceneUI) {
  let disposed = false
  const listeners = new AbortController()
  const solarSystem = createSolarSystem()
  const {
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
  } = solarSystem
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(45, 1, 0.012, 18000)
  let renderer: T.WebGLRenderer | null = null
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    console.info('Using the Canvas perspective renderer.', error)
  }
  const softwareContext = renderer ? null : canvas.getContext('2d')
  if (!renderer && !softwareContext)
    throw new Error(
      pick('浏览器无法创建绘图上下文。', 'This browser cannot create a graphics context.'),
    )
  const ctx = softwareContext!
  const textures: Record<string, T.Texture | null> = {}
  const images: Record<string, HTMLImageElement> = {}
  for (const [id, url] of Object.entries(sources)) {
    if (!renderer) {
      textures[id] = null
      continue
    }
    const texture = new T.Texture()
    texture.colorSpace = id === 'Clouds' ? T.NoColorSpace : T.SRGBColorSpace
    if (id === 'Sun') {
      texture.wrapS = T.RepeatWrapping
      texture.wrapT = T.ClampToEdgeWrapping
    }
    textures[id] = texture
    if (id === 'Sky' || id === 'Galaxy') continue
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const ready = () => {
      if (disposed) return
      texture.image = image
      texture.needsUpdate = true
      requestDraw()
    }
    image.onload = () => {
      if (image.decode) image.decode().then(ready, ready)
      else ready()
    }
    image.src = url
  }
  if (softwareContext) {
    for (const [id, url] of Object.entries(thumbs)) {
      const image = new Image()
      image.onload = requestDraw
      image.src = url
      images[id] = image
    }
  }
  if (renderer) {
    renderer.outputColorSpace = T.SRGBColorSpace
    const setBackground = () => renderer?.setClearColor(0x040710)
    setBackground()
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        setBackground()
        if (renderer) bakeCosmicSky(renderer)
        requestDraw()
      },
      { signal: listeners.signal },
    )
  }
  const { tag, placeLabels, placeText, shownLabels, textPositions } = createLabels(tags)
  const {
    sun,
    sunGlow,
    stars,
    parallaxStars,
    shootingStars,
    belt,
    beltDust,
    hildaDust,
    trojanDust,
    centaurDust,
    neptuneTrojanDust,
    kuiperDust,
    scatteredDust,
    oortDust,
    outerOortDust,
    setBeltsVisible,
    updateBeltVisibility,
    skyDome,
    createCosmicSkyMaterial,
    bakeCosmicSky,
    updateSpaceTime,
    setSkyTexture,
    sphere,
    orbitLayer,
    orbitColors,
    planetDiscs,
    pathFor,
    modelStep,
    modelStepAtEpoch,
    updateMinorMoons,
    updateVisibleMinorMoons,
    syncMinorInstance,
    disposeSolarExtras,
  } = createSolarModels(scene, !!renderer, textures, solarSystem, tag, requestDraw)
  const { auToScene } = createRadialMapper(planets, mapOuterAU)
  const cometLayer = new T.Group()
  scene.add(cometLayer)
  const cometOrbitLayer = new T.Group()
  scene.add(cometOrbitLayer)
  const cometTracks = comets.map((comet) => {
    const elements = orbit(comet.a, comet.e, comet.i, comet.node, comet.peri)
    const body = createCometModel(comet, elements, auToScene, !!renderer)
    cometOrbitLayer.add(body.orbitGroup)
    cometLayer.add(body.root)
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'tag comet-name'
    pins.append(el)
    el.addEventListener('click', () => openComet(comet.id), { signal: listeners.signal })
    el.style.color = '#' + new T.Color(comet.color).getHexString()
    return { comet, el, body }
  })
  let focusComet: (typeof cometTracks)[number] | null = null
  let hoveredCometTrack: (typeof cometTracks)[number] | null = null
  const tracks = {
    v1: createVoyagerModel(scene, !!renderer, planets, mapOuterAU, tag, 'v1'),
    v2: createVoyagerModel(scene, !!renderer, planets, mapOuterAU, tag, 'v2'),
  }
  const boundaries = createVoyagerBoundaries(scene, !!renderer, tracks, tag)
  const oortBoundaries = createOortBoundaries(scene, !!renderer, outerOortBand, tag, pins, () => {
    const entry = catalogEntries.find((e) => e.id === 'proxima')
    if (entry) openDeepTarget(entry)
  })
  oortBoundaries.refreshLabels(locale.value)
  const phenomena = createPhenomenaModel(scene, !!renderer, worlds, planets, mapOuterAU, tag)
  const earth = planets.find(p => p.id === 'Earth')!
  const jupiter = planets.find(p => p.id === 'Jupiter')!
  const pluto = worlds.find(p => p.id === 'Pluto')!
  const arrokoth = worlds.find(p => p.id === 'Arrokoth')!
  const focusedTrack = () => tracks[ui.voyagerFocus]
  function syncVoyagerVisibility() {
    for (const id of voyagerIds) {
      const selected = ui.voyagerMode === 'both' || ui.voyagerMode === id
      tracks[id].setVisibility(
        voyagerMode && selected,
        !voyagerMode && !phenomenaMode && !newHorizonsMode && voyagerOverlay,
        galaxyView || !!deepTarget,
      )
    }
    boundaries.setVisibility(voyagerMode && !galaxyView && !deepTarget, ui.voyagerMode)
    newHorizons?.setVisibility(newHorizonsMode && !galaxyView && !deepTarget)
  }
  function updateVoyagers() {
    boundaries.update(camera, ambientTime)
    for (const id of voyagerIds) tracks[id].update(camera, ambientTime, pixelRatio)
    newHorizons?.update(camera, ambientTime, pixelRatio, nhView === 'probe')
  }
  function voyagerHitAt(x: number, y: number) {
    return tracks.v1.pickAt(x, y, project) ?? tracks.v2.pickAt(x, y, project)
  }
  function newHorizonsHitAt(x: number, y: number) {
    return newHorizonsMode && newHorizons ? newHorizons.pickAt(x, y, project) : null
  }
  const loadTexture = renderer ? createTextureUploads(renderer) : null
  const detail = createPlanetDetail(renderer, scene, requestDraw, loadTexture)
  const drawPlanet = softwareContext ? createPlanetCanvas() : null
  const bodyByWorld = new Map<World, PlanetBody>()
  const bodyByMoon = new Map<Moon, PlanetBody>()
  const detailBodies: { body: PlanetBody; host: World }[] = []
  for (const p of worlds) {
    bodyByWorld.set(p, p)
    detailBodies.push({ body: p, host: p })
    for (const m of p.moons) {
      if (!m.mesh) continue
      const moonBody: PlanetBody = {
        id: m.name,
        pos: m.world,
        r: m.r,
        mesh: m.mesh,
        atmosphere: m.atmosphere,
        parentId: p.id,
        semiMajorKm: m.a,
      }
      bodyByMoon.set(m, moonBody)
      detailBodies.push({ body: moonBody, host: p })
    }
  }
  const minorDummyMesh = new T.Mesh()
  let activeMinorBody: PlanetBody | null = null
  let nearBody: PlanetBody | null = null
  function getMinorDetailBody(m: Moon): PlanetBody {
    if (activeMinorBody?.minorMoon === m) return activeMinorBody
    activeMinorBody = {
      id: m.name,
      pos: m.world,
      r: m.r,
      mesh: minorDummyMesh,
      parentId: m.parent.id,
      semiMajorKm: m.a,
      minorMoon: m,
    }
    return activeMinorBody
  }
  function updateSurfaceDetail() {
    let largest = 0
    const nhPreferredWorld = newHorizonsMode
      ? nhView === 'pluto'
        ? pluto
        : nhView === 'arrokoth'
          ? arrokoth
          : nhView === 'jupiter'
            ? jupiter
            : null
      : null
    const preferredBody = focusMoon
      ? (bodyByMoon.get(focusMoon) ?? getMinorDetailBody(focusMoon))
      : focusPlanet
        ? (bodyByWorld.get(focusPlanet) ?? null)
        : nhPreferredWorld
          ? (bodyByWorld.get(nhPreferredWorld) ?? null)
          : null
    let next: PlanetBody | null = null
    if (!galaxyView && !deepTarget) {
      if (preferredBody?.minorMoon && preferredBody.minorMoon.parent.anchor.visible) {
        const q = project(preferredBody.pos)
        if (q) {
          const size = q.scale * preferredBody.r
          if (
            size >= (preferredBody === nearBody ? 6 : 9) &&
            q.x + size >= 0 &&
            q.y + size >= 0 &&
            q.x - size <= width &&
            q.y - size <= height
          ) {
            next = preferredBody
          }
        }
      }
      if (!next) {
        for (const { body, host } of detailBodies) {
          if (!host.anchor.visible) continue
          const q = project(body.pos)
          if (!q) continue
          const size = q.scale * body.r
          const threshold = body === preferredBody ? 10 : body === nearBody ? 18 : 24
          if (
            size < threshold ||
            q.x + size < 0 ||
            q.y + size < 0 ||
            q.x - size > width ||
            q.y - size > height
          )
            continue
          if (body === preferredBody) {
            next = body
            break
          }
          if (size > largest) {
            largest = size
            next = body
          }
        }
      }
    }
    if (next !== nearBody) {
      const prevMinor = nearBody?.minorMoon
      nearBody = next
      detail.select(next)
      if (prevMinor) syncMinorInstance(prevMinor)
      if (next?.minorMoon) syncMinorInstance(next.minorMoon)
    }
    detail.update(clock)
  }
  function updateOrbitMasks() {
    if (!renderer) return
    for (const [i, p] of planets.entries()) {
      const q = project(p.pos),
        disc = planetDiscs[i]
      if (q)
        disc.set(q.x * pixelRatio, (height - q.y) * pixelRatio, (q.scale * p.r + 1) * pixelRatio)
      else disc.z = -1
    }
  }
  let galaxyView = false,
    voyagerMode = false,
    newHorizonsMode = false,
    phenomenaMode = false,
    phenomenonId: PhenomenonId = ui.phenomenonId,
    phenomenonYear = ui.phenomenonYear,
    phenomenonView = ui.phenomenonView,
    voyagerOverlay = ui.voyagerOverlay,
    voyagerYear = ui.voyagerYear,
    voyagerView: VoyagerView = ui.voyagerView,
    voyagerMilestoneId = ui.voyagerMilestone,
    voyagerCustomDistance: number | null = null,
    nhYear = ui.newHorizonsYear,
    nhView: NewHorizonsView = ui.newHorizonsView,
    nhMilestoneId: NewHorizonsMilestoneId = ui.newHorizonsMilestone,
    nhCustomDistance: number | null = null,
    focusPlanet: World | null = null,
    focusMoon: Moon | null = null,
    focusRegion: Belt | null = null,
    smallVisible = false,
    clock = 0,
    playing = ui.playing,
    speed = 1
  const endPoints = { v1: tracks.v1.probePos.clone(), v2: tracks.v2.probePos.clone() }
  const voyagerCenter = v3()
  const voyagerFlybyCenter = v3(-48, 8, -18)
  const nhCenter = v3()
  const nhEndPoint = v3()
  const phenomenaAnchor = v3()
  let voyagerPanel: HTMLElement | null = null
  let phenomenaPanel: HTMLElement | null = null
  let newHorizonsPanel: HTMLElement | null = null
  let newHorizons: ReturnType<typeof createNewHorizonsModel> | null = null
  let newHorizonsRequest = 0
  let deepTarget: DeepModel | null = null
  let orbitMode: OrbitMode = 'smart',
    showNames = true,
    dirty = true,
    width = 0,
    height = 0,
    pixelRatio = 1,
    fit = 180
  let yaw = 0.13,
    pitch = 0.4,
    zoom = 180,
    transition: Transition | null = null
  let hoveredBody: World | Moon | typeof sun | null = null,
    nearbyHost: World | null = null,
    highlightedMoon: Moon | null = null
  const fadingPaths = new Map<OrbitPath, { from: number; start: number }>(),
    orbitMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const target = v3(),
    eye = v3(),
    temp = v3(),
    viewPos = v3(),
    toCenter = v3()
  const panOffset = v3(),
    regionCenter = v3(),
    followCenter = v3()
  const selectedTag = tag('', 'hot')
  function baseCenter() {
    if (deepTarget) return deepCenter()
    if (newHorizonsMode && newHorizons) {
      if (nhView === 'probe') return newHorizons.probePos
      if (nhView === 'jupiter') return nhCenter.copy(jupiter.pos).lerp(newHorizons.probePos, 0.36)
      if (nhView === 'pluto') return nhCenter.copy(pluto.pos).lerp(newHorizons.probePos, 0.42)
      if (nhView === 'arrokoth') return nhCenter.copy(arrokoth.pos).lerp(newHorizons.probePos, 0.44)
      return nhCenter.copy(nhEndPoint).multiplyScalar(0.45)
    }
    if (phenomenaMode) return phenomena.getCameraAnchor(phenomenonId, phenomenonView, phenomenaAnchor)
    if (voyagerMode) {
      if (voyagerView === 'probe') return focusedTrack().probePos
      if (voyagerView === 'flyby') return ui.voyagerMode === 'v1' ? voyagerFlybyCenter : voyagerCenter.set(0, 0, 30)
      if (ui.voyagerMode === 'both') voyagerCenter.addVectors(endPoints.v1, endPoints.v2).multiplyScalar(0.2)
      else voyagerCenter.copy(endPoints[ui.voyagerMode]).multiplyScalar(0.34)
      if (voyagerView === 'top') voyagerCenter.y = 0
      return voyagerCenter
    }
    if (focusComet) return focusComet.body.root.position
    return focusMoon
      ? focusMoon.world
      : focusPlanet
        ? focusPlanet.pos
        : focusRegion
          ? regionCenter
          : sun.pos
  }
  function selectedCenter() {
    return followCenter.copy(baseCenter()).add(panOffset)
  }
  function fullSystemDistance() {
    return (
      scatteredBand.outer *
      1.03 *
      Math.max(1.85, Math.sqrt(1 + 1 / (camera.aspect * 0.4142) ** 2) * 1.04)
    )
  }
  function defaultDistance() {
    if (deepTarget) return deepDistance()
    const narrow = Math.max(1, 1.2 / camera.aspect)
    if (newHorizonsMode && newHorizons) {
      if (nhCustomDistance !== null) return nhCustomDistance * narrow
      if (nhView === 'probe') return 4.6 * narrow
      if (nhView === 'jupiter') return jupiter.extent * 2.45 * narrow
      if (nhView === 'pluto') return pluto.extent * 2.15 * narrow
      if (nhView === 'arrokoth') return 6.2 * narrow
      return newHorizons.ephemeris.mapper.auToScene(66.5) * 2.08 * narrow
    }
    if (galaxyView)
      return Math.max(424, 196 * Math.sqrt(1 + 1 / (camera.aspect * 0.4142) ** 2) * 1.06)
    if (phenomenaMode) {
      return phenomena.getCameraFraming(phenomenonId, phenomenonView, camera.aspect, width < 600).distance
    }
    if (voyagerMode) {
      if (voyagerCustomDistance !== null) return voyagerCustomDistance * narrow
      const { oneLightDayR: rLD, saturnOrbitR, neptuneOrbitR } = tracks.v1.ephemeris.mapper
      if (voyagerView === 'probe') return 8.2 * narrow
      if (voyagerView === 'flyby') return (ui.voyagerMode === 'v1' ? saturnOrbitR : neptuneOrbitR) * 2.45 * narrow
      if (voyagerView === 'climb') return rLD * (ui.voyagerMode === 'both' ? 2.5 : 2.15) * narrow
      if (voyagerView === 'top') return rLD * 2.28 * narrow
      return rLD * 2.48 * narrow
    }
    if (focusComet) return 21 * narrow
    if (focusMoon) return Math.max(0.24, focusMoon.r * 5.8) * narrow
    if (focusPlanet) {
      const p = focusPlanet
      if (!p.moons.length) return p.r * 5.7 * narrow
      return p.extent * 2.85 * narrow
    }
    if (focusRegion) {
      if (focusRegion === 'oort') {
        const halfFov = Math.atan(Math.tan(camera.fov * rad / 2) * Math.min(1, camera.aspect))
        return (outerOortBand.outer * 1.18) / Math.sin(halfFov)
      }
      const distByRegion: Record<Exclude<Belt, 'oort'>, number> = {
        main: 64,
        trojan: 72,
        centaur: 88,
        outer: 132,
        scattered: 225,
      }
      return distByRegion[focusRegion] * narrow
    }
    if (orbitMode === 'all') {
      const halfFov = Math.atan(Math.tan(camera.fov * rad / 2) * Math.min(1, camera.aspect))
      return (allOrbitsOuter * 1.03) / Math.sin(halfFov)
    }
    return fullSystemDistance()
  }
  function defaultAngles() {
    if (deepTarget) return deepAngles()
    if (newHorizonsMode && newHorizons) {
      if (nhView === 'probe') {
        const p = newHorizons.probePos
        if (nhCustomDistance !== null) {
          return [Math.atan2(-p.x, -p.z) + 0.85, 0.24]
        }
        const toEarth = v3().subVectors(earth.pos, p).normalize()
        const right = v3().crossVectors(v3(0, 1, 0), toEarth).normalize()
        const up = v3().crossVectors(toEarth, right)
        const angle = toEarth
          .multiplyScalar(0.58)
          .addScaledVector(right, 0.74)
          .addScaledVector(up, 0.28)
          .normalize()
        return [Math.atan2(angle.x, angle.z), Math.asin(angle.y)]
      }
      if (nhView === 'jupiter') return [Math.atan2(-jupiter.pos.x, -jupiter.pos.z) + 0.74, 0.26]
      if (nhView === 'pluto') return [Math.atan2(-pluto.pos.x, -pluto.pos.z) + 0.56, 0.27]
      if (nhView === 'arrokoth') return [Math.atan2(-arrokoth.pos.x, -arrokoth.pos.z) + 0.6, 0.24]
      return [0.36, width < 600 ? 0.68 : 0.5]
    }
    if (galaxyView) return [0.2, 0.92]
    if (phenomenaMode) {
      const f = phenomena.getCameraFraming(phenomenonId, phenomenonView, camera.aspect, width < 600)
      return [f.yaw, f.pitch]
    }
    if (voyagerMode) {
      if (voyagerView === 'probe') {
        const p = focusedTrack().probePos
        // Front 3/4 hero angle on the dish-facing (Earthward) side so dish, bus, Golden Record & booms shine
        if (voyagerCustomDistance !== null) {
          // Look across the encounter rather than through the enlarged planet.
          return [Math.atan2(-p.x, -p.z) + 0.9, 0.24]
        }
        const toEarth = v3().subVectors(earth.pos, p).normalize()
        const right = v3().crossVectors(v3(0, 1, 0), toEarth).normalize()
        const up = v3().crossVectors(toEarth, right)
        const angle = toEarth.multiplyScalar(0.55).addScaledVector(right, -0.8).addScaledVector(up, 0.23).normalize()
        return [Math.atan2(angle.x, angle.z), Math.asin(angle.y)]
      }
      if (voyagerView === 'flyby') return [0.42, 0.56]
      if (voyagerView === 'climb') return [1.48, 0.055]
      if (voyagerView === 'top') return [0.16, 1.46]
      return [1.14, width < 600 ? 0.52 : 0.36]
    }
    if (focusComet) {
      const p = focusComet.body.root.position
      return [Math.atan2(p.x, p.z) + 1.24, 0.24]
    }
    if (focusRegion === 'oort') return [0.32, width < 600 ? 0.54 : 0.44]
    if (!focusPlanet) return [0.13, width < 600 ? 0.83 : 0.53]
    const p = focusPlanet
    return [Math.atan2(-p.pos.x, -p.pos.z) + 0.66, focusMoon ? 0.23 : 0.31]
  }
  function cameraLimits(): [number, number] {
    if (deepTarget) return deepLimits()
    const outerMax = Math.max(4600, outerOortBand.outer * 4.6)
    if (newHorizonsMode) return [1.6, Math.max(2200, fullSystemDistance() * 4.2)]
    if (galaxyView) return [88, Math.max(1100, defaultDistance() * 2)]
    if (phenomenaMode) return [2.6, Math.max(2200, fullSystemDistance() * 4.2)]
    if (voyagerMode) return [2.1, Math.max(2400, fullSystemDistance() * 4.5)]
    if (focusComet) {
      return [Math.max(2.1, focusComet.body.nucleusRadius * 3.0), outerMax]
    }
    const size = focusMoon ? focusMoon.r : focusPlanet ? focusPlanet.r : 0.12
    return [Math.max(0.032, size * 1.55), outerMax]
  }
  let zoomTarget: number | null = null
  let pendingZoomPoint: Point | null = null
  const zoomAnchor = v3()
  function aim(animate = true, keepDirection = false) {
    zoomTarget = null
    panOffset.set(0, 0, 0)
    const [newYaw, newPitch] = keepDirection ? [yaw, pitch] : defaultAngles()
    fit = defaultDistance()
    const delta = Math.atan2(Math.sin(newYaw - yaw), Math.cos(newYaw - yaw))
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      transition = {
        t: performance.now(),
        origin: target.clone(),
        from: zoom,
        to: fit,
        yaw,
        delta,
        pitch,
        endPitch: newPitch,
      }
    } else {
      transition = null
      target.copy(selectedCenter())
      zoom = fit
      yaw = newYaw
      pitch = newPitch
    }
    dirty = true
  }
  function moveCamera(now: number) {
    if (transition) {
      const f = clamp((now - transition.t) / 940, 0, 1),
        k = f * f * f * (f * (f * 6 - 15) + 10),
        s = transition
      target.lerpVectors(s.origin, selectedCenter(), k)
      zoom = Math.exp(Math.log(s.from) * (1 - k) + Math.log(s.to) * k)
      yaw = s.yaw + s.delta * k
      pitch = s.pitch + (s.endPitch - s.pitch) * k
      if (f >= 1) transition = null
    } else target.copy(selectedCenter())
    eye.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    camera.position.copy(target).addScaledVector(eye, zoom)
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    camera.rotateZ(
      deepTarget
        ? deepTarget.form?.roll || 0
        : voyagerMode || newHorizonsMode || phenomenaMode || focusPlanet
          ? -0.02
          : -0.105,
    )
    camera.updateMatrixWorld()
    skyDome.position.copy(camera.position)
    stars.position.copy(camera.position)
    shootingStars.position.copy(camera.position)
  }
  function updateProjection() {
    const hasConsole = voyagerMode || phenomenaMode || newHorizonsMode
    const offset = deepTarget
      ? height * (width < 700 ? 0.045 : 0.025)
      : hasConsole
        ? height * (width < 700 ? 0.22 : 0.028)
        : focusPlanet || focusComet
          ? 0
          : height * (galaxyView ? 0.037 : width < 600 ? 0.025 : 0.112)
    const shift = hasConsole && !deepTarget && width >= 700 ? -Math.min(width * 0.14, 195) : 0
    camera.setViewOffset(width, height, shift, offset, width, height)
  }
  const canvasRect = { left: 0, top: 0 }
  function updateCanvasRect() {
    const box = canvas.getBoundingClientRect()
    canvasRect.left = box.left
    canvasRect.top = box.top
  }
  function resize() {
    const box = stage.getBoundingClientRect()
    const w = Math.max(1, Math.round(box.width))
    const h = Math.max(1, Math.round(box.height))
    const ratio = Math.min(devicePixelRatio || 1, 1.75)
    updateCanvasRect()
    if (w === width && h === height && ratio === pixelRatio) return
    width = w
    height = h
    pixelRatio = ratio
    updateProjection()
    if (renderer) {
      renderer.setDrawingBufferSize(width, height, pixelRatio)
    } else {
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
    }
    const next = defaultDistance()
    if (zoomTarget !== null) zoomTarget = clamp((zoomTarget * next) / fit, ...cameraLimits())
    zoom = clamp((zoom * next) / fit, ...cameraLimits())
    fit = next
    if (transition) aim(false)
    dirty = true
  }
  function setOrbitOpacity(path: OrbitPath, opacity: number, now: number) {
    if (path.userData.targetOpacity === opacity) return
    path.userData.targetOpacity = opacity
    if (orbitMotion.matches || path.material.opacity === opacity) {
      path.material.opacity = opacity
      path.visible = opacity > 0
      fadingPaths.delete(path)
    } else {
      path.visible = true
      fadingPaths.set(path, { from: path.material.opacity, start: now })
    }
  }
  function fadeOrbits(now: number) {
    for (const [path, fade] of fadingPaths) {
      const t = orbitMotion.matches ? 1 : clamp((now - fade.start) / 200, 0, 1)
      const end = path.userData.targetOpacity
      path.material.opacity = fade.from + (end - fade.from) * t
      if (t === 1) {
        path.visible = end > 0
        path.material.opacity = end
        fadingPaths.delete(path)
      }
    }
  }
  function updateOrbitTargets() {
    const now = performance.now(),
      all = orbitMode === 'all',
      enabled = !galaxyView && orbitMode !== 'off'
    const host = focusPlanet || (orbitMode === 'smart' && !focusRegion && nearbyHost) || null
    const detail = !!host || !!focusRegion
    const cometsActive = ui.showComets && !galaxyView && !voyagerMode && !newHorizonsMode && !phenomenaMode
    for (const track of cometTracks) {
      const isFocus = track === focusComet
      const isHover = track === hoveredCometTrack
      let opacity = 0
      if (cometsActive) {
        if (isFocus) opacity = 0.88
        else if (isHover) opacity = 0.72
        else if (ui.cometOrbits) opacity = focusComet ? 0.34 : 0.72
        else if (focusRegion === 'oort' && track.comet.id === 'C/2014 UN271') opacity = 0.52
      }
      track.body.setOrbitVisual(opacity, isFocus || isHover, orbitMotion.matches)
    }
    for (const p of worlds) {
      const active = p === host
      const preview = orbitMode === 'smart' && p === hoveredBody && p.anchor.visible
      const alignPluto = phenomenaMode && phenomenonId === 'alignment1982' && p.id === 'Pluto'
      const nhTargetOrbit = newHorizonsMode && (p.id === 'Pluto' || p.id === 'Arrokoth')
      const oortInnerMember =
        focusRegion === 'oort' && (p.id === 'Sedna' || p.id === 'OF201' || p.id === 'Leleakuhonua' || p.id === 'FE72')
      let opacity = 0
      if (enabled) {
        if (active || preview) opacity = 0.52
        else if (alignPluto) opacity = 0.36
        else if (nhTargetOrbit) opacity = p.id === 'Pluto' ? 0.42 : 0.36
        else if (oortInnerMember) opacity = 0.24
        else if (all) opacity = p.region ? 0.19 : 0.31
        else if (focusRegion && p.region === focusRegion) opacity = 0.18
        else if (!p.region) opacity = phenomenaMode && phenomenonId === 'sl9_1994' ? 0.14 : detail ? 0.08 : 0.31
      }
      p.path.material.color.setHex(
        active || preview || alignPluto || nhTargetOrbit
          ? orbitColors.focus
          : p.region
            ? orbitColors[p.region]
            : orbitColors.planet,
      )
      setOrbitOpacity(p.path, opacity, now)
      // All satellite loops for a host share a draw call. Build them on first use.
      const showNhMoonPaths = newHorizonsMode && nhView === 'pluto' && p.id === 'Pluto'
      if ((all || showNhMoonPaths) && enabled && p.moons.length && !p.allMoonPaths) {
        p.allMoonPaths = pathFor(
          p.moons.map((m) => m.orbit),
          orbitColors.moon,
          144,
          p,
        )
        p.moonTracks.add(p.allMoonPaths)
      }
      if (p.allMoonPaths)
        setOrbitOpacity(p.allMoonPaths, (all || showNhMoonPaths) && enabled ? (showNhMoonPaths ? 0.34 : 0.21) : 0, now)
    }
    let moon = enabled ? focusMoon : null
    if (enabled && !all && !moon) {
      if (hoveredBody instanceof Moon) moon = hoveredBody
      else if (host?.moons.length === 1) moon = host.moons[0]
    }
    if (highlightedMoon && highlightedMoon !== moon) setOrbitOpacity(highlightedMoon.path!, 0, now)
    if (moon) {
      if (!moon.path) {
        moon.path = pathFor([moon.orbit], orbitColors.focus, 144, moon.parent)
        moon.parent.moonTracks.add(moon.path)
      }
      setOrbitOpacity(moon.path, 0.87, now)
    }
    highlightedMoon = moon
  }
  function smartHost() {
    if (focusPlanet || focusRegion || galaxyView || voyagerMode || newHorizonsMode || phenomenaMode || zoom > fullSystemDistance() * 0.6)
      return null
    let best = null,
      closest = Infinity
    for (const p of worlds) {
      if (!p.anchor.visible) continue
      const reach = p.region ? Math.max(p.extent * 1.4, 4.5) : Math.max(p.r, p.extent * 0.45)
      const offset = target.distanceToSquared(p.pos) / (reach * reach)
      const limit = p === nearbyHost ? 7.5 : 5
      const maxCamDist = p.region
        ? Math.max(p.r * 55, p.extent * 22, 48)
        : Math.max(p.r * 28, p.extent * 14)
      if (
        offset < limit * limit &&
        offset < closest &&
        camera.position.distanceToSquared(p.pos) < maxCamDist * maxCamDist
      ) {
        best = p
        closest = offset
      }
    }
    return best
  }
  function syncPaths() {
    for (const p of worlds) p.anchor.visible = !galaxyView
    cometLayer.visible = ui.showComets && !galaxyView && !voyagerMode && !newHorizonsMode && !phenomenaMode
    cometOrbitLayer.visible = cometLayer.visible
    orbitLayer.visible = !galaxyView
    updateOrbitTargets()
    setBeltsVisible(!galaxyView)
    syncVoyagerVisibility()
    phenomena.setActive(phenomenaMode && !galaxyView && !deepTarget, phenomenonId)
    sun.mesh.visible = sunGlow.visible = !galaxyView
    galaxy.visible = galaxyView
    skyDome.visible = !galaxyView
    parallaxStars.visible = !galaxyView
    shootingStars.visible = !galaxyView && !orbitMotion.matches
    updateProjection()
    dirty = true
  }
  function updateSmallBodyDetail() {
    const magnification = fullSystemDistance() / zoom
    const reveal = !galaxyView && magnification > (smallVisible ? 1.06 : 1.16)
    if (reveal !== smallVisible) {
      smallVisible = reveal
      syncPaths()
    }
  }
  function project(pos: T.Vector3): ScreenPoint | null {
    viewPos.copy(pos).applyMatrix4(camera.matrixWorldInverse)
    const depth = -viewPos.z
    if (depth < camera.near) return null
    temp.copy(viewPos).applyMatrix4(camera.projectionMatrix)
    return {
      x: ((temp.x + 1) * width) / 2,
      y: ((1 - temp.y) * height) / 2,
      z: depth,
      scale: height / (2 * Math.tan((camera.fov * rad) / 2) * depth),
    }
  }
  const pickables: { obj: World | Moon; q: ScreenPoint; r: number }[] = []
  const solarBodies = [sun, ...worlds]
  function visibleFromCamera(pos: T.Vector3) {
    const ray = toCenter.copy(pos).sub(camera.position),
      length = ray.length()
    ray.normalize()
    for (const body of solarBodies) {
      if (body instanceof World && !body.anchor.visible) continue
      if (body.pos === pos) continue
      temp.copy(body.pos).sub(camera.position)
      const t = temp.dot(ray)
      if (t > 0 && t < length && temp.lengthSq() - t * t < body.r * body.r * 0.97) return false
    }
    return true
  }
  function labelsAndTargets(deltaSec = 1 / 60) {
    pickables.length = 0
    const markers: Label[] = []
    if (galaxyView) {
      oortBoundaries.update(0, ambientTime, deltaSec, true, project, placeText, null, false, width, height)
      positionSkyTargets(null)
      placeLabels(showNames ? markers : [], width, height)
      return
    }
    if (showNames && cometLayer.visible) {
      for (const { el, body } of cometTracks) {
        if (focusComet?.body === body) continue
        const q = project(body.root.position)
        if (!q || q.x < 0 || q.x > width || q.y < 0 || q.y > height || !visibleFromCamera(body.root.position)) continue
        for (const r of [7, 30]) markers.push({ el, q, r, left: body.labelLeft }, { el, q, r, left: !body.labelLeft })
      }
    }
    const minorMarkers: Label[] = []
    for (const object of solarBodies) {
      if (object instanceof World && !object.anchor.visible) continue
      const q = project(object.pos)
      if (
        !q ||
        q.x < -50 ||
        q.x > width + 50 ||
        q.y < -50 ||
        q.y > height + 50 ||
        !visibleFromCamera(object.pos)
      )
        continue
      const r = q.scale * object.r
      if (object instanceof World) pickables.push({ obj: object, q, r })
      if (
        object instanceof World &&
        object.region &&
        !object.prominent &&
        !smallVisible &&
        focusRegion !== object.region &&
        object !== focusPlanet &&
        !(newHorizonsMode && (object.id === 'Pluto' || object.id === 'Arrokoth'))
      )
        continue
      if (voyagerMode && object instanceof World && object.region) continue
      if (
        newHorizonsMode &&
        object instanceof World &&
        object.region &&
        object.id !== 'Pluto' &&
        object.id !== 'Arrokoth'
      )
        continue
      if (
        phenomenaMode &&
        object instanceof World &&
        object.region &&
        !(phenomenonId === 'alignment1982' && object.id === 'Pluto')
      )
        continue
      const mark = {
        el: object.tag,
        q,
        r: object.id === 'Saturn' ? r * 1.98 : r,
        left: object.id === 'Mercury' || object.id === 'Mars',
      }
      if (object === focusPlanet) markers.unshift(mark)
      else if (object instanceof World && object.region && (!object.prominent || object.region === 'main'))
        minorMarkers.push(mark)
      else markers.push(mark)
    }
    markers.push(...minorMarkers)
    for (const p of worlds) {
      if (!p.anchor.visible) continue
      for (const m of p.moons) {
        if (p !== focusPlanet && !m.featured) continue
        const q = project(m.world)
        if (
          !q ||
          (p !== focusPlanet && q.scale * m.r < 1.7) ||
          q.x < -15 ||
          q.x > width + 15 ||
          q.y < -15 ||
          q.y > height + 15 ||
          !visibleFromCamera(m.world)
        )
          continue
        const r = q.scale * m.r
        pickables.push({ obj: m, q, r })
        if (m === focusMoon) {
          const text = moonLabel(m)
          if (selectedTag.textContent !== text) selectedTag.textContent = text
          markers.unshift({ el: selectedTag, q, r })
        } else if (
          (p === focusPlanet || (newHorizonsMode && ((nhView === 'pluto' && p.id === 'Pluto') || (nhView === 'jupiter' && p.id === 'Jupiter')))) &&
          !focusMoon &&
          m.featured
        ) {
          const text = moonLabel(m)
          if (!m.tag) m.tag = tag(text)
          else if (m.tag.textContent !== text) m.tag.textContent = text
          if (!m.tag.isConnected) tags.append(m.tag)
          const probe = voyagerMode && m.name === 'Triton' ? project(focusedTrack().probePos) : null
          markers.push({ el: m.tag, q, r, left: !!probe && q.x < probe.x })
        }
      }
    }
    const tightProbe = voyagerMode && voyagerView === 'probe' && voyagerCustomDistance === null && camera.position.distanceTo(focusedTrack().probePos) < 30
    for (const id of voyagerIds) {
      tracks[id].collectLabels(project, width, height, markers, id === ui.voyagerFocus ? voyagerMilestoneId : '', locale.value, tightProbe && id === ui.voyagerFocus, voyagerView === 'flyby' && id === ui.voyagerFocus)
    }
    const tightNhProbe =
      newHorizonsMode &&
      nhView === 'probe' &&
      nhCustomDistance === null &&
      !!newHorizons &&
      camera.position.distanceTo(newHorizons.probePos) < 24
    newHorizons?.collectLabels(
      project,
      width,
      height,
      markers,
      nhMilestoneId,
      locale.value,
      tightNhProbe,
      nhView === 'overview',
    )
    positionSkyTargets(showNames && !voyagerMode && !newHorizonsMode && !phenomenaMode ? markers : null)
    let oortFade = 0
    if (!voyagerMode && !newHorizonsMode && !phenomenaMode && !focusPlanet && !focusMoon && !excursion) {
      const camR = camera.position.length()
      const zoomRatio = camR / Math.max(1, fullSystemDistance())
      if (focusRegion === 'oort') oortFade = 1
      else if (focusComet?.comet.id === 'C/2014 UN271') oortFade = T.MathUtils.smoothstep(zoomRatio, 0.95, 1.85)
      else oortFade = T.MathUtils.smoothstep(zoomRatio, 1.35, 2.25)
    }
    oortBoundaries.update(
      oortFade,
      ambientTime,
      deltaSec,
      orbitMotion.matches,
      project,
      placeText,
      markers,
      showNames,
      width,
      height,
    )
    boundaries.collectLabels(project, markers)
    phenomena.collectLabels(project, width, height, markers, locale.value)
    const activePanel = !notesOpen
      ? voyagerMode
        ? voyagerPanel
        : newHorizonsMode
          ? newHorizonsPanel
          : phenomenaMode
            ? phenomenaPanel
            : null
      : null
    placeLabels(showNames ? markers : [], width, height, activePanel)
  }
  // The galaxy uses its own illustrative length scale. The Solar System marker
  // corresponds to the Sun's position on ESO's annotated companion map.
  const galacticSun = v3(0, 1, 69),
    galaxy = new T.Group()
  galaxy.visible = false
  scene.add(galaxy)
  const skyRandom = seeded(429517)
  function particleField(positions: number[], colors: number[], size: number, opacity: number) {
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
    return new T.Points(
      geometry,
      new T.PointsMaterial({
        size,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    )
  }
  const galaxyLayers: { material: T.MeshBasicMaterial; weight: number }[] = []
  for (const [level, weight] of [
    [-1, 0.07],
    [-0.5, 0.15],
    [0, 0.53],
    [0.5, 0.15],
    [1, 0.07],
  ]) {
    const g = new T.PlaneGeometry(360, 360, 60, 60)
    g.rotateX(-Math.PI / 2)
    const a = g.attributes.position
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i),
        z = a.getZ(i)
      const bulge = Math.exp(-((x + 0.6 * z) ** 2 / 160 + (z - 0.6 * x) ** 2 / 900))
      a.setY(i, level * (1.7 + 10 * bulge))
    }
    const mat = new T.MeshBasicMaterial({
      map: textures.Galaxy,
      side: T.DoubleSide,
      transparent: true,
      opacity: weight,
      blending: T.AdditiveBlending,
      depthWrite: false,
    })
    galaxyLayers.push({ material: mat, weight })
    galaxy.add(new T.Mesh(g, mat))
  }
  let galaxyStars: ReturnType<typeof particleField> | undefined
  const galaxyImage = new Image()
  galaxyImage.crossOrigin = 'anonymous'
  galaxyImage.onload = () => {
    if (textures.Galaxy) {
      textures.Galaxy.image = galaxyImage
      textures.Galaxy.needsUpdate = true
    }
    const bitmap = document.createElement('canvas')
    bitmap.width = bitmap.height = 256
    const g = bitmap.getContext('2d')!
    g.drawImage(galaxyImage, 0, 0, 256, 256)
    const data = g.getImageData(0, 0, 256, 256).data
    const xyz = [],
      rgb = []
    while (xyz.length < 45000) {
      const u = skyRandom(),
        v = skyRandom()
      const i = (Math.floor(v * 256) * 256 + Math.floor(u * 256)) * 4
      const luminance = (data[i] * 0.26 + data[i + 1] * 0.52 + data[i + 2] * 0.22) / 255
      if (skyRandom() > luminance * luminance * 0.89) continue
      const x = (u - 0.5) * 360,
        z = (v - 0.5) * 360
      const bulge = Math.exp(-((x + 0.6 * z) ** 2 / 290 + (z - 0.6 * x) ** 2 / 1500))
      const y = (skyRandom() + skyRandom() + skyRandom() - 1.5) * (3 + 17 * bulge)
      xyz.push(x, y, z)
      const light = 0.35 + 0.65 * skyRandom()
      rgb.push(
        light * (0.48 + (0.52 * data[i]) / 255),
        light * (0.49 + (0.51 * data[i + 1]) / 255),
        light * (0.48 + (0.52 * data[i + 2]) / 255),
      )
    }
    galaxyStars = particleField(xyz, rgb, 0.3, 0.48)
    galaxy.add(galaxyStars)
    requestDraw()
  }
  function updateGalaxyLayers() {
    const blend = Math.min(1, Math.abs(Math.sin(pitch)) / 0.24)
    for (const layer of galaxyLayers) layer.material.opacity = layer.weight * blend
    const projectedRadius = (180 * height) / (2 * Math.tan((camera.fov * rad) / 2) * zoom)
    const density = clamp((projectedRadius / 400) ** 1.8, 0.1, 1)
    if (galaxyStars) galaxyStars.material.opacity = (0.29 + (1 - blend) * 0.58) * density
  }
  function drawField2D(field: T.Points | undefined, color: string, step: number, size = 1) {
    if (!field) return
    const vertices = field.geometry.attributes.position,
      world = v3()
    ctx.fillStyle = color
    for (let i = 0; i < vertices.count; i += step) {
      world.fromBufferAttribute(vertices, i)
      if (galaxyView) world.applyQuaternion(galaxy.quaternion)
      else if (field.rotation.y) world.applyAxisAngle(v3(0, 1, 0), field.rotation.y)
      const q = project(world)
      if (q && q.x >= 0 && q.x < width && q.y >= 0 && q.y < height)
        ctx.fillRect(q.x, q.y, size, size)
    }
  }
  function drawGalaxy2D() {
    if (galaxyImage.naturalWidth) {
      const q = project(v3()),
        x = project(v3(1, 0, 0).applyQuaternion(galaxy.quaternion)),
        z = project(v3(0, 0, 1).applyQuaternion(galaxy.quaternion))
      if (q && x && z) {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        ctx.globalAlpha = Math.min(0.93, Math.abs(Math.sin(pitch)) / 0.24)
        ctx.transform(x.x - q.x, x.y - q.y, z.x - q.x, z.y - q.y, q.x, q.y)
        ctx.drawImage(galaxyImage, -180, -180, 360, 360)
        ctx.restore()
      }
    }
    drawField2D(galaxyStars, 'rgba(190,204,231,.39)', width < 540 ? 14 : 4)
  }
  const solarMarker = document.createElement('button')
  solarMarker.className = 'galaxy-marker'
  solarMarker.hidden = true
  function syncSolarMarker(lang: Locale = locale.value) {
    solarMarker.textContent = pick('太阳系 ↗', 'Solar System ↗', lang)
    solarMarker.setAttribute(
      'aria-label',
      pick(
        '太阳系在银河系中的位置，点击进入太阳系',
        'Solar System location in the Milky Way, click to enter',
        lang,
      ),
    )
  }
  syncSolarMarker()
  pins.append(solarMarker)
  solarMarker.onclick = () => openPlanet(null)
  const solarNotes: (Note & { region: Belt })[] = [
    {
      name: '外奥尔特云与太阳引力边界',
      region: 'oort',
      p: v3(0.75, 0, -0.66).normalize().multiplyScalar(outerOortBand.lightYearR),
      body: '由扁盘状内奥尔特云（希尔斯云，约 2,000–20,000 AU）向外过渡为近球壳状外奥尔特云（约 20,000–100,000+ AU），跨越 1 光年（63,241 AU）直至约 150,000 AU 的太阳希尔球引力极限。巨型长周期彗星 C/2014 UN271 正是从数万 AU 外俯冲而来；再向外沿南天方向延伸至 4.24 光年外，便是最近的恒星比邻星。',
      source: 'https://science.nasa.gov/solar-system/oort-cloud/facts/',
    },
    {
      name: '离散盘与内奥尔特云',
      region: 'scattered',
      p: v3(-0.62, 0, -0.78).normalize().multiplyScalar(bandMid(scatteredBand)),
      body: '柯伊伯带之外，部分小天体沿狭长的椭圆轨道绕日运行。赛德娜的远日点约为 937 AU，2017 OF201 约为 1,600 AU，Leleākūhonua 约为 2,625 AU，2014 FE72 的估算远日点可达 5,340 AU。',
      source: 'https://science.nasa.gov/solar-system/kuiper-belt/sedna/',
    },
    {
      name: '柯伊伯带',
      region: 'outer',
      p: v3(0.71, 0, -0.704).normalize().multiplyScalar(bandMid(outerBand)),
      body: '海王星轨道外约 30 至 50 AU 的冰质圆盘，包含新视野号飞掠的冥王星与雪人状双瓣天体阿罗科斯、反冥王星亡神星、高速自转带环的妊神星、洛希极限外带双环的创神星与鸟神星。',
      source: 'https://science.nasa.gov/solar-system/kuiper-belt/facts/',
    },
    {
      name: '半人马小天体带',
      region: 'centaur',
      p: v3(0.76, 0, 0.65).normalize().multiplyScalar(bandMid(centaurBands.satUra)),
      body: '穿梭在木星、土星、天王星与海王星轨道之间的冰岩小天体群，颜色呈灰暗与极红双峰分布。其中土星与天王星之间的女凯龙星拥有致密双冰环，凯龙星兼具活跃彗发与环盘结构。',
      source: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=10199',
    },
    {
      name: '木星特洛伊群',
      region: 'trojan',
      p: smallBodies.find((b) => b.id === 'Eurybates')!.pos,
      body: '分布于木星轨道前后 60° 拉格朗日点 L4（希腊营）与 L5（特洛伊营）的两大共轨小行星云团，随木星同步公转。NASA 露西号探测器正前往近距探测欧律巴忒斯与等大双星帕特罗克洛斯。',
      source: 'https://science.nasa.gov/mission/lucy/',
    },
    {
      name: '主小行星带与希尔达族',
      region: 'main',
      p: v3(-0.79, 0, 0.61).normalize().multiplyScalar(bandMid(mainBand)),
      body: '火星与木星之间约 2.1 至 3.3 AU 的暖色环带保留着太阳系早期岩石与金属残余，受木星共振刻出柯克伍德空隙；外缘还分布着与木星呈 3:2 共振的三角形希尔达小行星族。',
      source: 'https://science.nasa.gov/solar-system/asteroids/facts/',
    },
  ]
  const galaxyNotes = [
    {
      name: '太阳系的位置',
      p: galacticSun,
      body: '太阳位于猎户支臂，距银河系中心约 2.6 万光年。点图中的太阳系标记，可以从银河尺度回到八大行星。',
      source: 'https://science.nasa.gov/learn/basics-of-space-flight/chapter1-1/',
    },
    {
      name: '银河系中心',
      p: v3(0, 3, 0),
      body: '银河系是一座棒旋星系。图中暖色的中央区域汇集了密集的恒星；转到侧面，可以看见中央核球比周围的薄盘更厚。',
      source: 'https://www.eso.org/public/images/eso1339g/',
    },
    {
      name: '旋臂',
      p: v3(-69, 0, -33),
      body: '从盘面上方观察，恒星、气体与尘埃勾勒出弯曲的旋臂。太阳所在的猎户支臂，位于人马臂和英仙臂之间。',
      source: 'https://science.nasa.gov/solar-system/solar-system-facts/',
    },
  ]
  let notesOpen = false,
    noteIndex = 0,
    currentNotes: Note[] = [],
    pinNodes: HTMLButtonElement[] = []
  function localizedSolarNotes(lang: Locale): (Note & { region: Belt })[] {
    if (lang === 'zh') return solarNotes
    return solarNotes.map((n) => ({
      ...n,
      name: solarNotesEn[n.region].name,
      body: solarNotesEn[n.region].body,
    }))
  }
  function localizedGalaxyNotes(lang: Locale): Note[] {
    if (lang === 'zh') return galaxyNotes
    return galaxyNotes.map((n, i) => ({
      ...n,
      name: galaxyNotesEn[i]?.name ?? n.name,
      body: galaxyNotesEn[i]?.body ?? n.body,
    }))
  }
  function getNotes(lang: Locale = locale.value): Note[] {
    if (deepTarget) {
      if (deepTarget.planetOrbits) return [{
        name: pick('TRAPPIST-1 的七条轨道', 'The seven orbits of TRAPPIST-1', lang),
        body: pick(
          '七颗行星的轨道间距与公转周期按比例呈现，起始位置来自 Agol 等人（2021）的凌星拟合。模型采用固定的开普勒轨道和共同的升交点方向。天体尺寸已放大，表面为艺术示意。',
          'Orbit spacing and periods are proportional. Starting positions use the transit fit of Agol et al. (2021). The model uses fixed Keplerian orbits and a common node. Bodies are enlarged and surfaces are illustrative.',
          lang,
        ),
        source: trappistPaper,
      }]
      const view = localizedEntry(deepTarget.entry, lang)
      return [
        {
          name: view.title,
          body: view.body,
          source: deepTarget.entry.source,
        },
      ]
    }
    if (galaxyView) return localizedGalaxyNotes(lang)
    if (voyagerMode) {
      return missionMilestones(ui.voyagerFocus).map((m) => ({
        name: `${milestoneTitle(m, lang)} (${lang === 'en' ? m.dateEn : m.dateZh})`,
        p: focusedTrack().milestoneNodes.find((n) => n.milestone.id === m.id)?.pos,
        body: milestoneBody(m, lang),
        source: m.source,
      }))
    }
    if (newHorizonsMode) {
      return newHorizonsMilestones.map((m) => ({
        name: `${nhMilestoneTitle(m, lang)} (${lang === 'en' ? m.dateEn : m.dateZh})`,
        p: newHorizons?.milestoneNodes.find((n) => n.milestone.id === m.id)?.pos,
        body: nhMilestoneBody(m, lang),
        source: m.source,
      }))
    }
    if (phenomenaMode) {
      const def = getPhenomenon(phenomenonId)
      return def.milestones.map((m) => ({
        name: `${phenomenonMilestoneTitle(m, lang)} (${m.yearLabel})`,
        body: phenomenonMilestoneBody(m, lang),
        source: m.source,
      }))
    }
    if (focusComet) {
      const { title, body, source } = cometProfile(focusComet.comet, lang)
      return [{ name: title, body, source }]
    }
    const sNotes = localizedSolarNotes(lang)
    if (focusRegion) {
      const matched = sNotes.find((n) => n.region === focusRegion)
      return matched ? [matched] : [sNotes[0]]
    }
    if (!focusPlanet) return sNotes
    const m = focusMoon,
      p = focusPlanet
    if (m) {
      const axis = formatNum(m.a, lang)
      const pName = worldName(p, lang)
      const mLabel = moonLabel(m, lang)
      const mNum = moonNumberName(m, lang)
      const orbit =
        lang === 'en'
          ? m.estimate
            ? `At discovery, it was observed ~${axis} km from Saturn’s center. Its motion here uses a circular approximation.`
            : `Orbits ${pName} with a semi-major axis of ~${axis} km and an orbital period of ${m.period ? m.period + ' Earth days' : 'an unlisted duration'}.`
          : m.estimate
            ? '发现时，它距土星中心约 ' + axis + ' 千米。图中的绕行采用圆轨道近似。'
            : '它绕' +
              p.name +
              '运行，轨道半长轴约为 ' +
              axis +
              ' 千米，公转一周约需 ' +
              m.period +
              ' 个地球日。'
      const source = moonSources[p.id] || jplFacts
      return [
        {
          name: [mLabel, mNum].filter(Boolean).join(' · '),
          p: m.world,
          body: orbit,
          source: m.estimate ? 'https://tamkin3.eps.harvard.edu/iauc/09000/09091.html' : source,
        },
      ]
    }
    const pName = worldName(p, lang)
    const summary = worldSummary(p, lang)
    if (lang === 'en') {
      const moonsText = p.moons.length
        ? `This atlas includes ${p.moons.length} known natural satellite${p.moons.length === 1 ? '' : 's'}. Open the Moons drawer to track any orbit.`
        : 'No known natural satellites.'
      const periodText =
        p.days > 3652
          ? (p.days / 365.25).toFixed(p.days > 36525 ? 0 : 1) + ' Earth years'
          : formatNum(Math.round(p.days), 'en') + ' Earth days'
      const auText = p.au
        ? p.periAU && p.apoAU && Math.abs(p.apoAU - p.periAU) > 1
          ? `Semi-major axis ~${p.au.toFixed(p.au >= 100 ? 0 : 1)} AU (perihelion ${p.periAU.toFixed(1)} AU, aphelion ${p.apoAU.toFixed(p.apoAU >= 100 ? 0 : 1)} AU), `
          : `Semi-major axis ~${p.au.toFixed(2)} AU, `
        : ''
      const orbitSentence = auText
        ? `${auText}orbital period ~${periodText}.`
        : `Orbital period ~${periodText}.`
      return [
        {
          name: pName,
          p: p.pos,
          body: `${summary ? summary + ' ' : ''}${orbitSentence} ${moonsText}`,
          source: p.source || 'https://ssd.jpl.nasa.gov/planets/phys_par.html',
        },
      ]
    }
    const moons = p.moons.length
      ? '本图收录它的 ' +
        p.moons.length +
        ' 颗天然卫星。打开卫星目录，可以沿其中一颗卫星的轨道观察。'
      : '它目前没有已知的天然卫星。'
    const periodText =
      p.days > 3652
        ? (p.days / 365.25).toFixed(p.days > 36525 ? 0 : 1) + ' 个地球年'
        : Math.round(p.days).toLocaleString('zh-CN') + ' 个地球日'
    const auText = p.au
      ? p.periAU && p.apoAU && Math.abs(p.apoAU - p.periAU) > 1
        ? `轨道半长轴约 ${p.au.toFixed(p.au >= 100 ? 0 : 1)} AU（近日点 ${p.periAU.toFixed(1)} AU，远日点 ${p.apoAU.toFixed(p.apoAU >= 100 ? 0 : 1)} AU），`
        : `轨道半长轴约 ${p.au.toFixed(2)} AU，`
      : ''
    return [
      {
        name: p.name,
        p: p.pos,
        body:
          (p.summary ? p.summary + ' ' : '') +
          auText +
          '绕太阳一周约需 ' +
          periodText +
          '。' +
          moons,
        source: p.source || 'https://ssd.jpl.nasa.gov/planets/phys_par.html',
      },
    ]
  }
  function refreshNotes() {
    currentNotes = getNotes()
    noteIndex = 0
    for (const pin of pinNodes) pin.remove()
    pinNodes = []
    if (notesOpen) {
      currentNotes.forEach((note, i) => {
        if (deepTarget || focusComet || focusPlanet || voyagerMode || newHorizonsMode || phenomenaMode || (galaxyView && i === 0)) return
        const pin = document.createElement('button')
        pin.textContent = note.name
        pin.className = 'map-pin'
        pin.dataset.note = String(i)
        pin.onclick = () => {
          if (!galaxyView && !focusPlanet && 'region' in note)
            openRegion((note as Note & { region: Belt }).region, note.p)
          else showNote(i)
        }
        pins.append(pin)
        pinNodes.push(pin)
      })
      showNote(0)
    }
    ui.notes = currentNotes
    ui.notesOpen = notesOpen
    ui.noteIndex = noteIndex
    requestDraw()
  }
  function showNote(i: number) {
    noteIndex = (i + currentNotes.length) % currentNotes.length
    ui.noteIndex = noteIndex
    for (const pin of pinNodes)
      pin.classList.toggle('active', Number(pin.dataset.note) === noteIndex)
  }
  function setNotes(value: boolean) {
    notesOpen = value

    if (value) {
      setDock(false)
      drawer(false)
    }
    refreshNotes()
  }
  function positionPin(el: HTMLElement, world: T.Vector3, dx: number, dy: number) {
    const q = project(galaxyView ? pinWorld.copy(world).applyQuaternion(galaxy.quaternion) : world)
    const visible = !!q && q.x > 7 && q.x < width - 60 && q.y > 20 && q.y < height - 36
    el.hidden = !visible
    if (visible) placeText(el, q.x + dx, q.y + dy)
  }
  const pinWorld = v3()
  function projectPins() {
    if (galaxyView && (showNames || notesOpen)) positionPin(solarMarker, galacticSun, -6, -11)
    else solarMarker.hidden = true
    for (const pin of pinNodes) positionPin(pin, currentNotes[Number(pin.dataset.note)].p!, -5, -12)
  }
  function setDock(open: boolean) {
    if (open) {
      drawer(false)
      if (notesOpen) setNotes(false)
    } else preview(null)
    ui.dockOpen = open
  }
  let lastVoyHudSync = 0
  function syncVoyagerState(updatePlanets = true, forceHud = true) {
    for (const id of voyagerIds) tracks[id].setYear(voyagerYear)
    let focusSwitched = false
    if (ui.voyagerMode === 'both' && ui.voyagerFocus === 'v1' && voyagerYear < VOYAGER_START_YEAR) {
      ui.voyagerFocus = 'v2'
      refreshNotes()
      focusSwitched = true
    }
    const voyager = focusedTrack()
    if (voyagerMode && updatePlanets) {
      modelStepAtEpoch(voyagerYear, clock, focusMoon)
    }
    const nextMs = voyager.ephemeris.nearestMilestoneId(voyagerYear)
    const milestoneChanged = nextMs !== voyagerMilestoneId
    voyagerMilestoneId = nextMs
    const now = performance.now()
    if (!forceHud && !focusSwitched && !milestoneChanged && now - lastVoyHudSync < 40) return
    lastVoyHudSync = now
    const peer = tracks[ui.voyagerFocus === 'v1' ? 'v2' : 'v1']
    ui.voyagerPeerStats = ui.voyagerMode === 'both' && voyagerYear >= missionStart(peer.id)
      ? peer.ephemeris.statsAt(voyagerYear, locale.value, peer.getSample()) : null
    ui.voyagerYear = voyagerYear
    ui.voyagerMilestone = nextMs
    ui.voyagerStats = voyager.ephemeris.statsAt(voyagerYear, locale.value, voyager.getSample())
  }
  let lastNhHudSync = 0
  function syncNewHorizonsState(updatePlanets = true, forceHud = true) {
    if (!newHorizons) return
    newHorizons.setYear(nhYear)
    if (newHorizonsMode && updatePlanets) {
      const syncJovian = Math.abs(nhYear - NH_JUPITER_YEAR) < 0.25
      modelStepAtEpoch(nhYear, clock, focusMoon, syncJovian)
    }
    const nextMs = newHorizons.ephemeris.nearestMilestoneId(nhYear)
    const milestoneChanged = nextMs !== nhMilestoneId
    nhMilestoneId = nextMs
    const now = performance.now()
    if (!forceHud && !milestoneChanged && now - lastNhHudSync < 40) return
    lastNhHudSync = now
    ui.newHorizonsYear = nhYear
    ui.newHorizonsMilestone = nextMs
    ui.newHorizonsStats = newHorizons.ephemeris.statsAt(nhYear, locale.value, newHorizons.getSample())
  }
  let lastPhenHudSync = 0
  function syncPhenomenaState(updatePlanets = true, forceHud = true, dt = 0) {
    if (phenomenaMode && updatePlanets) {
      modelStepAtEpoch(phenomenonYear, clock, focusMoon, phenomenonId === 'sl9_1994')
    }
    phenomena.setEpoch(phenomenonId, phenomenonYear, locale.value, dt, forceHud)
    const now = performance.now()
    if (!forceHud && now - lastPhenHudSync < 42) return
    lastPhenHudSync = now
    ui.phenomenonId = phenomenonId
    ui.phenomenonYear = phenomenonYear
    ui.phenomenonView = phenomenonView
    const nextMs = nearestPhenomenonMilestone(phenomenonId, phenomenonYear).id
    if (ui.phenomenonMilestone !== nextMs) ui.phenomenonMilestone = nextMs
    ui.phenomenonStats = computePhenomenonStats(phenomenonId, phenomenonYear, locale.value)
  }
  function openGalaxy() {
    focusComet = null
    if (deepTarget) leaveDeepTarget(true)
    if (galaxyView) {
      newHorizonsRequest++
      return
    }
    if (!galaxyImage.src) galaxyImage.src = sources.Galaxy
    voyagerMode = false
    newHorizonsMode = false
    phenomenaMode = false
    voyagerCustomDistance = null
    nhCustomDistance = null
    galaxyView = true
    focusPlanet = null
    focusMoon = null
    focusRegion = null
    setDock(false)
    drawer(false)
    updateView(true)
  }
  // Shared by the main scene and historical mission replays in Canvas mode.
  function drawCanvasSky() {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      0,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.78,
    )
    bgGrad.addColorStop(0, '#071020')
    bgGrad.addColorStop(0.55, '#040914')
    bgGrad.addColorStop(1, '#02050b')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)
    const vector = v3(),
      attr = stars.geometry.attributes.position,
      colAttr = stars.geometry.attributes.color,
      sizeAttr = stars.geometry.attributes.aSize,
      twAttr = stars.geometry.attributes.aTwinkle
    const step = attr.count > 2600 ? 2 : 1
    for (let i = 0; i < attr.count; i += step) {
      vector.fromBufferAttribute(attr, i).add(camera.position)
      const q = project(vector)
      if (!q || q.x < 0 || q.x >= width || q.y < 0 || q.y >= height) continue
      const phase = twAttr ? twAttr.getX(i) : 0
      const freq = twAttr ? twAttr.getY(i) : 1
      const amp = twAttr ? twAttr.getZ(i) : 0.2
      const pulse = 0.75 + 0.25 * (1 + amp * Math.sin(ambientTime * freq + phase))
      const r = colAttr ? Math.min(255, Math.round(colAttr.getX(i) * 255)) : 176
      const g = colAttr ? Math.min(255, Math.round(colAttr.getY(i) * 255)) : 196
      const b = colAttr ? Math.min(255, Math.round(colAttr.getZ(i) * 255)) : 220
      const sz = sizeAttr ? Math.min(2.6, Math.max(0.9, sizeAttr.getX(i) * 0.34)) : 1
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, 0.72 * pulse).toFixed(2)})`
      ctx.fillRect(q.x - sz * 0.5, q.y - sz * 0.5, sz, sz)
    }
  }
  function drawCanvas() {
    if (!ctx) return
    drawCanvasSky()
    if (galaxyView) {
      drawGalaxy2D()
      return
    }
    if (belt.visible) {
      drawField2D(beltDust, 'rgba(219,184,137,.47)', 2)
      drawField2D(hildaDust, 'rgba(206,162,118,.40)', 2)
      drawField2D(trojanDust, 'rgba(202,166,120,.44)', 2)
      drawField2D(centaurDust, 'rgba(136,192,206,.38)', 2)
      drawField2D(neptuneTrojanDust, 'rgba(148,196,226,.34)', 2)
      drawField2D(kuiperDust, 'rgba(159,197,223,.37)', 2)
      drawField2D(scatteredDust, 'rgba(166,174,232,.34)', 2)
      drawField2D(oortDust, 'rgba(150,174,226,.22)', 3)
      drawField2D(outerOortDust, 'rgba(136,196,242,.20)', 3)
    }
    oortBoundaries.draw2D(ctx, project)
    drawCanvasOrbits()
    if (cometOrbitLayer.visible) {
      for (const { body } of cometTracks) body.drawOrbit2D(ctx, project)
    }
    boundaries.draw2D(ctx, project, camera)
    for (const id of voyagerIds) tracks[id].draw2D(ctx, project)
    newHorizons?.draw2D(ctx, project)
    phenomena.draw2D(ctx, project)
    const entries: { q: ScreenPoint; r: number; key: string | null; tint?: string; cometBody?: ReturnType<typeof createCometModel> }[] = []
    if (cometLayer.visible) {
      for (const { body } of cometTracks) {
        const q = project(body.root.position)
        if (q) entries.push({ q, r: 0, key: null, cometBody: body })
      }
    }
    function entry(pos: T.Vector3, r: number, key: string | null, tint?: string) {
      const q = project(pos)
      if (!q) return
      const screenR = Math.min(q.scale * r, width * 3)
      if (q.x + screenR < 0 || q.x - screenR > width || q.y + screenR < 0 || q.y - screenR > height)
        return
      entries.push({ q, r: screenR, key, tint })
    }
    for (const id of voyagerIds) {
      if (tracks[id].root.visible) entry(tracks[id].probePos, 4, id)
    }
    if (newHorizons?.root.visible) entry(newHorizons.probePos, 4, 'nh')
    entry(sun.pos, sun.r, 'Sun')
    for (const p of worlds) {
      if (!p.anchor.visible) continue
      entry(p.pos, p.r, p.id)
      for (const m of p.moons) {
        if (m.featured || p.instances?.visible)
          entry(m.world, m.r, m.name, m.featured ? '#cdbb9f' : '#83959e')
      }
    }
    entries.sort((a, b) => b.q.z - a.q.z)
    for (const { q, r, key, tint, cometBody } of entries) {
      if (cometBody) {
        cometBody.draw2D(ctx, q)
        continue
      }
      if (key === 'v1' || key === 'v2') {
        tracks[key].drawProbe2D(ctx, project, q)
        continue
      }
      if (key === 'nh' && newHorizons) {
        newHorizons.drawProbe2D(ctx, project, q)
        continue
      }
      if (key === 'Sun') {
        const haloR = Math.min(r * 4.2, Math.max(width, height) * 0.85)
        const g = ctx.createRadialGradient(q.x, q.y, r * 0.55, q.x, q.y, haloR)
        g.addColorStop(0, 'rgba(255,244,210,0.82)')
        g.addColorStop(0.22, 'rgba(255,204,116,0.44)')
        g.addColorStop(0.48, 'rgba(255,156,68,0.16)')
        g.addColorStop(0.76, 'rgba(250,126,42,0.04)')
        g.addColorStop(1, 'rgba(240,100,28,0)')
        ctx.fillStyle = g
        ctx.fillRect(q.x - haloR, q.y - haloR, haloR * 2, haloR * 2)
      }
      if (key && nearBody?.id === key && drawPlanet) {
        const pixels = detail.pixelsFor(key)
        if (pixels && drawPlanet(ctx, nearBody, pixels, camera, q, width, height, pixelRatio))
          continue
      }
      const im = key ? images[key] : null
      if (im?.naturalWidth) {
        const refRad =
          key === 'Saturn'
            ? 28
            : key === 'Quaoar'
              ? 26
              : key === 'Chariklo' || key === 'Chiron'
                ? 30
                : 49
        const s = r * (128 / refRad)
        ctx.drawImage(im, q.x - s / 2, q.y - s / 2, s, s)
      } else {
        ctx.fillStyle = tint || '#cbb48b'
        ctx.beginPath()
        ctx.arc(q.x, q.y, Math.max(0.31, r), 0, tau)
        ctx.fill()
      }
    }
  }
  // Reuse the same local-space samples, material opacity and layer visibility as WebGL.
  const clipMatrix = new T.Matrix4(),
    pathMatrix = new T.Matrix4()
  function drawCanvasOrbits() {
    clipMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    ctx.save()
    orbitLayer.traverseVisible((path) => {
      if (!(path instanceof T.Line)) return
      const line = path as OrbitPath
      if (!line.material.opacity) return
      const m = pathMatrix.multiplyMatrices(clipMatrix, path.matrixWorld).elements
      const xyz = path.geometry.attributes.position.array,
        stride = 3 * path.userData.steps
      ctx.strokeStyle = '#' + line.material.color.getHexString()
      ctx.globalAlpha = line.material.opacity
      ctx.beginPath()
      for (let start = 0; start < xyz.length; start += stride) {
        let penDown = false
        for (let j = 0; j <= stride; j += 3) {
          const k = start + (j === stride ? 0 : j),
            x = xyz[k],
            y = xyz[k + 1],
            z = xyz[k + 2]
          const w = m[3] * x + m[7] * y + m[11] * z + m[15]
          if (w < camera.near) {
            penDown = false
            continue
          }
          const sx = (1 + (m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * width * 0.5
          const sy = (1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * height * 0.5
          if (penDown) ctx.lineTo(sx, sy)
          else ctx.moveTo(sx, sy)
          penDown = true
        }
      }
      ctx.stroke()
    })
    ctx.restore()
  }
  let hoverPoint: Point | null = null,
    rowPreview: World | Moon | null = null,
    hoverFrame = 0,
    pendingHoverClient: Point | null = null,
    hoverPickPoint: Point | null = null,
    hoverPickBody: World | Moon | typeof sun | null = null,
    hoverPickComet: (typeof cometTracks)[number] | null = null
  function clearHoverState(triggerDraw = false) {
    if (hoverFrame) {
      cancelAnimationFrame(hoverFrame)
      hoverFrame = 0
    }
    pendingHoverClient = null
    hoverPoint = null
    hoverPickPoint = null
    hoverPickBody = null
    hoverPickComet = null
    if (triggerDraw && (hoveredBody || hoveredCometTrack)) {
      updateOrbitPreview()
      requestDraw()
    }
  }
  function updateOrbitPreview() {
    let body = null,
      host = null
    const reuseHover = !!hoverPoint && hoverPickPoint === hoverPoint
    const nextHoveredComet = !galaxyView && !voyagerMode && !newHorizonsMode && !phenomenaMode && hoverPoint
      ? (reuseHover ? hoverPickComet : cometAt(hoverPoint.x, hoverPoint.y))
      : null
    if (!galaxyView && orbitMode === 'smart') {
      body = rowPreview || (hoverPoint ? (reuseHover ? hoverPickBody : bodyAt(hoverPoint.x, hoverPoint.y)?.obj) : null) || null
      host = smartHost()
    }
    hoverPickPoint = null
    if (body === hoveredBody && host === nearbyHost && nextHoveredComet === hoveredCometTrack) return false
    hoveredBody = body
    nearbyHost = host
    hoveredCometTrack = nextHoveredComet
    updateOrbitTargets()
    return true
  }
  function render(now: number, deltaSec = 1 / 60) {
    updateSpaceTime(ambientTime, pixelRatio)
    if (deepTarget) {
      oortBoundaries.update(0, ambientTime, deltaSec, true, project, placeText, null, false, width, height)
      if (nearBody) updateSurfaceDetail()
      advanceDeepModel()
      moveCamera(now)
      renderDeepModel()
      return
    }
    if (cometLayer.visible) for (const { body } of cometTracks) body.advance(clock)
    syncCometReadout()
    moveCamera(now)
    if (cometLayer.visible) {
      for (const { body } of cometTracks) {
        body.update(project, body === focusComet?.body, ambientTime, camera, pixelRatio, deltaSec, orbitMotion.matches)
      }
    }
    if (!galaxyView) updateVisibleMinorMoons(clock, camera, focusPlanet)
    if (!galaxyView) updateVoyagers()
    if (!galaxyView && phenomenaMode) phenomena.update(camera, ambientTime)
    updateSmallBodyDetail()
    updateSurfaceDetail()
    updateOrbitMasks()
    labelsAndTargets(deltaSec)
    projectPins()
    updateOrbitPreview()
    fadeOrbits(now)
    if (galaxyView) updateGalaxyLayers()
    if (renderer) {
      updateBeltVisibility(camera, canvas.height)
      renderer.render(scene, camera)
    } else {
      scene.updateMatrixWorld()
      drawCanvas()
    }
  }
  let excursion: ReturnType<typeof createExcursion> | null = null
  let approach: ((t: number) => void) | null = null
  let enteredAt = 0
  let landingSite: { site: Landscape; world: World; moon: Moon | null } | null = null
  function land() {
    if (excursion || deepTarget || galaxyView || focusRegion || focusComet || voyagerMode || newHorizonsMode || phenomenaMode) return
    zoomTarget = null
    const world = focusPlanet ?? planets.find((p) => p.id === 'Mars')!
    const id = focusMoon?.name ?? world.id,
      name = focusMoon ? moonLabel(focusMoon) : worldName(world)
    const center = (focusMoon?.world ?? world.pos).clone(),
      radius = focusMoon?.r ?? world.r
    const start = camera.position.clone(),
      rotation = camera.quaternion.clone()
    const direction = start.clone().sub(center),
      distance = Math.max(direction.length(), radius * 1.16)
    direction.normalize()
    const pointing = new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().lookAt(start, center, camera.up),
    )
    approach = (t: number) => {
      const easing = t * t * (3 - 2 * t)
      camera.position
        .copy(center)
        .addScaledVector(direction, distance * ((radius * 1.16) / distance) ** easing)
      camera.quaternion.slerpQuaternions(rotation, pointing, Math.min(1, t * 3))
      camera.updateMatrixWorld()
      updateVisibleMinorMoons(clock, camera, focusPlanet)
      if (cometLayer.visible) {
        for (const { body } of cometTracks) {
          body.update(project, false, ambientTime, camera, pixelRatio, 1 / 60, orbitMotion.matches)
        }
      }
      skyDome.position.copy(camera.position)
      stars.position.copy(camera.position)
      shootingStars.position.copy(camera.position)
      updateSpaceTime(ambientTime, pixelRatio)
      if (renderer) {
        updateBeltVisibility(camera, canvas.height)
        renderer.render(scene, camera)
      } else {
        scene.updateMatrixWorld()
        drawCanvas()
      }
    }
    setDock(false)
    drawer(false)
    if (notesOpen) setNotes(false)
    const site = landscape(id, name)
    landingSite = { site, world, moon: focusMoon }
    excursion = createExcursion(
      site,
      renderer,
      softwareContext,
      orbitMotion.matches,
      requestDraw,
    )
    enteredAt = performance.now()
    ui.landing = { ...excursion.status }
    last = null
    requestDraw()
  }
  function takeOff() {
    if (!excursion) return
    excursion.dispose()
    excursion = null
    landingSite = null
    approach = null
    if (transition) transition.t += performance.now() - enteredAt
    ui.landing = null
    last = null
    requestDraw()
  }
  let frame = 0,
    last: number | null = null,
    smoothDelta = 1 / 60,
    ambientTime = 0,
    lastAmbientDraw = 0
  function tick(now: number) {
    frame = 0
    if (document.hidden) return
    const rawDelta = last === null ? 0 : Math.min((now - last) / 1000, 0.12)
    last = now
    // Gently damp sub-millisecond vsync jitter for buttery-smooth orbital & impact playback
    const delta =
      rawDelta > 0 && rawDelta < 0.05
        ? (smoothDelta = smoothDelta * 0.72 + rawDelta * 0.28)
        : rawDelta
    if (!orbitMotion.matches) ambientTime += delta
    if (excursion && approach) {
      dirty = false
      const moving = excursion.draw(delta, width, height, approach, playing)
      const state = excursion.status,
        previous = ui.landing
      if (
        !previous ||
        state.descending !== previous.descending ||
        state.altitude !== previous.altitude ||
        state.distance !== previous.distance ||
        state.bearing !== previous.bearing ||
        state.veil !== previous.veil
      )
        ui.landing = { ...state }
      if (moving && !frame) frame = requestAnimationFrame(tick)
      return
    }
    if (playing) {
      clock += delta * speed
      if (!deepTarget) {
        if (galaxyView) galaxy.rotation.y -= delta * speed * 0.009
        else if (voyagerMode) {
          // Smooth gravity-assist slow-motion pacing around Earth/Jupiter/Saturn, faster in interstellar cruise
          const rate = voyagerPlaybackRate(voyagerYear, ui.voyagerMode)
          voyagerYear = Math.min(VOYAGER_END_YEAR, voyagerYear + delta * speed * rate)
          const reachedEnd = voyagerYear >= VOYAGER_END_YEAR
          syncVoyagerState(true, reachedEnd)
          if (reachedEnd) {
            playing = ui.playing = false
          }
        } else if (newHorizonsMode && newHorizons) {
          const rate = newHorizonsPlaybackRate(nhYear, nhView)
          nhYear = Math.min(NH_END_YEAR, nhYear + delta * speed * rate)
          const reachedEnd = nhYear >= NH_END_YEAR
          syncNewHorizonsState(true, reachedEnd)
          if (reachedEnd) {
            playing = ui.playing = false
          }
        } else if (phenomenaMode) {
          const def = getPhenomenon(phenomenonId)
          const rate = phenomenonPlaybackRate(phenomenonId, phenomenonYear)
          phenomenonYear = Math.min(def.endYear, phenomenonYear + delta * speed * rate)
          const reachedEnd = phenomenonYear >= def.endYear
          syncPhenomenaState(true, reachedEnd, delta)
          if (reachedEnd) {
            playing = ui.playing = false
          }
        } else modelStep(clock, focusMoon)
      }
    }
    if (zoomTarget !== null) {
      if (pendingZoomPoint) {
        pickZoomAnchor(pendingZoomPoint)
        pendingZoomPoint = null
      }
      const remaining = Math.log(zoomTarget / zoom)
      if (Math.abs(remaining) < 0.0005) {
        applyZoom(zoomTarget)
        zoomTarget = null
      } else {
        applyZoom(zoom * Math.exp(remaining * -Math.expm1(-delta / 0.055)))
      }
      dirty = true
    }
    const fadingSolarOrbits = !deepTarget && fadingPaths.size > 0
    const activeMotion = playing || dirty || !!transition || fadingSolarOrbits
    if (activeMotion) {
      dirty = false
      lastAmbientDraw = now
      render(now, delta || 1 / 60)
    } else if ((renderer || voyagerMode || newHorizonsMode || phenomenaMode) && !orbitMotion.matches && now - lastAmbientDraw >= (renderer ? 33 : 80)) {
      // Keep distant stars gently twinkling, solar plasma flowing, comets outgassing, and spacecraft radio pulses streaming
      const ambientDt = Math.min(0.1, Math.max(0.016, (now - lastAmbientDraw) / 1000))
      lastAmbientDraw = now
      updateSpaceTime(ambientTime, pixelRatio)
      if (!deepTarget && !galaxyView) {
        if (cometLayer.visible) {
          for (const { body } of cometTracks) {
            body.update(project, body === focusComet?.body, ambientTime, camera, pixelRatio, ambientDt, false)
          }
        }
        updateVoyagers()
        if (phenomenaMode) phenomena.update(camera, ambientTime)
      }
      if (renderer) renderer.render(deepTarget ? deepTarget.scene : scene, camera)
      else if (!deepTarget) drawCanvas()
    }
    const keepLoop =
      playing ||
      !!transition ||
      fadingSolarOrbits ||
      zoomTarget !== null ||
      ((!!renderer || voyagerMode || newHorizonsMode || phenomenaMode) && !orbitMotion.matches)
    if (!frame && keepLoop) frame = requestAnimationFrame(tick)
  }
  function requestDraw() {
    if (disposed) return
    dirty = true
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick)
  }
  const pointerRay = new T.Raycaster(),
    pointerNdc = new T.Vector2(),
    ecliptic = new T.Plane(v3(0, 1, 0), 0)
  function screenRay(x: number, y: number) {
    pointerNdc.set((x / width) * 2 - 1, 1 - (y / height) * 2)
    pointerRay.setFromCamera(pointerNdc, camera)
    return pointerRay.ray
  }
  function cometAt(x: number, y: number) {
    if (!cometLayer.visible || deepTarget) return null
    let closest = null, best = Infinity
    for (const track of cometTracks) {
      const pos = track.body.root.position, q = project(pos)
      if (!q) continue
      const distance = Math.hypot(q.x - x, q.y - y)
      if (distance < Math.max(15, track.body.pickRadius) && distance < best && visibleFromCamera(pos)) {
        closest = track
        best = distance
      }
    }
    return closest
  }
  function bodyAt(x: number, y: number): { obj: World | Moon | typeof sun } | null {
    const hits = pickables
      .map((hit) => ({ ...hit, dist: Math.hypot(x - hit.q.x, y - hit.q.y) }))
      .filter((hit) => hit.dist < Math.max(8, hit.r + 3))
    hits.sort((a, b) => {
      const insideA = a.dist < a.r,
        insideB = b.dist < b.r
      return insideA !== insideB ? (insideA ? -1 : 1) : insideA ? a.q.z - b.q.z : a.dist - b.dist
    })
    if (hits.length) return hits[0]
    if (showNames) {
      for (const hit of pickables) {
        const label = hit.obj === focusMoon ? selectedTag : hit.obj.tag
        if (!label || !shownLabels.has(label)) continue
        const pos = textPositions.get(label)
        if (
          pos &&
          x >= pos.x - 2 &&
          x <= pos.x + pos.width + 2 &&
          y >= pos.y &&
          y <= pos.y + 16
        )
          return hit
      }
    }
    const solar = project(sun.pos)
    if (solar && Math.hypot(x - solar.x, y - solar.y) < solar.scale * sun.r) return { obj: sun }
    const saturn = planets[5]
    screenRay(x, y)
    if (saturn.anchor.visible && pointerRay.intersectObject(saturn.rings!, false).length)
      return { obj: saturn }
    for (const p of worlds) {
      if (p.minorRings && p.anchor.visible && pointerRay.intersectObject(p.minorRings, false).length)
        return { obj: p }
    }
    return null
  }
  function beltAt(x: number, y: number, includeDustRaycast = true): { id: Belt; pos: T.Vector3 } | null {
    const ray = screenRay(x, y),
      surface = ray.intersectPlane(ecliptic, v3())
    if (surface) {
      const r = surface.length()
      if (r >= mainBand.inner && r <= hildaBand.outer) return { id: 'main', pos: surface }
      const jupA = planets[4].a
      if (Math.abs(r - jupA) <= 9.5) {
        const jupLon = Math.atan2(-planets[4].pos.z, planets[4].pos.x)
        const hitLon = Math.atan2(-surface.z, surface.x)
        const dLon = Math.atan2(Math.sin(hitLon - jupLon), Math.cos(hitLon - jupLon))
        if (Math.abs(Math.abs(dLon) - Math.PI / 3) < 0.48) return { id: 'trojan', pos: surface }
      }
      if (
        (r >= centaurBands.satUra.inner && r <= centaurBands.satUra.outer) ||
        (r >= centaurBands.uraNep.inner && r <= centaurBands.uraNep.outer)
      )
        return { id: 'centaur', pos: surface }
      if (r >= outerBand.inner && r <= outerBand.outer) return { id: 'outer', pos: surface }
      if (r >= scatteredBand.inner && r <= oortBand.outer) return { id: 'scattered', pos: surface }
      if (r > oortBand.outer && r <= outerOortBand.outer) return { id: 'oort', pos: surface }
    }
    if (!includeDustRaycast) return null
    pointerRay.params.Points.threshold = clamp((zoom * 2) / height, 0.12, 1.2)
    const dust = pointerRay.intersectObjects<T.Points>(
      [
        beltDust,
        hildaDust,
        trojanDust,
        centaurDust,
        neptuneTrojanDust,
        kuiperDust,
        scatteredDust,
        oortDust,
        outerOortDust,
      ],
      false,
    )[0]
    if (!dust) return null
    const id: Belt =
      dust.object === beltDust || dust.object === hildaDust
        ? 'main'
        : dust.object === trojanDust
          ? 'trojan'
          : dust.object === centaurDust || dust.object === neptuneTrojanDust
            ? 'centaur'
            : dust.object === kuiperDust
              ? 'outer'
              : dust.object === outerOortDust
                ? 'oort'
                : 'scattered'
    return {
      id,
      pos: dust.object.localToWorld(
        v3().fromBufferAttribute(dust.object.geometry.attributes.position, dust.index!),
      ),
    }
  }
  function stopFlight() {
    if (transition) {
      panOffset.copy(target).sub(baseCenter())
      transition = null
    }
  }
  function pickZoomAnchor(point: Point | null) {
    zoomAnchor.set(0, 0, 0)
    if (point) {
      const x = point.x - canvasRect.left,
        y = point.y - canvasRect.top
      const hit = deepTarget ? deepBodyAt(x, y) : galaxyView ? null : bodyAt(x, y)
      const region = deepTarget || galaxyView || hit ? null : beltAt(x, y)
      const through = hit
        ? hit.obj instanceof Moon
          ? hit.obj.world
          : hit.obj.pos
        : region
          ? region.pos
          : target
      const plane = new T.Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(v3()),
        through,
      )
      const anchor = screenRay(x, y).intersectPlane(plane, v3())
      if (anchor) zoomAnchor.copy(anchor).sub(target)
    }
  }
  function changeZoom(factor: number, clientX?: number, clientY?: number, smooth = true) {
    stopFlight()
    const next = clamp((smooth ? zoomTarget ?? zoom : zoom) * factor, ...cameraLimits())
    const point = clientX !== undefined && clientY !== undefined ? { x: clientX, y: clientY } : null
    if (smooth && !orbitMotion.matches) {
      // Trackpads can deliver several wheel events between paints. Pick the latest anchor once.
      pendingZoomPoint = point
      if (!point) zoomAnchor.set(0, 0, 0)
      if (!frame && !playing) last = performance.now()
      zoomTarget = next
    } else {
      zoomTarget = null
      pendingZoomPoint = null
      pickZoomAnchor(point)
      applyZoom(next)
      moveCamera(performance.now())
    }
    requestDraw()
  }
  function applyZoom(next: number) {
    const ratio = next / zoom
    panOffset.addScaledVector(zoomAnchor, 1 - ratio)
    zoomAnchor.multiplyScalar(ratio)
    zoom = next
  }
  function panView(dx: number, dy: number) {
    zoomTarget = null
    stopFlight()
    const units = (2 * zoom * Math.tan((camera.fov * rad) / 2)) / height
    panOffset.addScaledVector(v3().setFromMatrixColumn(camera.matrixWorld, 0), -dx * units)
    panOffset.addScaledVector(v3().setFromMatrixColumn(camera.matrixWorld, 1), dy * units)
    moveCamera(performance.now())
    requestDraw()
  }
  function changeAngle(dx: number, dy: number) {
    zoomTarget = null
    stopFlight()
    yaw -= dx * 0.007
    pitch = clamp(pitch + dy * 0.007, -1.52, 1.52)
    requestDraw()
  }
  const pointers = new Map<number, Point>()
  let tapStart: (Point & { comet: (typeof cometTracks)[number] | null }) | null = null,
    lastPair = 0,
    panDrag = false,
    midpoint: Point | null = null
  function pairDistance() {
    const [a, b] = [...pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  function pairCenter() {
    const [a, b] = [...pointers.values()]
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }
  function flushHover() {
    hoverFrame = 0
    if (disposed || pointers.size || !pendingHoverClient || (galaxyView && !deepTarget)) return
    const x = pendingHoverClient.x - canvasRect.left
    const y = pendingHoverClient.y - canvasRect.top
    pendingHoverClient = null
    const pt = { x, y }
    hoverPoint = pt
    const nhHit = deepTarget || galaxyView ? null : newHorizonsHitAt(x, y)
    const voyHit = nhHit || deepTarget || galaxyView ? null : voyagerHitAt(x, y)
    const bodyHit = nhHit || voyHit ? null : (deepTarget ? deepBodyAt(x, y) : bodyAt(x, y))
    const object = bodyHit?.obj
    const region = nhHit || voyHit || object || deepTarget ? null : beltAt(x, y, false)
    const hoveredComet = !galaxyView && !voyagerMode && !newHorizonsMode && !phenomenaMode ? cometAt(x, y) : null
    const caption = hoveredComet
      ? hoveredComet.el.textContent || hoveredComet.comet.en
      : nhHit
        ? nhHit.kind === 'probe'
          ? pick('新视野号', 'New Horizons')
          : nhMilestoneShort(nhHit.milestone, locale.value)
        : voyHit
          ? voyHit.kind === 'probe'
            ? missionName(voyHit.id)
            : milestoneShort(voyHit.milestone, locale.value)
          : object
            ? object instanceof Moon
              ? moonLabel(object)
              : object instanceof World
                ? worldName(object)
                : object.name
            : region
              ? regionLabel(region.id)
              : ''
    canvas.style.cursor = caption ? 'pointer' : ''
    if (canvas.title !== caption) canvas.title = caption
    if (!deepTarget) {
      hoverPickPoint = pt
      hoverPickBody = (!nhHit && !voyHit && !deepTarget ? (bodyHit?.obj as World | Moon | typeof sun | null) : null) ?? null
      hoverPickComet = hoveredComet
      if (updateOrbitPreview()) requestDraw()
    }
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal: listeners.signal })
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 && e.button !== 2) return
      updateCanvasRect()
      clearHoverState(true)
      canvas.style.cursor = ''
      canvas.setPointerCapture(e.pointerId)
      canvas.focus({ preventScroll: true })
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      canvas.classList.add('dragging')
      panDrag = e.button === 2 || e.shiftKey
      tapStart = pointers.size === 1 && !panDrag
        ? { x: e.clientX, y: e.clientY, comet: cometAt(e.clientX - canvasRect.left, e.clientY - canvasRect.top) }
        : null
      if (pointers.size === 2) {
        lastPair = pairDistance()
        midpoint = pairCenter()
      }
    },
    { signal: listeners.signal },
  )
  canvas.addEventListener(
    'pointermove',
    (e) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) {
        if (e.pointerType === 'mouse' && (!galaxyView || deepTarget) && !pointers.size) {
          pendingHoverClient = { x: e.clientX, y: e.clientY }
          if (!hoverFrame) hoverFrame = requestAnimationFrame(flushHover)
        }
        return
      }
      const dx = e.clientX - prev.x,
        dy = e.clientY - prev.y
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 4)
        tapStart = null
      if (pointers.size === 1) {
        if (panDrag) panView(dx, dy)
        else if (!tapStart) changeAngle(dx, dy)
      } else if (pointers.size === 2) {
        const span = pairDistance(),
          mid = pairCenter()
        if (midpoint) panView(mid.x - midpoint.x, mid.y - midpoint.y)
        if (span > 2 && lastPair > 2) changeZoom(lastPair / span, mid.x, mid.y, false)
        midpoint = mid
        lastPair = span
      }
    },
    { signal: listeners.signal },
  )
  canvas.addEventListener(
    'pointerleave',
    () => {
      clearHoverState(true)
    },
    { signal: listeners.signal },
  )
  function finishPointer(e: PointerEvent, cancel: boolean) {
    if (!pointers.has(e.pointerId)) return
    const wasTap = !cancel && pointers.size === 1 ? tapStart : null
    pointers.delete(e.pointerId)
    tapStart = null
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    if (!pointers.size) canvas.classList.remove('dragging')
    if (deepTarget && !renderer) requestDraw()
    if (wasTap) {
      const bounds = canvas.getBoundingClientRect(),
        x = e.clientX - bounds.left,
        y = e.clientY - bounds.top
      if (deepTarget) {
        const hit = deepBodyAt(x, y)
        if (hit) deepPreset(hit.obj.key)
        return
      }
      if (galaxyView) return
      const comet = wasTap.comet ?? cometAt(x, y)
      if (comet) {
        openComet(comet.comet.id)
        return
      }
      const nhHit = newHorizonsHitAt(x, y)
      if (nhHit) {
        if (nhHit.kind === 'probe') {
          setNewHorizonsView('probe')
        } else {
          jumpNewHorizonsMilestone(nhHit.milestone.id)
        }
        return
      }
      const voyHit = voyagerHitAt(x, y)
      if (voyHit) {
        if (!voyagerMode) {
          ui.voyagerMode = voyHit.id
          openVoyager()
        }
        setVoyagerFocus(voyHit.id)
        if (voyHit.kind === 'probe') {
          setVoyagerView('probe')
        } else {
          jumpVoyagerMilestone(voyHit.milestone.id)
        }
        return
      }
      const hit = bodyAt(x, y)
      if (hit) {
        if (hit.obj instanceof Moon) openMoon(hit.obj)
        else openPlanet(hit.obj instanceof World ? hit.obj : null)
        return
      }
      const region = beltAt(x, y)
      if (region) openRegion(region.id, region.pos)
    }
  }
  canvas.addEventListener('pointerup', (e) => finishPointer(e, false), { signal: listeners.signal })
  canvas.addEventListener('pointercancel', (e) => finishPointer(e, true), {
    signal: listeners.signal,
  })
  canvas.addEventListener('lostpointercapture', (e) => finishPointer(e, true), {
    signal: listeners.signal,
  })
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const units = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1
      changeZoom(Math.exp(clamp(e.deltaY * units, -300, 300) * 0.0016), e.clientX, e.clientY)
    },
    { passive: false, signal: listeners.signal },
  )
  canvas.addEventListener(
    'keydown',
    (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          changeAngle(-14, 0)
          break
        case 'ArrowRight':
          changeAngle(14, 0)
          break
        case 'ArrowUp':
          changeAngle(0, 12)
          break
        case 'ArrowDown':
          changeAngle(0, -12)
          break
        case '+':
        case '=':
          changeZoom(0.82)
          break
        case '-':
          changeZoom(1.22)
          break
        case 'Home':
          aim()
          requestDraw()
          break
        case ' ':
          setPlaying(!playing)
          break
        case 'Escape':
          if (deepTarget) leaveDeepTarget(true)
          else if (focusMoon) openPlanet(focusPlanet)
          else openPlanet(null)
          break
        default:
          return
      }
      e.preventDefault()
    },
    { signal: listeners.signal },
  )
  function setPlaying(value: boolean) {
    if (value && newHorizonsMode && newHorizons && nhYear >= NH_END_YEAR - 1e-5) {
      nhYear = NH_START_YEAR
      syncNewHorizonsState(true)
    }
    if (value && voyagerMode && voyagerYear >= VOYAGER_END_YEAR) {
      voyagerYear = missionStart(ui.voyagerMode)
      syncVoyagerState(true)
    }
    if (phenomenaMode) {
      const def = getPhenomenon(phenomenonId)
      if (value && phenomenonYear >= def.endYear - 1e-5) {
        phenomenonYear = def.startYear
      }
      syncPhenomenaState(true, true)
    }
    playing = ui.playing = value
    last = null
    requestDraw()
  }
  function setSpeed(value: number) {
    speed = ui.speed = value
  }
  function setOrbitMode(mode: OrbitMode) {
    orbitMode = ui.orbitMode = mode
    if (!deepTarget) updateOrbitTargets()
    requestDraw()
  }
  function setLabels(value: boolean) {
    showNames = ui.showNames = value
    tags.hidden = !value
    requestDraw()
  }
  function drawer(open: boolean) {
    if (open) {
      setDock(false)
      if (notesOpen) setNotes(false)
    } else preview(null)
    ui.drawerOpen = open
  }
  function preview(body: World | Moon | null) {
    rowPreview = body
    requestDraw()
  }
  function updateView(changeScale = false, keepDirection = false) {
    if (!newHorizonsMode) newHorizonsRequest++
    rowPreview = null
    clearHoverState()
    hoveredBody = null
    nearbyHost = null
    ui.galaxy = galaxyView
    ui.voyager = voyagerMode
    ui.newHorizons = newHorizonsMode
    ui.phenomena = phenomenaMode
    ui.comet = focusComet?.comet ?? null
    ui.planet = focusPlanet
    ui.moon = focusMoon
    ui.region = focusRegion
    ui.deepEntry = null
    ui.title = newHorizonsMode
      ? pick('新视野号', 'New Horizons')
      : galaxyView
      ? pick('银河系', 'Milky Way')
      : phenomenaMode
        ? phenomenonName(getPhenomenon(phenomenonId))
        : voyagerMode
          ? missionName(ui.voyagerMode)
          : focusMoon
            ? moonLabel(focusMoon)
            : focusPlanet
              ? worldName(focusPlanet)
              : focusRegion
                ? regionLabel(focusRegion)
                : pick('太阳系', 'Solar System')
    if (focusComet) ui.title = focusComet.el.textContent || focusComet.comet.en
    ui.tracksDisabled = galaxyView
    refreshNotes()
    syncPaths()
    aim(!changeScale, !changeScale && keepDirection)
    requestDraw()
    if (changeScale && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas.animate([{ opacity: 0.24 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' })
    }
  }
  function openVoyager(milestoneId?: string, nextMode?: VoyagerMode) {
    focusComet = null
    if (deepTarget) leaveDeepTarget(false)
    ui.group = '太阳系'
    const wasGalactic = galaxyView
    galaxyView = false
    phenomenaMode = false
    newHorizonsMode = false
    nhCustomDistance = null
    focusPlanet = null
    focusMoon = null
    focusRegion = null
    voyagerMode = true
    voyagerCustomDistance = null
    if (nextMode) {
      ui.voyagerMode = nextMode
      if (nextMode !== 'both') ui.voyagerFocus = nextMode
    }
    setDock(false)
    drawer(false)
    ui.search = ''
    if (milestoneId) {
      jumpVoyagerMilestone(milestoneId, wasGalactic)
      return
    }
    if (ui.voyagerMode !== 'both') ui.voyagerFocus = ui.voyagerMode
    voyagerView = ui.voyagerView = 'overview'
    voyagerYear = VOYAGER_END_YEAR
    playing = ui.playing = false
    syncVoyagerState(true)
    updateView(wasGalactic, false)
  }
  async function openNewHorizons(milestoneId?: NewHorizonsMilestoneId) {
    if (excursion) return
    if (newHorizonsMode && newHorizons) {
      if (milestoneId) jumpNewHorizonsMilestone(milestoneId)
      return
    }
    const request = ++newHorizonsRequest
    if (!newHorizons) {
      const module = await import('./newHorizonsModel').catch((error) => {
        if (request === newHorizonsRequest && !disposed) throw error
        return null
      })
      if (!module || request !== newHorizonsRequest || disposed || excursion) return
      newHorizons = module.createNewHorizonsModel(scene, !!renderer, worlds, planets, mapOuterAU, tag)
      newHorizons.refreshLabels(locale.value)
      nhEndPoint.copy(newHorizons.ephemeris.sample(NH_END_YEAR, v3()).pos)
    }
    if (deepTarget) leaveDeepTarget(false)
    const wasGalactic = galaxyView
    galaxyView = false
    voyagerMode = false
    phenomenaMode = false
    voyagerCustomDistance = null
    focusComet = null
    focusPlanet = null
    focusMoon = null
    focusRegion = null
    newHorizonsMode = true
    nhCustomDistance = null
    ui.group = '太阳系'
    setDock(false)
    drawer(false)
    ui.search = ''
    if (milestoneId) {
      jumpNewHorizonsMilestone(milestoneId, wasGalactic)
      return
    }
    nhView = ui.newHorizonsView = 'overview'
    nhYear = NH_END_YEAR
    playing = ui.playing = false
    syncNewHorizonsState(true)
    updateView(wasGalactic, false)
    canvas.focus({ preventScroll: true })
  }
  function setNewHorizonsYear(year: number, pause = false) {
    nhYear = clamp(year, NH_START_YEAR, NH_END_YEAR)
    if (pause) playing = ui.playing = false
    syncNewHorizonsState(true)
    requestDraw()
  }
  function setNewHorizonsView(view: NewHorizonsView) {
    if (!newHorizonsMode || !newHorizons) return
    nhView = ui.newHorizonsView = view
    nhCustomDistance = null
    // If jumping to a flyby close-up while far in time, seek smoothly to that encounter!
    if (view === 'jupiter' && Math.abs(nhYear - NH_JUPITER_YEAR) > 0.35) {
      nhYear = NH_JUPITER_YEAR
      playing = ui.playing = false
    } else if (view === 'pluto' && Math.abs(nhYear - NH_PLUTO_YEAR) > 0.35) {
      nhYear = NH_PLUTO_YEAR
      playing = ui.playing = false
    } else if (view === 'arrokoth' && Math.abs(nhYear - NH_ARROKOTH_YEAR) > 0.35) {
      nhYear = NH_ARROKOTH_YEAR
      playing = ui.playing = false
    }
    syncNewHorizonsState(true)
    updateOrbitTargets()
    aim(true, false)
    requestDraw()
  }
  function jumpNewHorizonsMilestone(id: NewHorizonsMilestoneId, changeScale = false) {
    const ms = newHorizonsMilestones.find((m) => m.id === id)
    if (!ms || !newHorizons) return
    newHorizonsMode = true
    voyagerMode = false
    phenomenaMode = false
    galaxyView = false
    focusPlanet = null
    focusMoon = null
    focusRegion = null
    nhYear = ms.year
    playing = ui.playing = false
    if (id === 'launch') {
      nhView = ui.newHorizonsView = 'probe'
      nhCustomDistance = 18
    } else {
      nhView = ui.newHorizonsView = ms.defaultView
      nhCustomDistance = null
    }
    syncNewHorizonsState(true)
    updateView(changeScale, false)
  }
  function setVoyagerMode(mode: VoyagerMode) {
    if (mode === ui.voyagerMode) return
    ui.voyagerMode = mode
    if (mode !== 'both') ui.voyagerFocus = mode
    voyagerYear = Math.max(missionStart(mode), voyagerYear)
    voyagerCustomDistance = null
    syncVoyagerState()
    updateView()
  }
  function setVoyagerFocus(id: VoyagerId) {
    if (ui.voyagerFocus === id || voyagerYear < missionStart(id)) return
    ui.voyagerFocus = id
    voyagerCustomDistance = null
    syncVoyagerState(false)
    refreshNotes()
    if (voyagerView === 'probe') aim()
    requestDraw()
  }
  function setVoyagerOverlay(enabled: boolean) {
    voyagerOverlay = ui.voyagerOverlay = enabled
    syncVoyagerVisibility()
    requestDraw()
  }
  function setVoyagerYear(year: number, pause = false) {
    voyagerYear = clamp(year, missionStart(ui.voyagerMode), VOYAGER_END_YEAR)
    if (pause) playing = ui.playing = false
    syncVoyagerState(true)
    requestDraw()
  }
  function setVoyagerView(view: VoyagerView) {
    if (!voyagerMode) openVoyager()
    voyagerView = ui.voyagerView = view
    voyagerCustomDistance = null
    aim(true, false)
    requestDraw()
  }
  function jumpVoyagerMilestone(id: string, changeScale = false) {
    const ms = missionMilestones(ui.voyagerFocus).find((m) => m.id === id)
    if (!ms) return
    if (!voyagerMode) {
      voyagerMode = true
      newHorizonsMode = false
      nhCustomDistance = null
      phenomenaMode = false
      galaxyView = false
      focusPlanet = null
      focusMoon = null
      focusRegion = null
    }
    voyagerYear = ms.year
    playing = ui.playing = false
    syncVoyagerState(true)

    if (id === 'launch') {
      voyagerView = ui.voyagerView = 'probe'
      voyagerCustomDistance = 22
    } else if (id === 'jupiter') {
      voyagerView = ui.voyagerView = 'probe'
      voyagerCustomDistance = 48
    } else if (id === 'saturn') {
      voyagerView = ui.voyagerView = 'probe'
      voyagerCustomDistance = 68
    } else if (id === 'uranus' || id === 'neptune') {
      voyagerView = ui.voyagerView = 'probe'
      voyagerCustomDistance = 36
    } else if (id === 'paleBlueDot') {
      voyagerView = ui.voyagerView = 'probe'
      voyagerCustomDistance = 120
    } else if (id === 'terminationShock' || id === 'heliopause') {
      voyagerView = ui.voyagerView = 'climb'
      voyagerCustomDistance = null
    } else {
      voyagerView = ui.voyagerView = 'overview'
      voyagerCustomDistance = null
    }
    updateView(changeScale, false)
  }
  function openPhenomena(id?: PhenomenonId) {
    focusComet = null
    if (deepTarget) leaveDeepTarget(false)
    ui.group = '太阳系'
    const wasGalactic = galaxyView
    galaxyView = false
    voyagerMode = false
    newHorizonsMode = false
    voyagerCustomDistance = null
    nhCustomDistance = null
    focusPlanet = null
    focusMoon = null
    focusRegion = null
    phenomenaMode = true
    if (id) phenomenonId = id
    const def = getPhenomenon(phenomenonId)
    phenomenonYear = def.defaultYear
    phenomenonView = def.defaultView
    setDock(false)
    drawer(false)
    ui.search = ''
    playing = ui.playing = !orbitMotion.matches
    last = null
    syncPhenomenaState(true)
    updateView(wasGalactic, false)
  }
  function setPhenomenon(id: PhenomenonId) {
    if (!phenomenaMode) {
      openPhenomena(id)
      return
    }
    if (id === phenomenonId) return
    phenomenonId = id
    const def = getPhenomenon(id)
    phenomenonYear = def.defaultYear
    phenomenonView = def.defaultView
    playing = ui.playing = !orbitMotion.matches
    last = null
    syncPhenomenaState(true)
    updateView(false, false)
  }
  function setPhenomenaYear(year: number, pause = false) {
    const def = getPhenomenon(phenomenonId)
    phenomenonYear = clamp(year, def.startYear, def.endYear)
    if (pause) playing = ui.playing = false
    last = null
    syncPhenomenaState(true)
    requestDraw()
  }
  function setPhenomenaView(view: string) {
    if (!phenomenaMode) openPhenomena()
    phenomenonView = ui.phenomenonView = view
    aim(true, false)
    requestDraw()
  }
  function jumpPhenomenaMilestone(milestoneId: string) {
    const def = getPhenomenon(phenomenonId)
    const ms = def.milestones.find((m) => m.id === milestoneId)
    if (!ms) return
    const wasInMode = phenomenaMode
    if (!phenomenaMode) {
      phenomenaMode = true
      voyagerMode = false
      newHorizonsMode = false
      nhCustomDistance = null
      galaxyView = false
      focusPlanet = null
      focusMoon = null
      focusRegion = null
    }
    phenomenonYear = ms.year
    phenomenonView = ms.viewId
    // Click a year/phase milestone to begin live real-time simulation immediately (pausable anytime!)
    playing = ui.playing = !orbitMotion.matches
    syncPhenomenaState(true, true)
    if (wasInMode) {
      aim(true, false)
      requestDraw()
    } else {
      last = null
      updateView(false, false)
    }
  }
  function syncCometReadout() {
    if (!focusComet) return
    ui.cometDistanceAU = Math.round(focusComet.body.radiusAU * 100) / 100
    ui.cometSpeedKmS = Math.round(focusComet.body.speedKmS * 10) / 10
    ui.cometActivity = Math.round(focusComet.body.activity * 100)
    ui.cometInbound = focusComet.body.inbound
  }
  function seekCometPerihelion() {
    if (!focusComet) return
    focusComet.body.seekPerihelion()
    syncCometReadout()
    aim(true, false)
    requestDraw()
  }
  function openComet(id: string) {
    const track = cometTracks.find(t => t.comet.id === id)
    if (!track) return
    if (!ui.showComets) ui.showComets = true
    if (deepTarget || galaxyView || voyagerMode || newHorizonsMode || phenomenaMode) openPlanet(null)
    ui.group = '太阳系'
    track.body.advance(clock)
    focusComet = track
    syncCometReadout()
    focusPlanet = focusMoon = focusRegion = null
    setDock(false)
    drawer(false)
    setNotes(false)
    updateView()
    canvas.focus({ preventScroll: true })
  }
  function openPlanet(p: World | null) {
    focusComet = null
    if (deepTarget) leaveDeepTarget(false)
    ui.group = '太阳系'
    const leavingGalaxy = galaxyView
    const leavingEpochMode = voyagerMode || newHorizonsMode || phenomenaMode
    galaxyView = false
    voyagerMode = false
    newHorizonsMode = false
    phenomenaMode = false
    voyagerCustomDistance = null
    nhCustomDistance = null
    focusPlanet = p
    focusMoon = null
    focusRegion = null
    setDock(false)
    drawer(false)
    ui.search = ''
    if (leavingGalaxy || leavingEpochMode) modelStep(clock)
    updateView(leavingGalaxy, false)
  }
  function openMoon(m: Moon) {
    if (focusPlanet !== m.parent || galaxyView || voyagerMode || newHorizonsMode || phenomenaMode) openPlanet(m.parent)
    if (m.instance !== undefined) updateMinorMoons(m.parent, clock)
    focusPlanet = m.parent
    focusMoon = m
    focusRegion = null
    if (width < 620) drawer(false)
    updateView(false, false)
  }
  function openRegion(id: Belt, at?: T.Vector3) {
    focusComet = null
    if (deepTarget) leaveDeepTarget(false)
    ui.group = '太阳系'
    const wasGalactic = galaxyView
    const wasEpochMode = voyagerMode || newHorizonsMode || phenomenaMode
    galaxyView = false
    voyagerMode = false
    newHorizonsMode = false
    phenomenaMode = false
    voyagerCustomDistance = null
    nhCustomDistance = null
    focusRegion = id
    focusMoon = null
    focusPlanet = null
    if (wasGalactic || wasEpochMode) modelStep(clock)
    if (id === 'oort') {
      regionCenter.set(0, 0, 0)
    } else {
      const anchorIds: Record<Exclude<Belt, 'oort'>, string> = {
        main: 'Ceres',
        trojan: 'Patroclus',
        centaur: 'Chariklo',
        outer: 'Pluto',
        scattered: 'Gonggong',
      }
      const anchorBody =
        smallBodies.find((p) => p.id === anchorIds[id]) || smallBodies.find((p) => p.region === id)!
      regionCenter.copy(at || anchorBody.pos)
    }
    setDock(false)
    ui.search = ''
    updateView(wasGalactic, true)
    drawer(true)
  }
  const catalogEntries = createArchive(worlds)
  const skyPoint = v3()
  const skyTargets = catalogEntries.flatMap(entry => {
    if (!entry.sky) return []
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'sky-target'
    el.hidden = true
    const caption = tag('', 'sky-caption')
    const open = () => openDeepTarget(entry)
    el.addEventListener('click', open, { signal: listeners.signal })
    caption.addEventListener('click', open, { signal: listeners.signal })
    pins.append(el)
    return [{ entry, el, caption, direction: skyDirection(entry.sky.ra, entry.sky.dec) }]
  })
  function positionSkyTargets(markers: Label[] | null) {
    for (const { el, caption, direction } of skyTargets) {
      const q = markers ? project(skyPoint.copy(direction).multiplyScalar(7800).add(camera.position)) : null
      const visible = !!q && q.x >= 0 && q.x <= width && q.y >= 0 && q.y <= height && visibleFromCamera(skyPoint)
      if (el.hidden === visible) el.hidden = !visible
      if (visible && markers && q) {
        placeText(el, q.x - 9, q.y - 9)
        markers.push({ el: caption, q, r: 3 })
      }
    }
  }
  function localizeSkyLabels(lang: Locale) {
    for (const { entry, el, caption } of skyTargets) {
      const name = entry.id.toUpperCase() + ' · ' + localizedEntry(entry, lang).title
      caption.textContent = el.title = name
      el.setAttribute('aria-label', name)
    }
    for (const { comet, el } of cometTracks) {
      el.textContent = pick(comet.zh + '彗星', comet.id + ' ' + comet.en, lang)
    }
  }
  localizeSkyLabels(locale.value)
  const models = createDeepModels(
    renderer,
    sphere,
    tag,
    requestDraw,
    (model) => !disposed && deepTarget === model,
  )
  const drawDeepCanvas = softwareContext
    ? createDeepCanvasRenderer(softwareContext, camera, project, models.getSurface, models.glowMap)
    : null
  let returnCamera: {
    yaw: number
    pitch: number
    zoom: number
    fit: number
    pan: T.Vector3
  } | null = null
  function deepBody(key: string) {
    return deepTarget!.bodies.find((b) => b.key === key)
  }
  function deepCenter() {
    return deepBody(deepTarget!.view)?.pos || deepTarget!.origin
  }
  function deepDistance() {
    const d = deepTarget!,
      narrow = Math.max(1, 1.18 / camera.aspect)
    if (d.form) return (d.entry.id === 'm87' ? 46 : 38) * narrow
    if (d.view === 'system') {
      if (d.planetOrbits) {
        const outer = Math.max(...d.planetOrbits.map((track) => track.orbit.a))
        return outer * Math.max(2.55, 2.85 / camera.aspect)
      }
      if (d.system) return (d.system.axis + 3.9) * 2.45 * narrow
      return (d.entry.id === 'vega' ? 31.5 : 29) * narrow
    }
    return (deepBody(d.view)?.r || 2) * 4.6 * Math.max(1, 1 / camera.aspect)
  }
  function deepAngles() {
    const d = deepTarget!
    if (d.form) {
      const elevation = d.view === 'top' ? 1.5 : d.view === 'edge' ? 0.075 : d.form.pitch
      return [0, elevation]
    }
    if ((d.system && d.view === 'main') || (d.planetOrbits && !['system', 'host'].includes(d.view))) {
      const p = deepBody(d.view)!.pos
      return [Math.atan2(-p.x, -p.z) + 0.93, 0.24]
    }
    if (d.planetOrbits && d.view === 'system') return [0.59, 0.61]
    return [d.entry.id === 'vega' ? 0.31 : 0.59, d.view === 'system' ? 0.46 : 0.2]
  }
  function deepLimits(): [number, number] {
    return [
      deepTarget!.form ? 3.2 : Math.max(0.16, (deepBody(deepTarget!.view)?.r || 0.6) * 1.26),
      420,
    ]
  }
  function advanceDeepModel() {
    const d = deepTarget!,
      t = clock - d.start
    if (d.form) {
      d.root.rotation.y = t * 0.008
      return
    }
    for (const b of d.bodies) {
      b.mesh.rotation.y = 0.8 + t * (b.look ? 0.051 : d.system ? 0.082 : 0.05)
      const clouds = b.mesh.userData.clouds as T.Mesh | undefined
      if (clouds) clouds.rotation.y = t * 0.032
    }
    if (d.planetOrbits) {
      for (const track of d.planetOrbits)
        orbitalPosition(track.orbit, track.meanAtEpoch + t * track.radiansPerSecond, track.body.pos)
    } else if (d.system) {
      const a = 0.54 + (t * tau) / (18 + Math.log10(d.system.days + 1) * 11),
        r = d.system.axis
      const main = deepBody('main')!
      main.pos.set(r * Math.cos(a), 0, r * Math.sin(a))
      const tailPivot = main.mesh.userData.tailPivot as T.Group | undefined
      if (tailPivot) {
        tailPivot.position.copy(main.pos)
        tailPivot.rotation.y = Math.atan2(-main.pos.z, main.pos.x)
      }
    } else if (d.entry.id === 'sirius') {
      const a = t * 0.095 + 0.5
      deepBody('main')!.pos.set(-3.75 * Math.cos(a), 0, -3.75 * Math.sin(a))
      deepBody('companion')!.pos.set(8.4 * Math.cos(a), 0, 8.4 * Math.sin(a))
    }
    const seeOrbit =
      orbitMode === 'all' ||
      (orbitMode === 'smart' && (d.view === 'system' || zoom > deepDistance() * 1.36))
    for (const line of d.orbits) line.visible = seeOrbit
  }
  function deepBodyAt(x: number, y: number) {
    let closest = null,
      depth = Infinity
    for (const body of deepTarget!.bodies) {
      const q = project(body.pos)
      if (!q || q.z >= depth) continue
      if (Math.hypot(x - q.x, y - q.y) < Math.max(9, body.r * q.scale)) {
        closest = body
        depth = q.z
      }
    }
    return closest ? { obj: closest } : null
  }
  function renderDeepModel() {
    const d = deepTarget!
    d.background.position.copy(camera.position)
    if (d.sky) d.sky.position.copy(camera.position)
    d.scene.updateMatrixWorld()
    const cam = d.root.worldToLocal(camera.position.clone())
    if (d.volume) d.volume.material.uniforms.localEye.value.copy(cam)
    for (const field of d.fields) {
      field.material.uniforms.focal.value =
        (height * pixelRatio * 0.5) / Math.tan((camera.fov * rad) / 2)
      field.material.uniforms.localEye.value.copy(cam)
    }
    const markers = []
    for (const b of d.bodies) {
      if (b.key === d.view || !showNames) continue
      const q = project(b.pos)
      if (q && q.x >= 0 && q.x < width && q.y >= 0 && q.y < height)
        markers.push({ el: b.tag, q, r: b.r * q.scale })
    }
    for (const mark of d.landmarks) {
      if (!showNames) continue
      const q = project(d.root.localToWorld(mark[1].clone()))
      if (q) markers.push({ el: mark[2], q, r: 2 })
    }
    placeLabels(showNames ? markers : [], width, height)
    if (renderer) renderer.render(d.scene, camera)
    else drawDeepCanvas?.(d, width, height, pixelRatio, !!(pointers.size || playing || transition))
  }
  function disposeDeepModel(d: DeepModel) {
    for (const b of d.bodies) b.tag.remove()
    for (const mark of d.landmarks) mark[2].remove()
    d.root.traverse((node) => {
      if (node instanceof T.Mesh || node instanceof T.Line || node instanceof T.Points) {
        if (node.geometry !== sphere) node.geometry.dispose()
      }
      if (
        node instanceof T.Mesh ||
        node instanceof T.Sprite ||
        node instanceof T.Line ||
        node instanceof T.Points
      ) {
        for (const material of [node.material].flat()) material.dispose()
      }
    })
    d.scene.clear()
    placeLabels([], width, height)
    if (d.sky) d.sky.material.dispose()
  }
  function refreshDeepControls(lang: Locale = locale.value) {
    const d = deepTarget!
    if (d.planetOrbits) {
      ui.presets = [
        ['system', pick('全景', 'Overview', lang)],
        ['host', pick('母星', 'Star', lang)],
        ...d.planetOrbits.map(({ body }) => [body.key, body.key]),
      ]
      ui.preset = d.view
      ui.tracksDisabled = false
      ui.deepClass = pick('行星系统', 'Planetary system', lang)
      ui.title = deepBody(d.view)?.name ?? 'TRAPPIST-1'
      return
    }
    ui.title = lang === 'en' ? `${localizedEntry(d.entry, lang).title} · 3D View` : d.entry.title + '三维观测'
    const modes = d.form
      ? [
          ['oblique', pick('斜视', 'Oblique', lang)],
          ['top', pick('俯视', 'Face-On', lang)],
          ['edge', pick('侧视', 'Edge-On', lang)],
        ]
      : d.system
        ? [
            ['main', pick('行星特写', 'Planet View', lang)],
            ['system', pick('系统全景', 'System View', lang)],
          ]
        : d.entry.id === 'sirius'
          ? [
              ['system', pick('双星全景', 'Binary View', lang)],
              ['main', pick('天狼星 A', 'Sirius A', lang)],
              ['companion', pick('天狼星 B', 'Sirius B', lang)],
            ]
          : d.entry.id === 'vega'
            ? [
                ['main', pick('恒星特写', 'Star View', lang)],
                ['system', pick('尘埃盘', 'Debris Disk', lang)],
              ]
            : []
    ui.presets = modes
    ui.preset = d.view
    ui.deepClass =
      groupLabel(d.entry.group, lang) +
      ' · ' +
      (d.form
        ? pick('形态示意', '3D Morphology', lang)
        : d.system
          ? pick('外观示意', 'Concept Model', lang)
          : pick('结构示意', '3D Structure', lang))
    ui.tracksDisabled = !d.orbits.length
  }
  function deepPreset(mode: string) {
    const d = deepTarget
    if (!d) return
    d.view = mode
    advanceDeepModel()
    refreshDeepControls()
    aim()
    requestDraw()
  }
  function openDeepTarget(entry: ArchiveEntry, trappistView: 'e' | 'system' = 'e') {
    setDock(false)
    drawer(false)
    setNotes(false)
    if (deepTarget?.entry === entry) {
      if (deepTarget.planetOrbits) deepPreset(trappistView)
      canvas.focus({ preventScroll: true })
      return
    }
    if (deepTarget) disposeDeepModel(deepTarget)
    else returnCamera = { yaw, pitch, zoom, fit, pan: panOffset.clone() }
    const form = galaxyForms[entry.id],
      system = planetarySystems[entry.id]
    const d: DeepModel = {
      background: new T.Points(stars.geometry, stars.material),
      entry,
      form,
      system,
      view: form ? 'oblique' : 'main',
      start: clock,
      origin: v3(),
      scene: new T.Scene(),
      root: new T.Group(),
      fields: [],
      bodies: [],
      orbits: [],
      landmarks: [],
    }
    deepTarget = d
    d.scene.background = new T.Color(0x060b12)
    d.scene.add(d.root)
    ui.group = entry.group
    d.scene.add(d.background)
    if (!form && renderer) {
      d.sky = new T.Mesh(skyDome.geometry, createCosmicSkyMaterial(0.68))
      d.sky.frustumCulled = false
      d.sky.renderOrder = -10
      d.sky.rotation.copy(skyDome.rotation)
      d.scene.add(d.sky)
    }
    if (entry.id === trappistEntryId) {
      models.makeTrappistSystem(d)
      d.view = trappistView
    } else if (form) models.makeGalaxy(d)
    else if (system) models.makePlanetSystem(d)
    else models.makeStarSystem(d)

    placeLabels([], width, height)
    positionSkyTargets(null)
    pickables.length = 0
    solarMarker.hidden = true
    clearHoverState()
    canvas.title = ''
    ui.comet = null
    ui.deepEntry = entry
    advanceDeepModel()
    updateProjection()
    refreshDeepControls()
    aim(false)
    last = null
    canvas.focus({ preventScroll: true })
    requestDraw()
  }
  function leaveDeepTarget(restore: boolean) {
    if (!deepTarget) return
    if (notesOpen) setNotes(false)
    disposeDeepModel(deepTarget)
    deepTarget = null
    ui.deepEntry = null

    if (!galaxyView) {
      if (voyagerMode) syncVoyagerState(true)
      else if (newHorizonsMode) syncNewHorizonsState(true)
      else if (phenomenaMode) syncPhenomenaState(true)
      else modelStep(clock, focusMoon)
    }
    if (restore) {
      updateView()
      ui.group = '太阳系'
      transition = null
      yaw = returnCamera!.yaw
      pitch = returnCamera!.pitch
      panOffset.copy(returnCamera!.pan)
      fit = defaultDistance()
      zoom = clamp((returnCamera!.zoom * fit) / returnCamera!.fit, ...cameraLimits())
      last = null
      requestDraw()
    }
    returnCamera = null
  }
  function switchDeepTarget(offset: number) {
    const peers = catalogEntries.filter((e) => e.group === deepTarget!.entry.group)
    openDeepTarget(peers[(peers.indexOf(deepTarget!.entry) + offset + peers.length) % peers.length])
  }
  const observer = new ResizeObserver(() => {
    resize()
    requestDraw()
  })
  observer.observe(stage)
  document.addEventListener(
    'visibilitychange',
    () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      last = null
      if (!document.hidden) requestDraw()
    },
    { signal: listeners.signal },
  )
  modelStep(clock)
  boundaries.refreshLabels(locale.value)
  for (const id of voyagerIds) tracks[id].refreshLabels(locale.value)
  resize()
  aim(false)
  syncPaths()
  if (renderer && loadTexture) {
    bakeCosmicSky(renderer)
    loadTexture(sources.Sky, listeners.signal, {}, (texture) => {
      textures.Sky?.dispose()
      textures.Sky = texture
      setSkyTexture(texture)
      requestDraw()
    })
    // Submit shader programs together so the driver can compile them in parallel.
    renderer.compile(scene, camera)
  }
  setPlaying(playing)
  function dispose() {
    disposed = true
    excursion?.dispose()
    excursion = null
    listeners.abort()
    observer.disconnect()
    cancelAnimationFrame(frame)
    cancelAnimationFrame(hoverFrame)
    newHorizons?.dispose()
    if (deepTarget) {
      disposeDeepModel(deepTarget)
      deepTarget = null
    }
    galaxyImage.onload = null
    for (const im of Object.values(images)) im.onload = null
    detail.dispose()
    boundaries.dispose()
    oortBoundaries.dispose()
    phenomena.dispose()
    for (const id of voyagerIds) tracks[id].dispose()
    for (const { body } of cometTracks) body.disposeMaps()
    disposeSolarExtras()
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>()
    scene.traverse((node) => {
      if (node instanceof T.Mesh || node instanceof T.Points || node instanceof T.Line || node instanceof T.Sprite)
        geometries.add(node.geometry)
      if (node instanceof T.InstancedMesh) node.dispose()
      if (
        node instanceof T.Mesh ||
        node instanceof T.Points ||
        node instanceof T.Line ||
        node instanceof T.Sprite
      )
        for (const mat of [node.material].flat()) materials.add(mat)
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of Object.values(textures)) texture?.dispose()
    models.dispose()
    renderer?.dispose()
    // The atlas owns this canvas. Release the driver context and its internal fallback textures.
    renderer?.forceContextLoss()
    scene.clear()
    tags.replaceChildren()
    pins.replaceChildren()
  }
  function setLocale(lang: Locale) {
    localizeSkyLabels(lang)
    sun.name = pick('太阳', 'Sun', lang)
    sun.tag.textContent = sun.name
    for (const p of worlds) {
      p.tag.textContent = worldName(p, lang)
      for (const m of p.moons) {
        if (m.tag) m.tag.textContent = moonLabel(m, lang)
      }
    }
    if (focusMoon) selectedTag.textContent = moonLabel(focusMoon, lang)
    syncSolarMarker(lang)
    boundaries.refreshLabels(lang)
    oortBoundaries.refreshLabels(lang)
    phenomena.refreshLabels(lang)
    for (const id of voyagerIds) tracks[id].refreshLabels(lang)
    newHorizons?.refreshLabels(lang)
    if (voyagerMode) syncVoyagerState(false)
    if (newHorizonsMode) syncNewHorizonsState(false)
    if (phenomenaMode) syncPhenomenaState(false)
    if (deepTarget) {
      models.refreshLabels(deepTarget, lang)
      refreshDeepControls(lang)
    } else {
      ui.title = newHorizonsMode
        ? pick('新视野号', 'New Horizons', lang)
        : galaxyView
        ? pick('银河系', 'Milky Way', lang)
        : phenomenaMode
          ? phenomenonName(getPhenomenon(phenomenonId), lang)
          : voyagerMode
            ? missionName(ui.voyagerMode, lang)
            : focusMoon
              ? moonLabel(focusMoon, lang)
              : focusPlanet
                ? worldName(focusPlanet, lang)
                : focusRegion
                  ? regionLabel(focusRegion, lang)
                  : pick('太阳系', 'Solar System', lang)
    }
    if (focusComet && !deepTarget) ui.title = focusComet.el.textContent || focusComet.comet.en
    if (excursion && landingSite) {
      const nextName = landingSite.moon
        ? moonLabel(landingSite.moon, lang)
        : worldName(landingSite.world, lang)
      const nextRegion = landscapeRegion(landingSite.site.id, landingSite.site.kind, lang)
      excursion.status.name = nextName
      excursion.status.region = nextRegion
      ui.landing = { ...excursion.status }
    }
    const prevIdx = noteIndex
    refreshNotes()
    if (notesOpen && currentNotes.length) showNote(Math.min(prevIdx, currentNotes.length - 1))
    requestDraw()
  }
  return {
    planets,
    smallBodies,
    entries: catalogEntries,
    setLocale,
    land,
    takeOff,
    surfaceLook: (dx: number, dy: number) => excursion?.look(dx, dy),
    surfaceDrive: (f: number, r: number, h: number, v: number) => excursion?.drive(f, r, h, v),
    openPlanet,
    openMoon,
    openComet,
    openRegion,
    openGalaxy,
    openVoyager,
    openNewHorizons,
    setNewHorizonsYear,
    setNewHorizonsView,
    jumpNewHorizonsMilestone,
    setNewHorizonsPanel(el: HTMLElement | null) {
      if (newHorizonsPanel) observer.unobserve(newHorizonsPanel)
      newHorizonsPanel = el
      if (el) observer.observe(el)
      requestDraw()
    },
    setVoyagerOverlay,
    setVoyagerMode,
    setVoyagerFocus,
    setVoyagerPanel(el: HTMLElement | null) {
      if (voyagerPanel) observer.unobserve(voyagerPanel)
      voyagerPanel = el
      if (el) observer.observe(el)
      requestDraw()
    },
    setVoyagerYear,
    setVoyagerView,
    jumpVoyagerMilestone,
    openPhenomena,
    setPhenomenon,
    setPhenomenaYear,
    setPhenomenaView,
    jumpPhenomenaMilestone,
    setPhenomenaPanel(el: HTMLElement | null) {
      if (phenomenaPanel) observer.unobserve(phenomenaPanel)
      phenomenaPanel = el
      if (el) observer.observe(el)
      requestDraw()
    },
    openDeepTarget,
    openTrappistSystem: () => openDeepTarget(catalogEntries.find((entry) => entry.id === trappistEntryId)!, 'system'),
    deepPreset,
    switchDeepTarget,
    goBack: () =>
      deepTarget
        ? leaveDeepTarget(true)
        : voyagerMode || phenomenaMode || ui.newHorizons
          ? openPlanet(null)
          : openPlanet(focusMoon ? focusPlanet : null),
    visit: (entry: ArchiveEntry) => {
      if (entry.comet) return openComet(entry.comet.id)
      if (entry.object) {
        openPlanet(entry.object)
        if (entry.moon) openMoon(entry.moon)
      } else openDeepTarget(entry)
    },
    setDock,
    setNotes,
    showNote,
    drawer,
    preview,
    setPlaying,
    setOrbitMode,
    setShowComets(value: boolean) {
      ui.showComets = value
      if (!value) {
        hoveredCometTrack = null
        if (focusComet) {
          openPlanet(null)
          return
        }
      }
      syncPaths()
      requestDraw()
    },
    setCometOrbits(value: boolean) {
      ui.cometOrbits = value
      updateOrbitTargets()
      requestDraw()
    },
    seekCometPerihelion,
    setSpeed,
    setLabels,
    changeZoom,
    reset: () => {
      aim()
      requestDraw()
    },
    dispose,
  }
}
export type Atlas = ReturnType<typeof createAtlas>
