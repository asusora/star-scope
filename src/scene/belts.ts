import * as T from 'three'
import { createBeltInstances, rockStride } from './beltInstances'
import { seeded, tau } from './math'
import { getBodyDetailSpec, synthesizeBodyMapsSync, type SynthesizedMaps } from './bodyDetail'

export interface BandRange {
  inner: number
  outer: number
}

export interface BeltLayout {
  mainBand: BandRange
  hildaBand: BandRange
  centaurBands: {
    jupSat: BandRange
    satUra: BandRange
    uraNep: BandRange
    full: BandRange
  }
  outerBand: BandRange
  scatteredBand: BandRange
  oortBand: BandRange
  jupiterA: number
  neptuneA: number
}

interface AsteroidPrototypeSpec {
  seed: number
  scaleXYZ: [number, number, number]
  roughness: number
  facetStrength: number
  bilobed: number
  craterCount: number
  segments: [number, number]
}

// Fast 3D hash/noise helpers local to belt prototype sculpting
function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let n =
    (Math.imul(ix, 374761393) +
      Math.imul(iy, 668265263) +
      Math.imul(iz, 2147483647) +
      Math.imul(seed, 1597334677)) |
    0
  n = (n ^ (n >>> 13)) | 0
  n = Math.imul(n, 1274126177) | 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const uz = fz * fz * (3 - 2 * fz)
  const n000 = hash3(ix, iy, iz, seed)
  const n100 = hash3(ix + 1, iy, iz, seed)
  const n010 = hash3(ix, iy + 1, iz, seed)
  const n110 = hash3(ix + 1, iy + 1, iz, seed)
  const n001 = hash3(ix, iy, iz + 1, seed)
  const n101 = hash3(ix + 1, iy, iz + 1, seed)
  const n011 = hash3(ix, iy + 1, iz + 1, seed)
  const n111 = hash3(ix + 1, iy + 1, iz + 1, seed)
  const nx00 = n000 + (n100 - n000) * ux
  const nx10 = n010 + (n110 - n010) * ux
  const nx01 = n001 + (n101 - n001) * ux
  const nx11 = n011 + (n111 - n011) * ux
  return nx00 + (nx10 - nx00) * uy + (nx01 + (nx11 - nx01) * uy - (nx00 + (nx10 - nx00) * uy)) * uz
}

function buildAsteroidPrototype(spec: AsteroidPrototypeSpec): T.SphereGeometry {
  const rand = seeded(spec.seed)
  const geo = new T.SphereGeometry(1, spec.segments[0], spec.segments[1])
  const pos = geo.attributes.position

  const craters: { cx: number; cy: number; cz: number; r: number; d: number }[] = []
  for (let i = 0; i < spec.craterCount; i++) {
    const z = rand() * 2 - 1
    const a = rand() * tau
    const rr = Math.sqrt(Math.max(0, 1 - z * z))
    const r = 0.24 + rand() * 0.3
    craters.push({
      cx: Math.cos(a) * rr,
      cy: z,
      cz: Math.sin(a) * rr,
      r,
      d: r * (0.24 + rand() * 0.14),
    })
  }

  const facets: { nx: number; ny: number; nz: number; cut: number }[] = []
  if (spec.facetStrength > 0) {
    const count = 9
    for (let i = 0; i < count; i++) {
      const z = rand() * 2 - 1
      const a = rand() * tau
      const rr = Math.sqrt(Math.max(0, 1 - z * z))
      facets.push({
        nx: Math.cos(a) * rr,
        ny: z,
        nz: Math.sin(a) * rr,
        cut: 0.72 + rand() * 0.16,
      })
    }
  }

  const [sx, sy, sz] = spec.scaleXYZ
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i)
    const ny = pos.getY(i)
    const nz = pos.getZ(i)
    const n1 = noise3(nx * 2.2 + 3.1, ny * 2.2 - 1.7, nz * 2.2 + 4.9, spec.seed) - 0.5
    const n2 = noise3(nx * 4.5 - 2.3, ny * 4.5 + 3.8, nz * 4.5 - 1.4, spec.seed + 71) - 0.5
    const ridge = 1 - Math.abs(noise3(nx * 3.4, ny * 3.4, nz * 3.4, spec.seed + 137) * 2 - 1)
    let disp = 1 + spec.roughness * (n1 * 1.6 + n2 * 0.7 + (ridge - 0.5) * 0.85)

    if (spec.bilobed > 0) {
      disp *= 1 - spec.bilobed * Math.exp(-nx * nx * 7.2)
    }

    if (facets.length) {
      let flat = 0
      for (let f = 0; f < facets.length; f++) {
        const fp = facets[f]
        const d = nx * fp.nx + ny * fp.ny + nz * fp.nz
        if (d > fp.cut) {
          const ex = d - fp.cut
          flat += ex * ex
        }
      }
      disp -= flat * spec.facetStrength * 4.8
    }

    for (let c = 0; c < craters.length; c++) {
      const cr = craters[c]
      const dot = nx * cr.cx + ny * cr.cy + nz * cr.cz
      if (dot < Math.cos(cr.r * 1.45)) continue
      const q = Math.acos(Math.min(1, dot)) / cr.r
      if (q < 1.0) {
        disp -= cr.d * (1 - q * q)
      } else if (q < 1.45) {
        const rq = (q - 1.06) / 0.19
        disp += cr.d * 0.28 * Math.exp(-rq * rq)
      }
    }

    disp = Math.max(0.45, disp)
    pos.setXYZ(i, nx * disp * sx, ny * disp * sy, nz * disp * sz)
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * GPU-driven instanced material for realistic 3D belt asteroids, Trojans, Centaurs, KBOs & Scattered Disc bodies.
 * Each instance orbits smoothly prograde (counter-clockwise from north ecliptic pole) and tumbles
 * on its own spin axis with zero per-frame CPU matrix updates.
 */
function createBeltRockMaterial(
  map: T.Texture | null,
  normalMap: T.Texture | null,
  clockUniform: { value: number },
  angleOffsetUniform: { value: number },
  icy: boolean,
  cacheKey: string,
) {
  const material = new T.MeshPhongMaterial({
    color: 0xffffff,
    map,
    normalMap,
    vertexColors: true,
    specular: icy ? 0x2a3a4a : 0x0d0b0a,
    shininess: icy ? 24 : 9,
  })
  if (normalMap) {
    material.normalScale.set(icy ? 0.95 : 1.18, icy ? 0.95 : 1.18)
  } else if (map) {
    material.bumpMap = map
    material.bumpScale = 0.045
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBeltClock = clockUniform
    shader.uniforms.uAngleOffset = angleOffsetUniform
    shader.vertexShader =
      `
      attribute vec4 aOrbit;
      attribute vec4 aSpin;
      attribute vec4 aScaleTilt;
      uniform float uBeltClock;
      uniform float uAngleOffset;
      ` +
      shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `
          #include <beginnormal_vertex>
          float _bSpinAng = aOrbit.z * 3.71 + uBeltClock * aSpin.w;
          float _bCs = cos(_bSpinAng);
          float _bSn = sin(_bSpinAng);
          vec3 _bAx = aSpin.xyz;
          objectNormal = normalize(objectNormal / aScaleTilt.xyz);
          objectNormal = objectNormal * _bCs + cross(_bAx, objectNormal) * _bSn + _bAx * dot(_bAx, objectNormal) * (1.0 - _bCs);
          `,
        )
        .replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float _bOrbAng = aOrbit.z + uBeltClock * aOrbit.w + uAngleOffset;
          vec3 _bCenter = vec3(
            cos(_bOrbAng) * aOrbit.x,
            sin(_bOrbAng + aScaleTilt.w) * aOrbit.y,
            -sin(_bOrbAng) * aOrbit.x
          );
          vec3 _bScaled = transformed * aScaleTilt.xyz;
          transformed = _bScaled * _bCs + cross(_bAx, _bScaled) * _bSn + _bAx * dot(_bAx, _bScaled) * (1.0 - _bCs) + _bCenter;
          `,
        )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `
      #include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= ${icy ? '0.32' : '0.26'};
      #if NUM_POINT_LIGHTS > 0
        vec3 _rSun = normalize(pointLights[0].position + vViewPosition);
        vec3 _rView = normalize(vViewPosition);
        float _rNdotL = max(0.0, dot(nonPerturbedNormal, _rSun));
        float _rMu = max(0.0, dot(nonPerturbedNormal, _rView));
        float _rLs = 1.38 / (_rNdotL + _rMu + 0.44);
        reflectedLight.directDiffuse *= mix(1.0, _rLs, ${icy ? '0.24' : '0.44'});
        ${
          icy
            ? 'float _rRim = pow(1.0 - _rMu, 3.2) * smoothstep(-0.15, 0.5, _rNdotL); reflectedLight.directDiffuse += vec3(0.45, 0.68, 0.92) * _rRim * 0.12;'
            : ''
        }
      #endif
      `,
    )
  }
  material.customProgramCacheKey = () => cacheKey
  return material
}

/**
 * Soft, circular, distance-attenuated distant dust micro-grains that fade smoothly
 * when the camera flies in close (so close-up views only show crisp 3D sculpted rocks).
 */
function createBeltDustMaterial(
  clockUniform: { value: number },
  angleOffsetUniform: { value: number },
  baseSize: number,
  opacity: number,
  fadeNear: number,
  fadeFar: number,
  additive: boolean,
) {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? T.AdditiveBlending : T.NormalBlending,
    uniforms: {
      uBeltClock: clockUniform,
      uAngleOffset: angleOffsetUniform,
      uSize: { value: baseSize },
      uOpacity: { value: opacity },
      uFadeNear: { value: fadeNear },
      uFadeFar: { value: fadeFar },
    },
    vertexShader: `
      attribute vec3 color;
      attribute vec4 aOrbit;
      attribute float aIncPhase;
      attribute float aSizeMul;
      uniform float uBeltClock;
      uniform float uAngleOffset;
      uniform float uSize;
      uniform float uFadeNear;
      uniform float uFadeFar;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float ang = aOrbit.z + uBeltClock * aOrbit.w + uAngleOffset;
        vec3 worldPos = vec3(
          cos(ang) * aOrbit.x,
          sin(ang + aIncPhase) * aOrbit.y,
          -sin(ang) * aOrbit.x
        );
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        float dist = max(0.01, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        float closeFade = smoothstep(uFadeNear, uFadeFar, dist);
        float ptSize = clamp(uSize * aSizeMul * (320.0 / dist), 1.35, 5.2);
        gl_PointSize = ptSize;
        vColor = color;
        vAlpha = closeFade;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 >= 1.0) discard;
        float soft = exp(-2.6 * r2) * (1.0 - smoothstep(0.52, 1.0, r2));
        float alpha = soft * uOpacity * vAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  })
}

interface SampledParticle {
  r: number
  phase0: number
  omega: number
  yAmp: number
  incPhase: number
  rgb: [number, number, number]
  dustRgb: [number, number, number]
  sizeMul: number
}

function buildCustomBeltField(options: {
  seed: number
  rockCounts: [number, number, number]
  dustCount: number
  prototypes: [T.SphereGeometry, T.SphereGeometry, T.SphereGeometry]
  rockMaterial: T.Material
  clockUniform: { value: number }
  angleOffsetUniform: { value: number }
  baseSize: number
  dustOpacity: number
  fadeNear: number
  fadeFar: number
  additiveDust: boolean
  rockSizeRange: [number, number]
  webgl: boolean
  sample: (rand: () => number) => SampledParticle
}) {
  const {
    seed,
    rockCounts,
    dustCount,
    prototypes,
    rockMaterial,
    clockUniform,
    angleOffsetUniform,
    baseSize,
    dustOpacity,
    fadeNear,
    fadeFar,
    additiveDust,
    rockSizeRange,
    webgl,
    sample,
  } = options
  const rand = seeded(seed)
  const group = new T.Group()
  const batches: ReturnType<typeof createBeltInstances>[] = []

  if (webgl) {
    for (let pIdx = 0; pIdx < 3; pIdx++) {
      const count = rockCounts[pIdx]
      if (count <= 0) continue
      const rocks = new Float32Array(count * rockStride)
      for (let i = 0; i < count; i++) {
        const s = sample(rand)
        const sz = rand() * 2 - 1
        const sa = rand() * tau
        const sr = Math.sqrt(Math.max(0, 1 - sz * sz))
        const spinSpeed = (0.12 + rand() * 0.52) * (rand() < 0.5 ? 1 : -1)

        const sizeT = rand() ** 2.4
        const baseRad = (rockSizeRange[0] + sizeT * (rockSizeRange[1] - rockSizeRange[0])) * s.sizeMul
        const sx = baseRad * (0.86 + rand() * 0.42)
        const sy = baseRad * (0.68 + rand() * 0.36)
        const szScale = baseRad * (0.78 + rand() * 0.38)

        const offset = i * rockStride
        rocks.set(
          [
            s.r,
            s.yAmp,
            s.phase0,
            s.omega,
            Math.cos(sa) * sr,
            sz,
            Math.sin(sa) * sr,
            spinSpeed,
            sx,
            sy,
            szScale,
            s.incPhase,
            s.rgb[0],
            s.rgb[1],
            s.rgb[2],
          ],
          offset,
        )
      }
      const batch = createBeltInstances(prototypes[pIdx], rockMaterial, rocks)
      batches.push(batch)
      group.add(batch.full, batch.distant)
    }
  }

  const dustPos = new Float32Array(dustCount * 3)
  const dustCol = new Float32Array(dustCount * 3)
  const dustOrbit = new Float32Array(dustCount * 4)
  const dustIncPhase = new Float32Array(dustCount)
  const dustSizeMul = new Float32Array(dustCount)

  for (let i = 0; i < dustCount; i++) {
    const s = sample(rand)
    const i3 = i * 3
    dustPos[i3] = Math.cos(s.phase0) * s.r
    dustPos[i3 + 1] = Math.sin(s.phase0 + s.incPhase) * s.yAmp
    dustPos[i3 + 2] = -Math.sin(s.phase0) * s.r

    dustCol[i3] = s.dustRgb[0]
    dustCol[i3 + 1] = s.dustRgb[1]
    dustCol[i3 + 2] = s.dustRgb[2]

    const i4 = i * 4
    dustOrbit[i4] = s.r
    dustOrbit[i4 + 1] = s.yAmp
    dustOrbit[i4 + 2] = s.phase0
    dustOrbit[i4 + 3] = s.omega
    dustIncPhase[i] = s.incPhase
    dustSizeMul[i] = (0.65 + rand() * 0.9) * s.sizeMul
  }

  const dustGeo = new T.BufferGeometry()
  dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3))
  dustGeo.setAttribute('color', new T.BufferAttribute(dustCol, 3))
  dustGeo.setAttribute('aOrbit', new T.BufferAttribute(dustOrbit, 4))
  dustGeo.setAttribute('aIncPhase', new T.BufferAttribute(dustIncPhase, 1))
  dustGeo.setAttribute('aSizeMul', new T.BufferAttribute(dustSizeMul, 1))

  const dustMat = webgl
    ? createBeltDustMaterial(
        clockUniform,
        angleOffsetUniform,
        baseSize,
        dustOpacity,
        fadeNear,
        fadeFar,
        additiveDust,
      )
    : new T.PointsMaterial({
        size: baseSize * 0.14,
        vertexColors: true,
        transparent: true,
        opacity: dustOpacity,
        depthWrite: false,
      })

  const dustPoints = new T.Points(dustGeo, dustMat)
  dustPoints.frustumCulled = false
  group.add(dustPoints)

  return { group, dustPoints, batches }
}

/**
 * Serene, gossamer 3D Inner Oort / Hills Cloud halo surrounding Sedna & 2012 VP113.
 * Transitions smoothly from a flared inner Hills disc (445..580) to a sparse 3D spherical comet shell (560..710).
 */
function buildOortHalo(
  band: BandRange,
  clockUniform: { value: number },
  webgl: boolean,
) {
  const rand = seeded(903771)
  const count = 2600
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const orb = new Float32Array(count * 4)
  const incPhase = new Float32Array(count)
  const sizeMul = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const isOuterShell = rand() < 0.44
    const t = isOuterShell ? 0.35 + rand() * 0.95 : Math.pow(rand(), 0.78) * 0.85
    const r = band.inner + (band.outer - band.inner) * t
    const phase0 = rand() * tau
    const omega = 0.00055 * Math.pow(band.inner / Math.max(1, r), 1.35)

    // Smooth vertical thickening from flared Hills disc into a gentle 3D spherical Oort shell
    const latSpread = isOuterShell
      ? (rand() * 2 - 1) * r * 0.62
      : (rand() + rand() - 1) * r * (0.16 + 0.24 * t)
    const yAmp = Math.abs(latSpread)
    const ip = rand() * tau

    const i3 = i * 3
    pos[i3] = Math.cos(phase0) * r
    pos[i3 + 1] = Math.sin(phase0 + ip) * yAmp
    pos[i3 + 2] = -Math.sin(phase0) * r

    // Fade outer edge smoothly so the halo dissolves organically into deep space
    const radialFade = Math.sin(Math.min(1, t / 1.3) * Math.PI * 0.9 + 0.1)
    const shade = (0.26 + 0.56 * rand() ** 1.6) * (0.55 + 0.45 * radialFade)
    const cool = rand() < 0.74
    col[i3] = shade * (cool ? 0.64 : 0.86)
    col[i3 + 1] = shade * (cool ? 0.78 : 0.74)
    col[i3 + 2] = shade * (cool ? 1.0 : 0.82)

    const i4 = i * 4
    orb[i4] = r
    orb[i4 + 1] = yAmp
    orb[i4 + 2] = phase0
    orb[i4 + 3] = omega
    incPhase[i] = ip
    sizeMul[i] = 0.6 + rand() * 1.1
  }

  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(pos, 3))
  geo.setAttribute('color', new T.BufferAttribute(col, 3))
  geo.setAttribute('aOrbit', new T.BufferAttribute(orb, 4))
  geo.setAttribute('aIncPhase', new T.BufferAttribute(incPhase, 1))
  geo.setAttribute('aSizeMul', new T.BufferAttribute(sizeMul, 1))

  const zeroOffset = { value: 0 }
  const mat = webgl
    ? createBeltDustMaterial(clockUniform, zeroOffset, 1.75, 0.34, 48, 125, true)
    : new T.PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      })

  const points = new T.Points(geo, mat)
  points.frustumCulled = false
  const group = new T.Group()
  group.add(points)
  return { group, dustPoints: points }
}

export function createAsteroidBelts(
  scene: T.Scene,
  webgl: boolean,
  layout: BeltLayout,
  fallbackRockTex: T.Texture | null,
) {
  const { mainBand, hildaBand, centaurBands, outerBand, scatteredBand, oortBand, jupiterA, neptuneA } =
    layout
  const clockUniform = { value: 0 }
  const zeroAngle = { value: 0 }
  const jupiterAngle = { value: 0 }
  const neptuneAngle = { value: 0 }

  // 3 distinct sculpted 3D meteorite archetypes (angular fragment, cratered boulder, bilobed contact binary)
  const prototypes: [T.SphereGeometry, T.SphereGeometry, T.SphereGeometry] = [
    buildAsteroidPrototype({
      seed: 8101,
      scaleXYZ: [1.14, 0.84, 0.96],
      roughness: 0.15,
      facetStrength: 0.14,
      bilobed: 0,
      craterCount: 6,
      segments: [14, 10],
    }),
    buildAsteroidPrototype({
      seed: 8102,
      scaleXYZ: [1.22, 0.88, 0.92],
      roughness: 0.13,
      facetStrength: 0.05,
      bilobed: 0,
      craterCount: 10,
      segments: [16, 11],
    }),
    buildAsteroidPrototype({
      seed: 8103,
      scaleXYZ: [1.42, 0.76, 0.84],
      roughness: 0.12,
      facetStrength: 0.06,
      bilobed: 0.38,
      craterCount: 8,
      segments: [16, 11],
    }),
  ]

  let rockyMaps: SynthesizedMaps | null = null
  let icyMaps: SynthesizedMaps | null = null
  if (webgl) {
    rockyMaps = synthesizeBodyMapsSync(
      {
        ...getBodyDetailSpec('Vesta'),
        baseColor: [0.68, 0.66, 0.64],
        highColor: [0.88, 0.86, 0.83],
        lowColor: [0.38, 0.36, 0.34],
        texCraterCount: 120,
        normalStrength: 2.0,
        baseImageMix: 0,
      },
      256,
      128,
      4,
    )
    icyMaps = synthesizeBodyMapsSync(
      {
        ...getBodyDetailSpec('Namaka'),
        baseColor: [0.76, 0.79, 0.83],
        highColor: [0.95, 0.97, 1.0],
        lowColor: [0.46, 0.49, 0.54],
        texCraterCount: 110,
        normalStrength: 1.75,
        baseImageMix: 0,
      },
      256,
      128,
      4,
    )
  }

  const mainRockMat = createBeltRockMaterial(
    rockyMaps?.albedo ?? fallbackRockTex,
    rockyMaps?.normal ?? null,
    clockUniform,
    zeroAngle,
    false,
    'belt-rock-instanced-v2',
  )
  const jupLockedRockMat = createBeltRockMaterial(
    rockyMaps?.albedo ?? fallbackRockTex,
    rockyMaps?.normal ?? null,
    clockUniform,
    jupiterAngle,
    false,
    'belt-rock-juplocked-v2',
  )
  const kuiperRockMat = createBeltRockMaterial(
    icyMaps?.albedo ?? fallbackRockTex,
    icyMaps?.normal ?? null,
    clockUniform,
    zeroAngle,
    true,
    'kuiper-rock-instanced-v2',
  )
  const nepLockedRockMat = createBeltRockMaterial(
    icyMaps?.albedo ?? fallbackRockTex,
    icyMaps?.normal ?? null,
    clockUniform,
    neptuneAngle,
    true,
    'kuiper-rock-neplocked-v2',
  )

  const mainMid = (mainBand.inner + mainBand.outer) * 0.5

  // 1. Main Asteroid Belt (Mars ↔ Jupiter, 2.1–3.3 AU) with Kirkwood resonance gaps (3:1, 5:2, 7:3, 2:1)
  const main = buildCustomBeltField({
    seed: 18474,
    rockCounts: [860, 880, 660],
    dustCount: 1650,
    prototypes,
    rockMaterial: mainRockMat,
    clockUniform,
    angleOffsetUniform: zeroAngle,
    baseSize: 1.35,
    dustOpacity: 0.48,
    fadeNear: 9,
    fadeFar: 26,
    additiveDust: false,
    rockSizeRange: [0.058, 0.27],
    webgl,
    sample: (rand) => {
      let t = (rand() + rand()) * 0.5
      // Authentic Kirkwood gaps: 3:1 (~0.32), 5:2 (~0.56), 7:3 (~0.71), 2:1 (~0.92)
      if (
        Math.abs(t - 0.32) < 0.03 ||
        Math.abs(t - 0.56) < 0.026 ||
        Math.abs(t - 0.71) < 0.02 ||
        t > 0.91
      ) {
        t = (rand() + rand()) * 0.5
      }
      const r = mainBand.inner + (mainBand.outer - mainBand.inner) * t
      const phase0 = rand() * tau
      const omega = 0.0155 * Math.pow(mainMid / Math.max(1, r), 1.35)
      const yAmp = 0.45 + 2.2 * rand() ** 1.4
      const incPhase = rand() * tau
      const typeRoll = rand()
      let rgb: [number, number, number]
      if (typeRoll < 0.48) {
        const v = 0.56 + rand() * 0.24
        rgb = [v * 0.96, v * 0.92, v * 0.88]
      } else if (typeRoll < 0.86) {
        const v = 0.72 + rand() * 0.28
        rgb = [Math.min(1, v * 1.08), v * 0.96, v * 0.82]
      } else {
        const v = 0.76 + rand() * 0.24
        rgb = [v * 0.96, v * 0.98, Math.min(1, v * 1.02)]
      }
      const shade = 0.36 + 0.58 * rand()
      return {
        r,
        phase0,
        omega,
        yAmp,
        incPhase,
        rgb,
        dustRgb: [shade * 0.98, shade * 0.84, shade * 0.68],
        sizeMul: 1,
      }
    },
  })

  // 2. Hilda Group (3:2 orbital resonance triangle rotating in lockstep with Jupiter!)
  const hildaMid = (hildaBand.inner + hildaBand.outer) * 0.5
  const hildaHalf = (hildaBand.outer - hildaBand.inner) * 0.46
  const hilda = buildCustomBeltField({
    seed: 15382,
    rockCounts: [180, 170, 130],
    dustCount: 440,
    prototypes,
    rockMaterial: jupLockedRockMat,
    clockUniform,
    angleOffsetUniform: jupiterAngle,
    baseSize: 1.25,
    dustOpacity: 0.42,
    fadeNear: 10,
    fadeFar: 28,
    additiveDust: false,
    rockSizeRange: [0.056, 0.23],
    webgl,
    sample: (rand) => {
      // Sample around the 3 resonant aphelion corners (L4 +60°, L3 180°, L5 -60°)
      let rel = rand() * tau
      // Slight Keplerian dwell concentration near the 3 triangle vertices
      const cornerBias = 0.5 - 0.5 * Math.cos(3 * rel)
      if (rand() > 0.42 + 0.58 * cornerBias) {
        const vertex = ([Math.PI / 3, Math.PI, (5 * Math.PI) / 3])[Math.floor(rand() * 3)]
        rel = vertex + (rand() + rand() - 1) * 0.55
      }
      // Real 3:2 resonant triangular envelope: farthest outward at L4/L3/L5, closest inward toward Jupiter (rel=0)
      const tri = -Math.cos(3 * rel)
      const r = hildaMid + hildaHalf * (tri * 0.72 + (rand() - 0.5) * 0.52)
      const yAmp = 0.6 + 3.2 * rand() ** 1.3
      const v = 0.48 + rand() * 0.24
      const rgb: [number, number, number] = [Math.min(1, v * 1.12), v * 0.88, v * 0.74]
      const shade = 0.34 + 0.48 * rand()
      return {
        r,
        phase0: rel,
        omega: 0,
        yAmp,
        incPhase: rand() * tau,
        rgb,
        dustRgb: [shade * 0.94, shade * 0.76, shade * 0.6],
        sizeMul: 0.92,
      }
    },
  })

  // 3. Jupiter Trojans (L4 Greek Camp +60° & L5 Trojan Camp -60°, co-orbiting Jupiter!)
  const trojans = buildCustomBeltField({
    seed: 617354,
    rockCounts: [260, 260, 220],
    dustCount: 820,
    prototypes,
    rockMaterial: jupLockedRockMat,
    clockUniform,
    angleOffsetUniform: jupiterAngle,
    baseSize: 1.4,
    dustOpacity: 0.46,
    fadeNear: 12,
    fadeFar: 34,
    additiveDust: false,
    rockSizeRange: [0.068, 0.28],
    webgl,
    sample: (rand) => {
      // L4 Greek camp (+60°) is slightly more populous than L5 Trojan camp (-60°), matching observations!
      const camp = rand() < 0.56 ? Math.PI / 3 : -Math.PI / 3
      // Authentic elongated tadpole libration cloud around ±60°
      const dTheta = (rand() + rand() + rand() - 1.5) * 0.46
      const phase0 = camp + dTheta
      const radialSpread = (rand() + rand() - 1) * 7.8 * (1 - Math.min(0.55, Math.abs(dTheta) * 0.9))
      const r = jupiterA + radialSpread
      const yAmp = (1.2 + 9.4 * rand() ** 1.25) * (1 - Math.min(0.4, Math.abs(dTheta) * 0.5))
      // D-type dark reddish-brown & P/C-type neutral carbonaceous Trojans
      const isD = rand() < 0.68
      const v = 0.44 + rand() * 0.26
      const rgb: [number, number, number] = isD
        ? [Math.min(1, v * 1.16), v * 0.86, v * 0.72]
        : [v * 0.92, v * 0.9, v * 0.88]
      const shade = 0.34 + 0.52 * rand()
      return {
        r,
        phase0,
        omega: 0,
        yAmp,
        incPhase: rand() * tau,
        rgb,
        dustRgb: [shade * 0.92, shade * 0.76, shade * 0.58],
        sizeMul: 1,
      }
    },
  })

  // 4. Centaur Belt (Between Jupiter, Saturn, Uranus & Neptune — bimodal grey vs ultra-red icy-rocky bodies!)
  const centaurs = buildCustomBeltField({
    seed: 101992,
    rockCounts: [320, 340, 300],
    dustCount: 1150,
    prototypes,
    rockMaterial: kuiperRockMat,
    clockUniform,
    angleOffsetUniform: zeroAngle,
    baseSize: 1.45,
    dustOpacity: 0.42,
    fadeNear: 15,
    fadeFar: 44,
    additiveDust: true,
    rockSizeRange: [0.082, 0.32],
    webgl,
    sample: (rand) => {
      // Weighted into the real inter-giant corridors: Saturn–Uranus (52%), Uranus–Neptune (36%), Jupiter–Saturn (12%)
      const zoneRoll = rand()
      let band: BandRange
      if (zoneRoll < 0.12) band = centaurBands.jupSat
      else if (zoneRoll < 0.64) band = centaurBands.satUra
      else band = centaurBands.uraNep
      const t = (rand() + rand()) * 0.5
      const r = band.inner + (band.outer - band.inner) * t
      const phase0 = rand() * tau
      const omega = 0.0068 * Math.pow(centaurBands.satUra.inner / Math.max(1, r), 1.35)
      // Real Centaurs have excited inclinations (5°–25°) arcing above/below the giant planets
      const yAmp = (2.8 + 18.5 * rand() ** 1.3) * (r / centaurBands.satUra.inner)
      // Bimodal Centaur color taxonomy discovered by photometry: grey-slate vs red organic tholin
      const isUltraRed = rand() < 0.46
      const v = 0.58 + rand() * 0.28
      const rgb: [number, number, number] = isUltraRed
        ? [Math.min(1, v * 1.18), v * 0.76, v * 0.66]
        : [v * 0.84, v * 0.92, Math.min(1, v * 1.04)]
      const shade = 0.3 + 0.52 * rand() ** 1.4
      return {
        r,
        phase0,
        omega,
        yAmp,
        incPhase: rand() * tau,
        rgb,
        dustRgb: isUltraRed
          ? [shade * 0.92, shade * 0.66, shade * 0.56]
          : [shade * 0.64, shade * 0.88, shade * 0.94],
        sizeMul: 1,
      }
    },
  })

  // 4b. Neptune Trojans (L4 +60° & L5 -60° along Neptune's orbit!)
  const neptuneTrojans = buildCustomBeltField({
    seed: 300720,
    rockCounts: [90, 90, 80],
    dustCount: 340,
    prototypes,
    rockMaterial: nepLockedRockMat,
    clockUniform,
    angleOffsetUniform: neptuneAngle,
    baseSize: 1.45,
    dustOpacity: 0.38,
    fadeNear: 16,
    fadeFar: 46,
    additiveDust: true,
    rockSizeRange: [0.09, 0.33],
    webgl,
    sample: (rand) => {
      const camp = rand() < 0.65 ? Math.PI / 3 : -Math.PI / 3
      const dTheta = (rand() + rand() + rand() - 1.5) * 0.38
      const r = neptuneA + (rand() + rand() - 1) * 5.8
      const yAmp = 2.4 + 14.0 * rand() ** 1.3
      const v = 0.68 + rand() * 0.26
      const shade = 0.32 + 0.5 * rand() ** 1.5
      return {
        r,
        phase0: camp + dTheta,
        omega: 0,
        yAmp,
        incPhase: rand() * tau,
        rgb: [v * 0.84, v * 0.92, Math.min(1, v * 1.06)],
        dustRgb: [shade * 0.68, shade * 0.86, shade * 1.0],
        sizeMul: 0.96,
      }
    },
  })

  // 5. Kuiper Belt (30–50 AU beyond Neptune — Cold Classical core, Plutino 3:2 band, Hot Classical halo)
  const outer = buildCustomBeltField({
    seed: 429517,
    rockCounts: [840, 920, 1040],
    dustCount: 2500,
    prototypes,
    rockMaterial: kuiperRockMat,
    clockUniform,
    angleOffsetUniform: zeroAngle,
    baseSize: 1.55,
    dustOpacity: 0.52,
    fadeNear: 16,
    fadeFar: 48,
    additiveDust: true,
    rockSizeRange: [0.095, 0.4],
    webgl,
    sample: (rand) => {
      const isHot = rand() < 0.34
      // Cold classical kernel peaks around 42–47 AU (t ≈ 0.6..0.85); Plutinos peak near 39.5 AU (t ≈ 0.47)
      const t = isHot
        ? Math.pow(rand(), 0.74)
        : rand() < 0.3
          ? 0.47 + (rand() + rand() - 1) * 0.14
          : 0.66 + (rand() + rand() - 1) * 0.24
      const clampedT = Math.max(0.02, Math.min(0.99, t))
      const r = outerBand.inner + (outerBand.outer - outerBand.inner) * clampedT
      const phase0 = rand() * tau
      const omega = 0.003 * Math.pow(outerBand.inner / Math.max(1, r), 1.35)
      const yAmp = (isHot ? 17.0 : 4.6) * (rand() + rand()) * 0.5
      const iceRoll = rand()
      let rgb: [number, number, number]
      let warmDust = false
      if (!isHot && iceRoll < 0.58) {
        const v = 0.7 + rand() * 0.28
        rgb = [Math.min(1, v * 1.08), v * 0.82, v * 0.74]
        warmDust = true
      } else if (iceRoll < 0.84) {
        const v = 0.74 + rand() * 0.26
        rgb = [v * 0.84, v * 0.94, Math.min(1, v * 1.08)]
      } else {
        const v = 0.86 + rand() * 0.14
        rgb = [v * 0.94, v * 0.97, Math.min(1, v * 1.04)]
      }
      const shade = 0.28 + 0.62 * rand() ** 1.75
      return {
        r,
        phase0,
        omega,
        yAmp,
        incPhase: rand() * tau,
        rgb,
        dustRgb: warmDust
          ? [shade * 0.9, shade * 0.76, shade * 0.72]
          : [shade * 0.68, shade * 0.86, shade * 1.0],
        sizeMul: 1,
      }
    },
  })

  // 6. Scattered Disc (50–120+ AU — dynamically excited high-inclination icy bodies around Gonggong, Eris & Farfarout!)
  const scattered = buildCustomBeltField({
    seed: 225088,
    rockCounts: [480, 520, 500],
    dustCount: 2100,
    prototypes,
    rockMaterial: kuiperRockMat,
    clockUniform,
    angleOffsetUniform: zeroAngle,
    baseSize: 1.65,
    dustOpacity: 0.44,
    fadeNear: 22,
    fadeFar: 64,
    additiveDust: true,
    rockSizeRange: [0.12, 0.48],
    webgl,
    sample: (rand) => {
      const t = Math.pow(rand(), 1.15)
      const r = scatteredBand.inner + (scatteredBand.outer - scatteredBand.inner) * t
      const phase0 = rand() * tau
      const omega = 0.0017 * Math.pow(scatteredBand.inner / Math.max(1, r), 1.35)
      // High inclinations (15°–42°) characteristic of Neptune-scattered bodies
      const yAmp = (14.0 + 62.0 * rand() ** 1.2) * (0.55 + 0.65 * t)
      const roll = rand()
      let rgb: [number, number, number]
      let dustRgb: [number, number, number]
      const shade = 0.26 + 0.58 * rand() ** 1.7
      if (roll < 0.36) {
        // Deep reddish Gonggong/Sedna-like tholin scattered bodies
        const v = 0.68 + rand() * 0.28
        rgb = [Math.min(1, v * 1.12), v * 0.72, v * 0.68]
        dustRgb = [shade * 0.88, shade * 0.68, shade * 0.78]
      } else if (roll < 0.76) {
        // Cold blue-lavender frosted scattered icy bodies
        const v = 0.74 + rand() * 0.24
        rgb = [v * 0.82, v * 0.88, Math.min(1, v * 1.08)]
        dustRgb = [shade * 0.68, shade * 0.78, shade * 1.0]
      } else {
        // Eris-like bright methane-frost icy bodies
        const v = 0.86 + rand() * 0.14
        rgb = [v * 0.94, v * 0.96, Math.min(1, v * 1.04)]
        dustRgb = [shade * 0.82, shade * 0.88, shade * 1.0]
      }
      return {
        r,
        phase0,
        omega,
        yAmp,
        incPhase: rand() * tau,
        rgb,
        dustRgb,
        sizeMul: 1,
      }
    },
  })

  // 7. Inner Oort / Hills Cloud Halo (120–1000+ AU compressed, embracing 2012 VP113 & Sedna!)
  const oort = buildOortHalo(oortBand, clockUniform, webgl)

  scene.add(
    main.group,
    hilda.group,
    trojans.group,
    centaurs.group,
    neptuneTrojans.group,
    outer.group,
    scattered.group,
    oort.group,
  )

  for (const proto of prototypes) proto.dispose()

  const freeBatches = [...main.batches, ...centaurs.batches, ...outer.batches, ...scattered.batches]
  const jupBatches = [...hilda.batches, ...trojans.batches]
  const nepBatches = [...neptuneTrojans.batches]
  const allGroups = [
    main.group,
    hilda.group,
    trojans.group,
    centaurs.group,
    neptuneTrojans.group,
    outer.group,
    scattered.group,
    oort.group,
  ]

  const frustum = new T.Frustum()
  const clip = new T.Matrix4()

  return {
    belt: main.group,
    beltDust: main.dustPoints,
    hilda: hilda.group,
    hildaDust: hilda.dustPoints,
    trojans: trojans.group,
    trojanDust: trojans.dustPoints,
    centaurs: centaurs.group,
    centaurDust: centaurs.dustPoints,
    neptuneTrojans: neptuneTrojans.group,
    neptuneTrojanDust: neptuneTrojans.dustPoints,
    kuiper: outer.group,
    kuiperDust: outer.dustPoints,
    scattered: scattered.group,
    scatteredDust: scattered.dustPoints,
    oort: oort.group,
    oortDust: oort.dustPoints,
    setBeltsVisible(visible: boolean) {
      for (const g of allGroups) g.visible = visible
    },
    updateBeltVisibility(camera: T.Camera, bufferHeight: number) {
      if (!main.group.visible) return
      frustum.setFromProjectionMatrix(
        clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      )
      const focalPixels = bufferHeight * camera.projectionMatrix.elements[5] * 0.5
      for (const batch of freeBatches)
        batch.update(frustum, camera.matrixWorldInverse, focalPixels, clockUniform.value, 0)
      for (const batch of jupBatches)
        batch.update(
          frustum,
          camera.matrixWorldInverse,
          focalPixels,
          clockUniform.value,
          jupiterAngle.value,
        )
      for (const batch of nepBatches)
        batch.update(
          frustum,
          camera.matrixWorldInverse,
          focalPixels,
          clockUniform.value,
          neptuneAngle.value,
        )
    },
    stepBelts(clock: number, jupLon: number, nepLon: number) {
      clockUniform.value = clock
      jupiterAngle.value = jupLon
      neptuneAngle.value = nepLon
      if (!webgl) {
        // Synchronize co-orbiting dust orientation in Canvas 2D fallback mode
        hilda.dustPoints.rotation.y = jupLon
        trojans.dustPoints.rotation.y = jupLon
        neptuneTrojans.dustPoints.rotation.y = nepLon
      }
    },
    disposeBelts() {
      rockyMaps?.dispose()
      icyMaps?.dispose()
    },
  }
}
