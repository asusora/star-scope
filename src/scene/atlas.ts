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
import { sources, thumbs } from '../data/assets'
import { createSolarSystem } from '../data/solar'
import { createPlanetDetail, type PlanetBody } from './planetDetail'
import { createPlanetCanvas } from './planetCanvas'
import { createSolarModels } from './solarModels'
import { createTextureUploads } from './textureUploads'
import { createLabels } from './labels'
import { createArchive, jplFacts, moonSources } from '../data/archive'
import { createDeepModels, galaxyForms, planetarySystems } from './deepModels'
import { createDeepCanvasRenderer } from './deepCanvas'
import type { DeepModel } from './deepTypes'
import { rad, tau, v3, seeded, clamp } from './math'
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
    oortBand,
    bandMid,
  } = solarSystem
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(45, 1, 0.012, 9500)
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
    setBeltsVisible,
    updateBeltVisibility,
    skyDome,
    createCosmicSkyMaterial,
    updateSpaceTime,
    setSkyTexture,
    sphere,
    orbitLayer,
    orbitColors,
    planetDiscs,
    pathFor,
    modelStep,
    syncMinorInstance,
    disposeSolarExtras,
  } = createSolarModels(scene, !!renderer, textures, solarSystem, tag, requestDraw)
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
    const preferredBody = focusMoon
      ? (bodyByMoon.get(focusMoon) ?? getMinorDetailBody(focusMoon))
      : focusPlanet
        ? (bodyByWorld.get(focusPlanet) ?? null)
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
    focusPlanet: World | null = null,
    focusMoon: Moon | null = null,
    focusRegion: Belt | null = null,
    smallVisible = false,
    clock = 0,
    playing = ui.playing,
    speed = 1
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
    return deepTarget
      ? deepCenter()
      : focusMoon
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
    if (galaxyView)
      return Math.max(424, 196 * Math.sqrt(1 + 1 / (camera.aspect * 0.4142) ** 2) * 1.06)
    if (focusMoon) return Math.max(0.24, focusMoon.r * 5.8) * narrow
    if (focusPlanet) {
      const p = focusPlanet
      if (!p.moons.length) return p.r * 5.7 * narrow
      return p.extent * 2.85 * narrow
    }
    if (focusRegion) {
      const distByRegion: Record<Belt, number> = {
        main: 64,
        trojan: 72,
        centaur: 88,
        outer: 132,
        scattered: 225,
      }
      return distByRegion[focusRegion] * narrow
    }
    return fullSystemDistance()
  }
  function defaultAngles() {
    if (deepTarget) return deepAngles()
    if (galaxyView) return [0.2, 0.92]
    if (!focusPlanet) return [0.13, width < 600 ? 0.83 : 0.53]
    const p = focusPlanet
    return [Math.atan2(-p.pos.x, -p.pos.z) + 0.66, focusMoon ? 0.23 : 0.31]
  }
  function cameraLimits(): [number, number] {
    if (deepTarget) return deepLimits()
    if (galaxyView) return [88, Math.max(1100, defaultDistance() * 2)]
    const size = focusMoon ? focusMoon.r : focusPlanet ? focusPlanet.r : 0.12
    return [Math.max(0.032, size * 1.55), Math.max(1800, fullSystemDistance() * 3.8)]
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
      const f = clamp((now - transition.t) / 880, 0, 1),
        k = f * f * (3 - 2 * f),
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
    camera.rotateZ(deepTarget ? deepTarget.form?.roll || 0 : focusPlanet ? -0.025 : -0.105)
    camera.updateMatrixWorld()
    skyDome.position.copy(camera.position)
    stars.position.copy(camera.position)
    shootingStars.position.copy(camera.position)
  }
  function updateProjection() {
    const offset = deepTarget
      ? height * (width < 700 ? 0.045 : 0.025)
      : focusPlanet
        ? 0
        : height * (galaxyView ? 0.037 : width < 600 ? 0.025 : 0.112)
    camera.setViewOffset(width, height, 0, offset, width, height)
  }
  function resize() {
    const box = stage.getBoundingClientRect()
    const w = Math.max(1, Math.round(box.width))
    const h = Math.max(1, Math.round(box.height))
    const ratio = Math.min(devicePixelRatio || 1, 1.75)
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
    for (const p of worlds) {
      const active = p === host
      const preview = orbitMode === 'smart' && p === hoveredBody && p.anchor.visible
      let opacity = 0
      if (enabled) {
        if (active || preview) opacity = 0.52
        else if (all) opacity = p.region ? 0.19 : 0.31
        else if (focusRegion && p.region === focusRegion) opacity = 0.18
        else if (!p.region) opacity = detail ? 0.08 : 0.31
      }
      p.path.material.color.setHex(
        active || preview
          ? orbitColors.focus
          : p.region
            ? orbitColors[p.region]
            : orbitColors.planet,
      )
      setOrbitOpacity(p.path, opacity, now)
      // All satellite loops for a host share a draw call. Build them on first use.
      if (all && enabled && p.moons.length && !p.allMoonPaths) {
        p.allMoonPaths = pathFor(
          p.moons.map((m) => m.orbit),
          orbitColors.moon,
          144,
          p,
        )
        p.moonTracks.add(p.allMoonPaths)
      }
      if (p.allMoonPaths) setOrbitOpacity(p.allMoonPaths, all && enabled ? 0.21 : 0, now)
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
    if (focusPlanet || focusRegion || galaxyView || zoom > fullSystemDistance() * 0.6) return null
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
    orbitLayer.visible = !galaxyView
    updateOrbitTargets()
    setBeltsVisible(!galaxyView)
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
  function labelsAndTargets() {
    pickables.length = 0
    const markers: Label[] = []
    if (galaxyView) {
      placeLabels(showNames ? markers : [], width, height)
      return
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
        object !== focusPlanet
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
        } else if (p === focusPlanet && !focusMoon && m.featured) {
          const text = moonLabel(m)
          if (!m.tag) m.tag = tag(text)
          else if (m.tag.textContent !== text) m.tag.textContent = text
          if (!m.tag.isConnected) tags.append(m.tag)
          markers.push({ el: m.tag, q, r })
        }
      }
    }
    placeLabels(showNames ? markers : [], width, height)
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
      name: '离散盘与内奥尔特云',
      region: 'scattered',
      p: v3(-0.62, 0, -0.78).normalize().multiplyScalar(bandMid(scatteredBand)),
      body: '海王星 50 AU 之外是高倾角、大偏心率的离散盘，以及延伸至数百至上千 AU 的分离天体区与内奥尔特云。共工星、阋神星、远极星（约 132 AU）与深红矮行星赛德娜（远日点 937 AU）均分布于此。',
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
        if (deepTarget || focusPlanet || (galaxyView && i === 0)) return
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
  function openGalaxy() {
    if (deepTarget) leaveDeepTarget(true)
    if (galaxyView) return
    if (!galaxyImage.src) galaxyImage.src = sources.Galaxy
    galaxyView = true
    focusPlanet = null
    focusMoon = null
    focusRegion = null
    setDock(false)
    drawer(false)
    updateView(true)
  }
  // This renderer keeps the same three-dimensional positions and camera when WebGL is unavailable.
  function drawCanvas() {
    if (!ctx) return
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
    }
    drawCanvasOrbits()
    const entries: { q: ScreenPoint; r: number; key: string | null; tint?: string }[] = []
    function entry(pos: T.Vector3, r: number, key: string | null, tint?: string) {
      const q = project(pos)
      if (!q) return
      const screenR = Math.min(q.scale * r, width * 3)
      if (q.x + screenR < 0 || q.x - screenR > width || q.y + screenR < 0 || q.y - screenR > height)
        return
      entries.push({ q, r: screenR, key, tint })
    }
    entry(sun.pos, sun.r, 'Sun')
    for (const p of worlds) {
      if (!p.anchor.visible) continue
      entry(p.pos, p.r, p.id)
      for (const m of p.moons)
        entry(m.world, m.r, m.name, m.featured ? '#cdbb9f' : '#83959e')
    }
    entries.sort((a, b) => b.q.z - a.q.z)
    for (const { q, r, key, tint } of entries) {
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
    rowPreview: World | Moon | null = null
  function updateOrbitPreview() {
    let body = null,
      host = null
    if (!galaxyView && orbitMode === 'smart') {
      body = rowPreview || (hoverPoint ? bodyAt(hoverPoint.x, hoverPoint.y)?.obj : null) || null
      host = smartHost()
    }
    if (body === hoveredBody && host === nearbyHost) return
    hoveredBody = body
    nearbyHost = host
    updateOrbitTargets()
  }
  function render(now: number) {
    updateSpaceTime(ambientTime, pixelRatio)
    if (deepTarget) {
      if (nearBody) updateSurfaceDetail()
      advanceDeepModel()
      moveCamera(now)
      renderDeepModel()
      return
    }
    moveCamera(now)
    updateSmallBodyDetail()
    updateSurfaceDetail()
    updateOrbitMasks()
    labelsAndTargets()
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
    if (excursion || deepTarget || galaxyView || focusRegion) return
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
    ambientTime = 0,
    lastAmbientDraw = 0
  function tick(now: number) {
    frame = 0
    if (document.hidden) return
    const delta = last === null ? 0 : Math.min((now - last) / 1000, 0.12)
    last = now
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
        else modelStep(clock)
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
    const activeMotion = playing || dirty || !!transition || fadingPaths.size > 0
    if (activeMotion) {
      dirty = false
      lastAmbientDraw = now
      render(now)
    } else if (renderer && !orbitMotion.matches && now - lastAmbientDraw >= 33) {
      // Keep distant stars gently twinkling and solar plasma flowing even when orbital clock is paused
      lastAmbientDraw = now
      updateSpaceTime(ambientTime, pixelRatio)
      renderer.render(deepTarget ? deepTarget.scene : scene, camera)
    }
    const keepLoop =
      playing ||
      !!transition ||
      fadingPaths.size > 0 ||
      zoomTarget !== null ||
      (!!renderer && !orbitMotion.matches)
    if (!frame && keepLoop) frame = requestAnimationFrame(tick)
  }
  function requestDraw() {
    if (disposed) return
    dirty = true
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick)
  }
  const pointerRay = new T.Raycaster(),
    ecliptic = new T.Plane(v3(0, 1, 0), 0)
  function screenRay(x: number, y: number) {
    pointerRay.setFromCamera(new T.Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera)
    return pointerRay.ray
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
  function beltAt(x: number, y: number): { id: Belt; pos: T.Vector3 } | null {
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
    }
    pointerRay.params.Points.threshold = clamp((zoom * 2) / height, 0.12, 1.2)
    const dust = pointerRay.intersectObjects<T.Points>(
      [beltDust, hildaDust, trojanDust, centaurDust, neptuneTrojanDust, kuiperDust, scatteredDust, oortDust],
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
      const box = canvas.getBoundingClientRect(),
        x = point.x - box.left,
        y = point.y - box.top
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
  let tapStart: Point | null = null,
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
  canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal: listeners.signal })
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 && e.button !== 2) return
      hoverPoint = null
      requestDraw()
      canvas.style.cursor = ''
      canvas.setPointerCapture(e.pointerId)
      canvas.focus({ preventScroll: true })
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      canvas.classList.add('dragging')
      panDrag = e.button === 2 || e.shiftKey
      tapStart = pointers.size === 1 && !panDrag ? { x: e.clientX, y: e.clientY } : null
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
          const box = canvas.getBoundingClientRect(),
            x = e.clientX - box.left,
            y = e.clientY - box.top
          hoverPoint = { x, y }
          requestDraw()
          const object = (deepTarget ? deepBodyAt(x, y) : bodyAt(x, y))?.obj,
            region = object || deepTarget ? null : beltAt(x, y)
          const caption = object
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
      hoverPoint = null
      requestDraw()
    },
    { signal: listeners.signal },
  )
  function finishPointer(e: PointerEvent, cancel: boolean) {
    if (!pointers.has(e.pointerId)) return
    const wasTap = !cancel && tapStart && pointers.size === 1
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
    playing = ui.playing = value
    last = null
    requestDraw()
  }
  function setSpeed(value: number) {
    speed = ui.speed = value
  }
  function setOrbitMode(mode: OrbitMode) {
    orbitMode = ui.orbitMode = mode
    updateOrbitTargets()
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
    rowPreview = null
    hoverPoint = null
    hoveredBody = null
    nearbyHost = null
    ui.galaxy = galaxyView
    ui.planet = focusPlanet
    ui.moon = focusMoon
    ui.region = focusRegion
    ui.deepEntry = null
    ui.title = galaxyView
      ? pick('银河系', 'Milky Way')
      : focusMoon
        ? moonLabel(focusMoon)
        : focusPlanet
          ? worldName(focusPlanet)
          : focusRegion
            ? regionLabel(focusRegion)
            : pick('太阳系', 'Solar System')
    ui.tracksDisabled = galaxyView
    refreshNotes()
    syncPaths()
    aim(!changeScale, !changeScale && keepDirection)
    requestDraw()
    if (changeScale && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas.animate([{ opacity: 0.24 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' })
    }
  }
  function openPlanet(p: World | null) {
    if (deepTarget) leaveDeepTarget(false)
    ui.group = '太阳系'
    const leavingGalaxy = galaxyView
    galaxyView = false
    focusPlanet = p
    focusMoon = null
    focusRegion = null
    setDock(false)
    drawer(false)
    ui.search = ''
    if (leavingGalaxy) modelStep(clock)
    updateView(leavingGalaxy, false)
  }
  function openMoon(m: Moon) {
    if (focusPlanet !== m.parent || galaxyView) openPlanet(m.parent)
    focusPlanet = m.parent
    focusMoon = m
    focusRegion = null
    if (width < 620) drawer(false)
    updateView(false, false)
  }
  function openRegion(id: Belt, at?: T.Vector3) {
    if (deepTarget) leaveDeepTarget(false)
    ui.group = '太阳系'
    const wasGalactic = galaxyView
    galaxyView = false
    focusRegion = id
    focusMoon = null
    focusPlanet = null
    if (wasGalactic) modelStep(clock)
    const anchorIds: Record<Belt, string> = {
      main: 'Ceres',
      trojan: 'Patroclus',
      centaur: 'Chariklo',
      outer: 'Pluto',
      scattered: 'Gonggong',
    }
    const anchorBody =
      smallBodies.find((p) => p.id === anchorIds[id]) || smallBodies.find((p) => p.region === id)!
    regionCenter.copy(at || anchorBody.pos)
    setDock(false)
    ui.search = ''
    updateView(wasGalactic, true)
    drawer(true)
  }
  const catalogEntries = createArchive(worlds)
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
    if (d.system && d.view === 'main') {
      const p = deepBody('main')!.pos
      return [Math.atan2(-p.x, -p.z) + 0.93, 0.24]
    }
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
    for (const b of d.bodies)
      b.mesh.rotation.y = 0.8 + t * (b.look ? 0.051 : d.system ? 0.082 : 0.05)
    if (d.system) {
      const a = 0.54 + (t * tau) / (18 + Math.log10(d.system.days + 1) * 11),
        r = d.system.axis
      const main = deepBody('main')!
      main.pos.set(r * Math.cos(a), 0, r * Math.sin(a))
      const clouds = main.mesh.userData.clouds as T.Mesh | undefined
      if (clouds) clouds.rotation.y = t * 0.032
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
  function openDeepTarget(entry: ArchiveEntry) {
    setDock(false)
    drawer(false)
    setNotes(false)
    if (deepTarget?.entry === entry) {
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
      d.sky.renderOrder = -10
      d.sky.rotation.copy(skyDome.rotation)
      d.scene.add(d.sky)
    }
    if (form) models.makeGalaxy(d)
    else if (system) models.makePlanetSystem(d)
    else models.makeStarSystem(d)

    placeLabels([], width, height)
    pickables.length = 0
    solarMarker.hidden = true
    hoverPoint = null
    canvas.title = ''
    ui.deepEntry = entry
    ui.title =
      locale.value === 'en'
        ? `${localizedEntry(entry, 'en').title} · 3D View`
        : entry.title + '三维观测'
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

    if (!galaxyView) modelStep(clock)
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
  resize()
  aim(false)
  syncPaths()
  if (renderer && loadTexture) {
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
    if (deepTarget) {
      disposeDeepModel(deepTarget)
      deepTarget = null
    }
    galaxyImage.onload = null
    for (const im of Object.values(images)) im.onload = null
    detail.dispose()
    disposeSolarExtras()
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>()
    scene.traverse((node) => {
      if (node instanceof T.Mesh || node instanceof T.Points || node instanceof T.Line)
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
    scene.clear()
    tags.replaceChildren()
    pins.replaceChildren()
  }
  function setLocale(lang: Locale) {
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
    if (deepTarget) {
      models.refreshLabels(deepTarget, lang)
      refreshDeepControls(lang)
      ui.title =
        lang === 'en'
          ? `${localizedEntry(deepTarget.entry, 'en').title} · 3D View`
          : deepTarget.entry.title + '三维观测'
    } else {
      ui.title = galaxyView
        ? pick('银河系', 'Milky Way', lang)
        : focusMoon
          ? moonLabel(focusMoon, lang)
          : focusPlanet
            ? worldName(focusPlanet, lang)
            : focusRegion
              ? regionLabel(focusRegion, lang)
              : pick('太阳系', 'Solar System', lang)
    }
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
    openRegion,
    openGalaxy,
    openDeepTarget,
    deepPreset,
    switchDeepTarget,
    goBack: () => (deepTarget ? leaveDeepTarget(true) : openPlanet(focusMoon ? focusPlanet : null)),
    visit: (entry: ArchiveEntry) => {
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
