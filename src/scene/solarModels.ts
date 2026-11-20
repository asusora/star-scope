import * as T from 'three'
import { assignMoonNames, declinations, featured, type createSolarSystem } from '../data/solar'
import { createAsteroidBelts } from './belts'
import {
  buildDetailedBodyGeometry,
  buildMinorInstancedGeometry,
  getBodyDetailSpec,
  hasCustomShape,
  isProceduralDetailBody,
  synthesizeBodyMapsAsync,
  synthesizeBodyMapsSync,
  type SynthesizedMaps,
} from './bodyDetail'
import {
  atmosphereSpec,
  createAtmosphereMesh,
  createEarthCloudsMaterial,
  createEnceladusPlumeMesh,
  createHaumeaRing,
  createMinorMoonMaterial,
  createUranusRings,
  createVenusHazeMaterial,
  planetMaterial,
  polarRatio,
  spinRate,
  ringInner,
  ringOuter,
  shadeSaturn,
} from './planetSurfaces'
import type { Moon, World } from './types'
import { rad, tau, v3, seeded, orbit, orbitPoint, orbitalPosition, type Orbit } from './math'

export function createSolarModels(
  scene: T.Scene,
  webgl: boolean,
  textures: Record<string, T.Texture | null>,
  { worlds, planets, mainBand, outerBand }: ReturnType<typeof createSolarSystem>,
  tag: (name: string, cls?: string) => HTMLSpanElement,
  requestDraw: () => void = () => {},
) {
  const random = seeded(18474)
  const sphere = new T.SphereGeometry(1, 72, 48)
  const moonGeometry = new T.SphereGeometry(1, 64, 44)
  const sculptedGeometries = new Map<string, T.BufferGeometry>()
  function geometryFor(id: string, fallback: T.BufferGeometry) {
    if (!hasCustomShape(id)) return fallback
    let geo = sculptedGeometries.get(id)
    if (!geo) {
      geo = buildDetailedBodyGeometry(id, 'mid')
      sculptedGeometries.set(id, geo)
    }
    return geo
  }
  const midSynthesisQueue: { id: string; mesh: T.Mesh }[] = []
  const ownedMidMaps: SynthesizedMaps[] = []
  let cancelActiveMid: (() => void) | null = null
  let midQueueDisposed = false

  function globe(id: string, r: number) {
    const material =
      id === 'Sun'
        ? new T.MeshBasicMaterial({ map: textures.Sun, color: new T.Color(1.38, 1.28, 1.06) })
        : planetMaterial(
            id,
            textures[id],
            id === 'Earth' ? { cloudMap: textures.Clouds } : undefined,
          )
    const mesh = new T.Mesh(geometryFor(id, sphere), material)
    mesh.scale.set(r, r * polarRatio(id), r)
    if (
      webgl &&
      (id === 'Ceres' || id === 'Vesta' || id === 'Pallas' || id === 'Juno' || id === 'Hygiea')
    ) {
      midSynthesisQueue.push({ id, mesh })
    }
    return mesh
  }
  const orbitLayer = new T.Group()
  scene.add(orbitLayer)
  const orbitColors = { planet: 0x8794a4, small: 0x92a7b7, moon: 0x90a0ad, focus: 0xffc482 }
  const planetDiscs = planets.map(() => v3(0, 0, -1))
  function pathFor(orbits: Orbit[], color: number, steps = 144, host: World | null = null) {
    const vertices = new Float32Array(orbits.length * steps * 3),
      indices = [],
      point = v3()
    for (const [row, o] of orbits.entries()) {
      const start = row * steps
      for (let i = 0; i < steps; i++) {
        orbitPoint(o, (tau * i) / steps, point).toArray(vertices, (start + i) * 3)
        if (orbits.length > 1) indices.push(start + i, start + ((i + 1) % steps))
      }
    }
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(vertices, 3))
    const material = new T.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    // Orbit annotations leave unrelated planetary silhouettes clear even when
    // distant bodies overlap in projection. Real objects keep their depth test.
    if (host && webgl) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.planetDiscs = { value: planetDiscs }
        shader.uniforms.hostIndex = { value: planets.indexOf(host) }
        shader.fragmentShader =
          'uniform vec3 planetDiscs[8]; uniform int hostIndex;\n' +
          shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            '#include <clipping_planes_fragment>\nfor(int i=0;i<8;i++){vec3 disc=planetDiscs[i];if(i!=hostIndex && disc.z>0. && distance(gl_FragCoord.xy,disc.xy)<disc.z)discard;}',
          )
      }
      material.customProgramCacheKey = () => 'satellite-orbit-mask'
    }
    let path
    if (indices.length) {
      geometry.setIndex(indices)
      path = new T.LineSegments(geometry, material)
    } else path = new T.LineLoop(geometry, material)
    path.visible = false
    path.userData.steps = steps
    path.userData.targetOpacity = 0
    return path
  }
  scene.add(new T.AmbientLight(0xd2deff, 0.28))
  scene.add(new T.PointLight(0xfff5df, 2.55, 0, 0))
  const sun = {
    id: 'Sun',
    name: '太阳',
    r: 8.4,
    pos: v3(),
    tag: tag('太阳', 'star'),
    mesh: globe('Sun', 8.4),
  }
  scene.add(sun.mesh)
  function makeGlow() {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const k = c.getContext('2d')!,
      grad = k.createRadialGradient(128, 128, 0, 128, 128, 128)
    for (const [stop, color] of [
      [0, 'rgba(255,249,214,1)'],
      [0.17, 'rgba(255,213,120,.86)'],
      [0.25, 'rgba(255,165,53,.52)'],
      [0.42, 'rgba(255,137,40,.18)'],
      [0.68, 'rgba(247,117,37,.055)'],
      [1, 'rgba(240,91,22,0)'],
    ] as const)
      grad.addColorStop(stop, color)
    k.fillStyle = grad
    k.fillRect(0, 0, 256, 256)
    const tex = new T.CanvasTexture(c)
    tex.colorSpace = T.SRGBColorSpace
    const sprite = new T.Sprite(
      new T.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    )
    sprite.scale.setScalar(sun.r * 8.4)
    return sprite
  }
  const sunGlow = makeGlow()
  scene.add(sunGlow)
  const skyDome = new T.Mesh(
    new T.SphereGeometry(2600, 40, 24),
    new T.MeshBasicMaterial({
      map: textures.Sky,
      side: T.BackSide,
      color: 0x8996a9,
      depthWrite: false,
      fog: false,
    }),
  )
  skyDome.rotation.set(0.4, 1.7, -0.47)
  skyDome.renderOrder = -10
  scene.add(skyDome)
  function makeBackgroundStars(count: number) {
    const coords = [],
      colors = []
    for (let i = 0; i < count; i++) {
      const theta = random() * tau
      const y = random() * 2 - 1,
        r = 2100 * Math.sqrt(1 - y * y)
      coords.push(Math.cos(theta) * r, y * 2100, Math.sin(theta) * r)
      const shade = 0.35 + random() * 0.65
      colors.push(shade, shade * 0.96, shade)
    }
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.Float32BufferAttribute(coords, 3))
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
    const material = new T.PointsMaterial({
      size: 1.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.71,
      depthWrite: false,
      sizeAttenuation: false,
    })
    return new T.Points(geometry, material)
  }
  const stars = makeBackgroundStars(1400)
  scene.add(stars)
  const { belt, beltDust, kuiper, kuiperDust, stepBelts, disposeBelts } = createAsteroidBelts(
    scene,
    webgl,
    mainBand,
    outerBand,
    textures.Rock,
  )
  function saturnRings(r: number) {
    const inner = r * ringInner,
      outer = r * ringOuter,
      g = new T.RingGeometry(inner, outer, 384, 8)
    const uv = g.attributes.uv,
      pos = g.attributes.position
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5)
    g.rotateX(-Math.PI / 2)
    return new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        map: textures.Ring,
        side: T.DoubleSide,
        transparent: true,
        alphaTest: 0.003,
        depthWrite: false,
        color: 0xffffff,
      }),
    )
  }
  const majorColors: Record<string, number> = {
    Io: 0xe9c765,
    Europa: 0xe2d5c1,
    Ganymede: 0xb5ada2,
    Callisto: 0x8b8174,
    Titan: 0xe8a85a,
    Enceladus: 0xeaf4f8,
    Rhea: 0xd0d4d8,
    Dione: 0xd4d8dc,
    Tethys: 0xdce0e4,
    Mimas: 0xc8ccd0,
    Iapetus: 0xb6aa9a,
    Ariel: 0xd4dce2,
    Titania: 0xc2c8ce,
    Oberon: 0xaea8a2,
    Umbriel: 0x8a8c90,
    Miranda: 0xc4ccd2,
    Triton: 0xdfd3cb,
    Charon: 0xb8b2ac,
    Phobos: 0xab9684,
    Deimos: 0xb1a291,
  }
  const moonSurfaces: Record<string, string> = {
    Moon: 'Moon',
    Io: 'Volcanic',
    Europa: 'Icy',
    Enceladus: 'Icy',
    Rhea: 'Icy',
    Dione: 'Icy',
    Tethys: 'Icy',
    Mimas: 'Icy',
    Ariel: 'Icy',
    Triton: 'Icy',
    Titan: 'Haze',
  }
  const minorRockMaps = webgl
    ? synthesizeBodyMapsSync(getBodyDetailSpec('__minor_rock__', 'Jupiter'), 256, 128, 4)
    : null
  const minorMaterial = webgl
    ? createMinorMoonMaterial(minorRockMaps?.albedo ?? textures.Rock, minorRockMaps?.normal ?? null)
    : new T.MeshLambertMaterial({ color: 0xffffff, map: textures.Rock })
  const minorGeo = buildMinorInstancedGeometry()
  const matrix = new T.Matrix4()
  const localScale = v3()
  const zeroScale = v3(0, 0, 0)
  for (const p of worlds) {
    p.pos = v3()
    p.orbit = orbit(p.a, p.e, p.inc, p.node, p.peri || 0)
    p.phase -= p.node * rad
    p.path = pathFor([p.orbit], p.region ? orbitColors.small : orbitColors.planet, 280)
    orbitLayer.add(p.path)
    p.anchor = new T.Group()
    scene.add(p.anchor)
    p.axis = new T.Group()
    p.axis.rotation.z = -(declinations[p.id] ?? (p.id === 'Pluto' ? 119.6 : 0)) * rad
    p.anchor.add(p.axis)
    p.mesh = globe(p.id, p.r)
    p.axis.add(p.mesh)
    p.tag = tag(p.name)
    if (p.id === 'Haumea') {
      p.mesh.scale.multiply(v3(1.36, 0.69, 1.06))
      if (webgl) {
        p.minorRings = createHaumeaRing(p.r, p.axis)
        p.minorRings.renderOrder = 3
        p.axis.add(p.minorRings)
      }
    }
    if (p.id === 'Saturn') {
      const rings = saturnRings(p.r)
      rings.renderOrder = 3
      p.rings = rings
      shadeSaturn(p.mesh.material as T.MeshPhongMaterial, rings.material, p.axis, p.r)
      p.axis.add(rings)
    }
    if (p.id === 'Uranus' && webgl) {
      p.minorRings = createUranusRings(p.r, p.axis)
      p.minorRings.renderOrder = 3
      p.axis.add(p.minorRings)
    }
    if (p.id === 'Earth') {
      p.clouds = new T.Mesh(sphere, createEarthCloudsMaterial(textures.Clouds))
      p.clouds.scale.copy(p.mesh.scale).multiplyScalar(1.0055)
      p.clouds.renderOrder = 1
      p.axis.add(p.clouds)
    }
    if (p.id === 'Venus' && webgl) {
      p.haze = new T.Mesh(sphere, createVenusHazeMaterial(textures.Haze))
      p.haze.scale.copy(p.mesh.scale).multiplyScalar(1.007)
      p.haze.renderOrder = 1
      p.axis.add(p.haze)
    }
    const atmo = atmosphereSpec(p.id)
    if (atmo && webgl) {
      p.atmosphere = createAtmosphereMesh(atmo, p.r, polarRatio(p.id), sphere)
      p.axis.add(p.atmosphere)
    }
    const minA = Math.min(...p.moons.map((m) => m.a)),
      maxA = Math.max(...p.moons.map((m) => m.a))
    p.moonTracks = new T.Group()
    orbitLayer.add(p.moonTracks)
    const major = featured[p.id] || p.moons.map((m) => m.name)
    const minor = p.moons.filter((m) => !major.includes(m.name))
    if (minor.length) {
      p.instances = new T.InstancedMesh(minorGeo, minorMaterial, minor.length)
      p.instances.frustumCulled = false
      p.instances.instanceMatrix.setUsage(T.DynamicDrawUsage)
      p.anchor.add(p.instances)
    }
    let instance = 0
    for (const m of p.moons) {
      assignMoonNames(p, m)
      m.pos = v3()
      m.world = v3()
      m.phase = random() * tau
      m.featured = major.includes(m.name)
      m.r =
        p.r *
        (m.name === 'Moon'
          ? 0.267
          : m.featured
            ? m.name === 'Titan' || m.name === 'Triton'
              ? 0.145
              : 0.076
            : 0.016 + random() * 0.009)
      if (m.name === 'Charon') m.r = p.r * 0.51
      const rank = minA === maxA ? 1 : Math.log(m.a / minA) / Math.log(maxA / minA)
      const edge =
        p.id === 'Saturn'
          ? m.a * (1 - m.e) > 142000
            ? 2.33
            : 1.82
          : p.id === 'Haumea'
            ? 1.4
            : 1.16
      const inner = p.r * edge + m.r * 1.25,
        outer = p.extent - m.r * 1.25
      const e = Math.min(m.e, 0.34, (0.98 * (outer - inner)) / (outer + inner))
      const a = ((1 - rank) * inner) / (1 - e) + (rank * outer) / (1 + e)
      m.orbit = orbit(a, e, m.inc, m.node, m.w, m.frame === 'ecliptic' ? null : p.axis.quaternion)
      m.omega = tau / (18 * Math.pow(m.period || 0.475, 0.31))
      if (m.featured) {
        const surface = moonSurfaces[m.name] || 'Rock'
        const color =
          surface === 'Rock' || surface === 'Icy' ? majorColors[m.name] || 0xe3e3e3 : 0xffffff
        const mat = planetMaterial(m.name, textures[surface], { color })
        const geo = geometryFor(m.name, moonGeometry)
        m.mesh = new T.Mesh(geo, mat)
        m.mesh.scale.setScalar(m.r)
        const moonAtmo = atmosphereSpec(m.name)
        if (moonAtmo && webgl) {
          m.atmosphere = createAtmosphereMesh(moonAtmo, 1, 1, moonGeometry)
          m.mesh.add(m.atmosphere)
        }
        if (m.name === 'Enceladus' && webgl) {
          m.plume = createEnceladusPlumeMesh()
          m.mesh.add(m.plume)
        }
        p.anchor.add(m.mesh)
        if (webgl && m.name !== 'Moon' && isProceduralDetailBody(m.name)) {
          midSynthesisQueue.push({ id: m.name, mesh: m.mesh })
        }
      } else {
        m.instance = instance++
        const minorSpec = getBodyDetailSpec(m.name, p.id, m.a)
        m.aspect = minorSpec.scaleXYZ
        const az = random() * tau
        const ay = random() * 2 - 1
        const ar = Math.sqrt(Math.max(0, 1 - ay * ay))
        m.spinAxis = v3(Math.cos(az) * ar, ay, Math.sin(az) * ar).normalize()
        m.spinPhase = random() * tau
        m.spinRate = (0.08 + random() * 0.26) * (random() < 0.5 ? 1 : -1)
        m.quat = new T.Quaternion().setFromAxisAngle(m.spinAxis, m.spinPhase)
        const [br, bg, bb] = minorSpec.baseColor
        // Normalize tint slightly upward since minorRockMaps already has mid-grey rock albedo
        const lift = 1.48
        p.instances!.setColorAt(
          m.instance,
          new T.Color().setRGB(
            Math.min(1, br * lift),
            Math.min(1, bg * lift),
            Math.min(1, bb * lift),
          ),
        )
      }
    }
    if (p.instances?.instanceColor) p.instances.instanceColor.needsUpdate = true
  }

  // Progressively synthesize dedicated 256×128 overview textures & normal maps for
  // featured moons and main-belt asteroids in small time slices without blocking first paint.
  let midQueueIndex = 0
  function runMidQueue() {
    if (midQueueDisposed || midQueueIndex >= midSynthesisQueue.length) return
    const item = midSynthesisQueue[midQueueIndex++]
    const spec = getBodyDetailSpec(item.id)
    const mat = item.mesh.material as T.MeshPhongMaterial
    cancelActiveMid = synthesizeBodyMapsAsync(spec, 256, 128, {
      includeSpecular: spec.baseGloss > 0.12 || (spec.iceGlossBoost ?? 0) > 0.2,
      maxAnisotropy: 4,
      budgetMs: 5,
      onDone: (maps) => {
        cancelActiveMid = null
        if (midQueueDisposed) {
          maps.dispose()
          return
        }
        ownedMidMaps.push(maps)
        mat.userData.midMaps = maps
        if (!mat.userData.detailActive) {
          mat.color.setHex(0xffffff)
          mat.map = maps.albedo
          mat.bumpMap = null
          mat.normalMap = maps.normal
          const nScale = spec.titanBands ? 0.25 : 0.92
          mat.normalScale.set(nScale, nScale)
          if (maps.specular) mat.specularMap = maps.specular
          if (maps.emissive) mat.emissiveMap = maps.emissive
          mat.needsUpdate = true
          requestDraw()
        }
        runMidQueue()
      },
    })
  }
  if (webgl && midSynthesisQueue.length) {
    window.setTimeout(runMidQueue, 120)
  }

  const spinRates = worlds.map((p) => spinRate(p.id))
  const tidallyLockedMoons = new Set([
    'Moon',
    'Io',
    'Europa',
    'Ganymede',
    'Callisto',
    'Titan',
    'Enceladus',
    'Rhea',
    'Dione',
    'Tethys',
    'Mimas',
    'Iapetus',
    'Ariel',
    'Umbriel',
    'Titania',
    'Oberon',
    'Miranda',
    'Triton',
    'Proteus',
    'Charon',
    'Phobos',
    'Deimos',
    'Hiʻiaka',
  ])
  function writeMinorInstance(p: World, m: Moon) {
    if (m.instance === undefined || !p.instances) return
    if (m.detailHidden) {
      matrix.compose(m.pos, m.quat!, zeroScale)
    } else {
      const [ax, ay, az] = m.aspect!
      localScale.set(m.r * ax, m.r * ay, m.r * az)
      matrix.compose(m.pos, m.quat!, localScale)
    }
    p.instances.setMatrixAt(m.instance, matrix)
  }
  function syncMinorInstance(m: Moon) {
    if (m.instance === undefined || !m.parent.instances) return
    writeMinorInstance(m.parent, m)
    m.parent.instances.instanceMatrix.needsUpdate = true
  }
  function modelStep(clock: number) {
    sun.mesh.rotation.y = clock * 0.045
    stepBelts(clock)
    for (const [index, p] of worlds.entries()) {
      orbitalPosition(p.orbit, p.phase + (clock * tau) / (100 * (p.days / 365.26) ** 0.32), p.pos)
      p.anchor.position.copy(p.pos)
      p.moonTracks.position.copy(p.pos)
      p.mesh.rotation.y = 1.15 + clock * spinRates[index]
      if (p.clouds) {
        p.clouds.rotation.y = 1.16 + clock * 0.158
        const earthShift = (p.mesh.material as T.MeshPhongMaterial).userData.earthCloudShift as
          | { value: number }
          | undefined
        if (earthShift) earthShift.value = (p.clouds.rotation.y - p.mesh.rotation.y) / tau
      }
      if (p.haze) p.haze.rotation.y = 1.15 + clock * 0.068
      for (const m of p.moons) {
        orbitalPosition(m.orbit, m.phase + clock * m.omega, m.pos)
        m.world.copy(m.pos).add(p.pos)
        if (m.mesh) {
          m.mesh.position.copy(m.pos)
          m.mesh.rotation.y = tidallyLockedMoons.has(m.name)
            ? Math.atan2(m.pos.z, -m.pos.x)
            : clock * 0.1
        } else {
          m.quat!.setFromAxisAngle(m.spinAxis!, m.spinPhase! + clock * m.spinRate!)
          writeMinorInstance(p, m)
        }
      }
      if (p.instances) p.instances.instanceMatrix.needsUpdate = true
    }
  }
  function disposeSolarExtras() {
    midQueueDisposed = true
    cancelActiveMid?.()
    cancelActiveMid = null
    minorRockMaps?.dispose()
    disposeBelts()
    for (const maps of ownedMidMaps) maps.dispose()
    ownedMidMaps.length = 0
  }

  return {
    sun,
    sunGlow,
    stars,
    belt,
    beltDust,
    kuiper,
    kuiperDust,
    skyDome,
    sphere,
    orbitLayer,
    orbitColors,
    planetDiscs,
    pathFor,
    modelStep,
    syncMinorInstance,
    disposeSolarExtras,
  }
}
