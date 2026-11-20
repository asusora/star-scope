import * as T from 'three'
import { createMapSynthesizer } from './mapSynthesizer'
import { assignMoonNames, declinations, featured, type createSolarSystem } from '../data/solar'
import { pick } from '../i18n'
import { worldName } from '../i18n/catalogEn'
import { createAsteroidBelts } from './belts'
import {
  buildDetailedBodyGeometry,
  buildMinorInstancedGeometry,
  getBodyDetailSpec,
  hasCustomShape,
  isProceduralDetailBody,
  synthesizeBodyMapsSync,
  type SynthesizedMaps,
} from './bodyDetail'
import {
  atmosphereSpec,
  createAtmosphereMesh,
  createCharikloRings,
  createChironComa,
  createChironRings,
  createEarthCloudsMaterial,
  createEnceladusPlumeMesh,
  createHaumeaRing,
  createMinorMoonMaterial,
  createQuaoarRings,
  createUranusRings,
  createVenusHazeMaterial,
  earthCloudRadius,
  planetMaterial,
  polarRatio,
  spinRate,
  ringInner,
  ringOuter,
  shadeSaturn,
} from './planetSurfaces'
import {
  cosmicSkyFragment,
  cosmicSkyVertex,
  dynamicStarsFragment,
  dynamicStarsVertex,
  shootingStarsFragment,
  shootingStarsVertex,
  sunCoronaFragment,
  sunCoronaVertex,
  sunSurfaceFragment,
  sunSurfaceVertex,
} from './shaders'
import type { Moon, World } from './types'
import { rad, tau, v3, seeded, orbit, orbitPoint, orbitalPosition, type Orbit } from './math'

export function createSolarModels(
  scene: T.Scene,
  webgl: boolean,
  textures: Record<string, T.Texture | null>,
  {
    worlds,
    planets,
    mainBand,
    hildaBand,
    centaurBands,
    outerBand,
    scatteredBand,
    oortBand,
  }: ReturnType<typeof createSolarSystem>,
  tag: (name: string, cls?: string) => HTMLSpanElement,
  requestDraw: () => void = () => {},
) {
  const synthesis = createMapSynthesizer()
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

  const spaceTime = { value: 0 }
  const starPixelRatio = { value: 1 }
  const skyMapUniform: { value: T.Texture | null } = { value: textures.Sky }
  const hasSkyMapUniform = { value: 0 }

  function createSunMaterial() {
    if (!webgl) {
      return new T.MeshBasicMaterial({ map: textures.Sun, color: new T.Color(1.26, 1.16, 0.96) })
    }
    return new T.ShaderMaterial({
      vertexShader: sunSurfaceVertex,
      fragmentShader: sunSurfaceFragment,
      uniforms: {
        uMap: { value: textures.Sun },
        uTime: spaceTime,
      },
    })
  }

  function globe(id: string, r: number) {
    const tex = textures[id] ?? null
    const needsProcMid =
      webgl &&
      id !== 'Sun' &&
      isProceduralDetailBody(id) &&
      (!tex || id === 'Ceres' || id === 'Vesta' || id === 'Pallas' || id === 'Juno' || id === 'Hygiea')
    const material =
      id === 'Sun'
        ? createSunMaterial()
        : planetMaterial(id, tex, id === 'Earth' ? { cloudMap: textures.Clouds } : undefined)
    if (needsProcMid && !tex && material instanceof T.MeshPhongMaterial) {
      const [br, bg, bb] = getBodyDetailSpec(id).baseColor
      material.color.setRGB(br, bg, bb)
    }
    const mesh = new T.Mesh(geometryFor(id, sphere), material)
    mesh.scale.set(r, r * polarRatio(id), r)
    if (needsProcMid) {
      midSynthesisQueue.push({ id, mesh })
    }
    return mesh
  }
  const orbitLayer = new T.Group()
  scene.add(orbitLayer)
  const orbitColors = {
    planet: 0x6f8eb0,
    small: 0x6b94b8,
    main: 0x9b8d72,
    trojan: 0xa68d64,
    centaur: 0x66a4ab,
    outer: 0x6b94b8,
    scattered: 0x8b86d0,
    moon: 0x7b98b2,
    focus: 0x67e4ff,
  }
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
    name: pick('太阳', 'Sun'),
    r: 8.4,
    pos: v3(),
    tag: tag(pick('太阳', 'Sun'), 'star'),
    mesh: globe('Sun', 8.4),
  }
  scene.add(sun.mesh)
  function makeSunCorona() {
    const outerRadius = sun.r * 5.2
    const coronaGeo = new T.SphereGeometry(1, 56, 36)
    const coronaMat = webgl
      ? new T.ShaderMaterial({
          vertexShader: sunCoronaVertex,
          fragmentShader: sunCoronaFragment,
          side: T.BackSide,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          blending: T.AdditiveBlending,
          uniforms: {
            uSunRadius: { value: sun.r },
            uOuterRadius: { value: outerRadius },
            uTime: spaceTime,
          },
        })
      : new T.MeshBasicMaterial({ visible: false })
    const mesh = new T.Mesh(coronaGeo, coronaMat)
    mesh.scale.setScalar(outerRadius)
    mesh.frustumCulled = false
    mesh.renderOrder = 1
    return mesh
  }
  const sunGlow = makeSunCorona()
  scene.add(sunGlow)

  function createCosmicSkyMaterial(opacity = 1) {
    return new T.ShaderMaterial({
      vertexShader: cosmicSkyVertex,
      fragmentShader: cosmicSkyFragment,
      side: T.BackSide,
      transparent: opacity < 1,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSkyMap: skyMapUniform,
        uHasSkyMap: hasSkyMapUniform,
        uTime: spaceTime,
        uOpacity: { value: opacity },
      },
    })
  }
  const skyDome = new T.Mesh(
    new T.SphereGeometry(3800, 48, 32),
    webgl
      ? createCosmicSkyMaterial(1)
      : new T.MeshBasicMaterial({
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

  const starRandom = seeded(918273)
  const spectralPalette: [number, number, number, number][] = [
    [0.18, 0.67, 0.84, 1.0], // O/B blue-white
    [0.42, 0.84, 0.92, 1.0], // A blue-white
    [0.70, 0.97, 0.98, 1.0], // F crisp white
    [0.86, 1.0, 0.93, 0.78], // G warm cream-gold
    [0.96, 1.0, 0.80, 0.58], // K soft amber
    [1.0, 1.0, 0.69, 0.54], // M gentle coral
  ]
  function sampleStarColor(r: () => number): [number, number, number] {
    const roll = r()
    for (const [cutoff, cr, cg, cb] of spectralPalette) {
      if (roll <= cutoff) return [cr, cg, cb]
    }
    return [0.97, 0.98, 1.0]
  }
  const galacticQuat = new T.Quaternion().setFromEuler(skyDome.rotation)

  function makeStarField(count: number, minRadius: number, maxRadius: number, galacticBias: number) {
    const coords = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const twinkles = new Float32Array(count * 3)
    const heroes = new Float32Array(count)
    const dir = v3()

    for (let i = 0; i < count; i++) {
      const inBand = starRandom() < galacticBias
      const theta = starRandom() * tau
      let y: number
      if (inBand) {
        // Concentrated smoothly along the Milky Way plane
        y = (starRandom() + starRandom() + starRandom() - 1.5) * 0.38
        y = Math.max(-0.98, Math.min(0.98, y))
      } else {
        y = starRandom() * 2 - 1
      }
      const flat = Math.sqrt(Math.max(0, 1 - y * y))
      dir.set(Math.cos(theta) * flat, y, Math.sin(theta) * flat)
      if (inBand) dir.applyQuaternion(galacticQuat)

      const dist = minRadius + (maxRadius - minRadius) * Math.cbrt(starRandom())
      const i3 = i * 3
      coords[i3] = dir.x * dist
      coords[i3 + 1] = dir.y * dist
      coords[i3 + 2] = dir.z * dist

      const [cr, cg, cb] = sampleStarColor(starRandom)
      const tier = starRandom()
      let size: number
      let hero = 0
      let brightness: number
      if (tier < 0.76) {
        size = 1.45 + starRandom() * 1.45
        brightness = 0.42 + starRandom() * 0.48
      } else if (tier < 0.955) {
        size = 2.9 + starRandom() * 2.2
        brightness = 0.68 + starRandom() * 0.32
      } else {
        size = 5.4 + starRandom() * 5.8
        brightness = 0.88 + starRandom() * 0.12
        hero = 0.45 + starRandom() * 0.55
      }
      colors[i3] = cr * brightness
      colors[i3 + 1] = cg * brightness
      colors[i3 + 2] = cb * brightness
      sizes[i] = size
      heroes[i] = hero

      twinkles[i3] = starRandom() * tau
      twinkles[i3 + 1] = 0.72 + starRandom() * 2.15
      twinkles[i3 + 2] = (hero > 0 ? 0.22 : 0.14) + starRandom() * 0.30
    }

    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(coords, 3))
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new T.BufferAttribute(sizes, 1))
    geometry.setAttribute('aTwinkle', new T.BufferAttribute(twinkles, 3))
    geometry.setAttribute('aHero', new T.BufferAttribute(heroes, 1))

    const material = webgl
      ? new T.ShaderMaterial({
          vertexShader: dynamicStarsVertex,
          fragmentShader: dynamicStarsFragment,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
          uniforms: {
            uTime: spaceTime,
            uPixelRatio: starPixelRatio,
            uOpacity: { value: 0.96 },
          },
        })
      : new T.PointsMaterial({
          size: 1.25,
          vertexColors: true,
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          sizeAttenuation: false,
        })
    const pts = new T.Points(geometry, material)
    pts.frustumCulled = false
    pts.renderOrder = -8
    return pts
  }

  // Primary infinite celestial sphere (shared with galaxy & deep-sky views)
  const stars = makeStarField(5200, 3200, 3200, 0.34)
  scene.add(stars)

  // World-space 3D parallax star shell around the solar system (well outside Sedna & Inner Oort Cloud)
  const parallaxStars = makeStarField(950, 1150, 3100, 0.18)
  scene.add(parallaxStars)

  // Occasional subtle deep-space shooting star ribbons on the distant celestial sphere
  function makeShootingStars(count: number) {
    const startDirs = new Float32Array(count * 4 * 3)
    const tangents = new Float32Array(count * 4 * 3)
    const timings = new Float32Array(count * 4 * 4)
    const corners = new Float32Array(count * 4 * 2)
    const tints = new Float32Array(count * 4 * 3)
    const positions = new Float32Array(count * 4 * 3)
    const indices: number[] = []
    const up = v3(0, 1, 0)
    const alt = v3(1, 0, 0)
    const sDir = v3()
    const tA = v3()
    const tB = v3()
    const move = v3()

    const quadCorners: [number, number][] = [
      [0, -1],
      [0, 1],
      [1, 1],
      [1, -1],
    ]

    for (let i = 0; i < count; i++) {
      const th = starRandom() * tau
      const sy = starRandom() * 1.5 - 0.75
      const sr = Math.sqrt(Math.max(0.01, 1 - sy * sy))
      sDir.set(Math.cos(th) * sr, sy, Math.sin(th) * sr).normalize()
      tA.crossVectors(sDir, Math.abs(sDir.y) > 0.85 ? alt : up).normalize()
      tB.crossVectors(sDir, tA).normalize()
      const heading = starRandom() * tau
      move.copy(tA).multiplyScalar(Math.cos(heading)).addScaledVector(tB, Math.sin(heading)).normalize()

      const cycle = 15 + starRandom() * 14
      const phase = (i / count) * cycle + starRandom() * 3.5
      const duration = 0.78 + starRandom() * 0.45
      const arc = 0.085 + starRandom() * 0.075
      const [tr, tg, tb] = starRandom() < 0.7 ? [0.68, 0.90, 1.0] : [1.0, 0.92, 0.78]

      const baseV = i * 4
      for (let v = 0; v < 4; v++) {
        const vi = baseV + v
        sDir.toArray(startDirs, vi * 3)
        move.toArray(tangents, vi * 3)
        positions[vi * 3] = sDir.x * 2950
        positions[vi * 3 + 1] = sDir.y * 2950
        positions[vi * 3 + 2] = sDir.z * 2950
        timings[vi * 4] = phase
        timings[vi * 4 + 1] = cycle
        timings[vi * 4 + 2] = duration
        timings[vi * 4 + 3] = arc
        corners[vi * 2] = quadCorners[v][0]
        corners[vi * 2 + 1] = quadCorners[v][1]
        tints[vi * 3] = tr
        tints[vi * 3 + 1] = tg
        tints[vi * 3 + 2] = tb
      }
      indices.push(baseV, baseV + 1, baseV + 2, baseV, baseV + 2, baseV + 3)
    }

    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
    geometry.setAttribute('aStartDir', new T.BufferAttribute(startDirs, 3))
    geometry.setAttribute('aTangent', new T.BufferAttribute(tangents, 3))
    geometry.setAttribute('aTiming', new T.BufferAttribute(timings, 4))
    geometry.setAttribute('aCorner', new T.BufferAttribute(corners, 2))
    geometry.setAttribute('aTint', new T.BufferAttribute(tints, 3))
    geometry.setIndex(indices)

    const material = webgl
      ? new T.ShaderMaterial({
          vertexShader: shootingStarsVertex,
          fragmentShader: shootingStarsFragment,
          side: T.DoubleSide,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
          uniforms: { uTime: spaceTime },
        })
      : new T.MeshBasicMaterial({ visible: false })
    const mesh = new T.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.renderOrder = -7
    return mesh
  }
  const shootingStars = makeShootingStars(6)
  scene.add(shootingStars)

  function updateSpaceTime(timeSec: number, dpr: number) {
    spaceTime.value = timeSec
    starPixelRatio.value = dpr
  }
  function setSkyTexture(tex: T.Texture) {
    skyMapUniform.value = tex
    hasSkyMapUniform.value = 1
    if (!webgl && skyDome.material instanceof T.MeshBasicMaterial) {
      skyDome.material.map = tex
      skyDome.material.needsUpdate = true
    }
  }
  const {
    belt,
    beltDust,
    hildaDust,
    trojanDust,
    centaurDust,
    neptuneTrojanDust,
    kuiper,
    kuiperDust,
    scatteredDust,
    oortDust,
    setBeltsVisible,
    updateBeltVisibility,
    stepBelts,
    disposeBelts,
  } = createAsteroidBelts(
    scene,
    webgl,
    {
      mainBand,
      hildaBand,
      centaurBands,
      outerBand,
      scatteredBand,
      oortBand,
      jupiterA: planets[4].a,
      neptuneA: planets[7].a,
    },
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
    Queta: 0x5c5b5e,
    Menoetius: 0x765a4d,
    Vanth: 0x7d584d,
    Weywot: 0x8e6b5e,
    Xiangliu: 0x824c44,
    Dysnomia: 0x989ca2,
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
  minorGeo.computeBoundingSphere()
  const minorShape = minorGeo.boundingSphere!
  const minorRadius = minorShape.center.length() + minorShape.radius
  const matrix = new T.Matrix4()
  const localScale = v3()
  const zeroScale = v3(0, 0, 0)
  const ownedRingTextures: T.Texture[] = []
  function attachMinorRing(p: World, ringMesh: T.Mesh) {
    p.minorRings = ringMesh
    ringMesh.renderOrder = 3
    p.axis.add(ringMesh)
    const mat = ringMesh.material
    if (mat instanceof T.MeshBasicMaterial && mat.map) ownedRingTextures.push(mat.map)
  }
  for (const p of worlds) {
    p.pos = v3()
    p.orbit = orbit(p.a, p.e, p.inc, p.node, p.peri || 0)
    p.phase -= p.node * rad
    p.path = pathFor(
      [p.orbit],
      p.region ? orbitColors[p.region] : orbitColors.planet,
      p.region === 'scattered' || p.region === 'outer' ? 320 : 280,
    )
    orbitLayer.add(p.path)
    p.anchor = new T.Group()
    scene.add(p.anchor)
    p.axis = new T.Group()
    p.axis.rotation.z = -(declinations[p.id] ?? 0) * rad
    p.anchor.add(p.axis)
    p.mesh = globe(p.id, p.r)
    p.axis.add(p.mesh)
    p.tag = tag(worldName(p))
    if (p.id === 'Haumea') {
      p.mesh.scale.multiply(v3(1.36, 0.69, 1.06))
      if (webgl) attachMinorRing(p, createHaumeaRing(p.r, p.axis))
    }
    if (p.id === 'Chariklo' && webgl) {
      attachMinorRing(p, createCharikloRings(p.r, p.axis))
    }
    if (p.id === 'Chiron' && webgl) {
      attachMinorRing(p, createChironRings(p.r, p.axis))
      p.coma = createChironComa(p.r, sphere)
      p.anchor.add(p.coma)
    }
    if (p.id === 'Quaoar' && webgl) {
      attachMinorRing(p, createQuaoarRings(p.r, p.axis))
    }
    if (p.id === 'Saturn') {
      const rings = saturnRings(p.r)
      rings.renderOrder = 3
      p.rings = rings
      shadeSaturn(p.mesh.material as T.MeshPhongMaterial, rings.material, p.axis, p.r)
      p.axis.add(rings)
    }
    if (p.id === 'Uranus' && webgl) {
      attachMinorRing(p, createUranusRings(p.r, p.axis))
    }
    if (p.id === 'Earth') {
      p.clouds = new T.Mesh(sphere, createEarthCloudsMaterial(textures.Clouds))
      p.clouds.scale.copy(p.mesh.scale).multiplyScalar(earthCloudRadius)
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
      p.instances.boundingSphere = new T.Sphere(v3(), 0)
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
      else if (m.name === 'Menoetius') m.r = p.r * 0.9
      else if (m.name === 'Vanth') m.r = p.r * 0.48
      else if (m.name === 'Dysnomia') m.r = p.r * 0.26
      else if (m.name === 'Weywot' || m.name === 'Xiangliu') m.r = p.r * 0.14
      else if (m.name === 'Queta') m.r = p.r * 0.16
      const rank = minA === maxA ? 1 : Math.log(m.a / minA) / Math.log(maxA / minA)
      const edge =
        p.id === 'Saturn'
          ? m.a * (1 - m.e) > 142000
            ? 2.33
            : 1.82
          : p.id === 'Quaoar'
            ? 3.55
            : p.id === 'Haumea'
              ? 1.4
              : p.id === 'Patroclus'
                ? 2.1
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
        // Bound the entire orbit and every spin orientation, even while the clock is running.
        const bound = p.instances!.boundingSphere!
        const apoapsis = m.orbit.a * (1 + m.orbit.e)
        bound.radius = Math.max(bound.radius, apoapsis + minorRadius * m.r * Math.max(...m.aspect))
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
    cancelActiveMid = synthesis.run(spec, 256, 128, {
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
    'Menoetius',
    'Vanth',
    'Weywot',
    'Xiangliu',
    'Dysnomia',
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
    const jupLon = Math.atan2(-planets[4].pos.z, planets[4].pos.x)
    const nepLon = Math.atan2(-planets[7].pos.z, planets[7].pos.x)
    stepBelts(clock, jupLon, nepLon)
  }
  function disposeSolarExtras() {
    midQueueDisposed = true
    synthesis.dispose()
    cancelActiveMid?.()
    cancelActiveMid = null
    minorRockMaps?.dispose()
    disposeBelts()
    for (const tex of ownedRingTextures) tex.dispose()
    ownedRingTextures.length = 0
    for (const maps of ownedMidMaps) maps.dispose()
    ownedMidMaps.length = 0
  }

  return {
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
    kuiper,
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
  }
}
