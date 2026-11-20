import * as T from 'three'
import { seeded, tau } from './math'
import { getBodyDetailSpec, synthesizeBodyMapsSync, type SynthesizedMaps } from './bodyDetail'

export interface BandRange {
  inner: number
  outer: number
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

function buildAsteroidPrototype(spec: AsteroidPrototypeSpec): T.BufferGeometry {
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
 * GPU-driven instanced material for realistic 3D belt asteroids & Kuiper icy bodies.
 * Each instance orbits smoothly around the Sun and tumbles on its own spin axis in the vertex shader
 * with zero per-frame CPU matrix updates, while retaining full PointLight + normalMap + regolith shading.
 */
function createBeltRockMaterial(
  map: T.Texture | null,
  normalMap: T.Texture | null,
  clockUniform: { value: number },
  icy: boolean,
) {
  const material = new T.MeshPhongMaterial({
    color: 0xffffff,
    map,
    normalMap,
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
    shader.vertexShader =
      `
      attribute vec4 aOrbit;
      attribute vec4 aSpin;
      attribute vec4 aScaleTilt;
      uniform float uBeltClock;
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
          float _bOrbAng = aOrbit.z + uBeltClock * aOrbit.w;
          vec3 _bCenter = vec3(
            cos(_bOrbAng) * aOrbit.x,
            sin(_bOrbAng + aScaleTilt.w) * aOrbit.y,
            sin(_bOrbAng) * aOrbit.x
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
  material.customProgramCacheKey = () => (icy ? 'kuiper-rock-instanced-v1' : 'belt-rock-instanced-v1')
  return material
}

/**
 * Soft, circular, distance-attenuated distant dust micro-grains that fade smoothly
 * when the camera flies in close (so close-up views only show crisp 3D sculpted rocks,
 * never flat square pixels!).
 */
function createBeltDustMaterial(
  clockUniform: { value: number },
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
      uniform float uSize;
      uniform float uFadeNear;
      uniform float uFadeFar;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float ang = aOrbit.z + uBeltClock * aOrbit.w;
        vec3 worldPos = vec3(
          cos(ang) * aOrbit.x,
          sin(ang + aIncPhase) * aOrbit.y,
          sin(ang) * aOrbit.x
        );
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        float dist = max(0.01, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        // Soft distance fade: micro-dust gracefully vanishes up close where 3D rocks take over
        float closeFade = smoothstep(uFadeNear, uFadeFar, dist);
        float ptSize = clamp(uSize * aSizeMul * (320.0 / dist), 1.45, 5.2);
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
        // Smooth circular soft grain (never a square pixel)
        float soft = exp(-2.6 * r2) * (1.0 - smoothstep(0.52, 1.0, r2));
        float alpha = soft * uOpacity * vAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  })
}

function buildBeltField(options: {
  seed: number
  band: BandRange
  icy: boolean
  rockCounts: [number, number, number]
  dustCount: number
  prototypes: [T.BufferGeometry, T.BufferGeometry, T.BufferGeometry]
  rockMaterial: T.Material
  clockUniform: { value: number }
  webgl: boolean
}) {
  const { seed, band, icy, rockCounts, dustCount, prototypes, rockMaterial, clockUniform, webgl } =
    options
  const rand = seeded(seed)
  const group = new T.Group()
  const identity = new T.Matrix4()

  // Sample realistic orbital radius (with subtle Kirkwood gap resonances in main belt,
  // or cold classical core + scattered outer halo in Kuiper Belt)
  function sampleRadius(): { r: number; isHot: boolean } {
    if (!icy) {
      let t = (rand() + rand()) * 0.5
      // Gentle Kirkwood resonance carving around 0.34 (3:1) and 0.62 (5:2)
      if (Math.abs(t - 0.34) < 0.032 || Math.abs(t - 0.62) < 0.025) {
        t = (rand() + rand()) * 0.5
      }
      return { r: band.inner + (band.outer - band.inner) * t, isHot: false }
    }
    const isHot = rand() < 0.32
    const t = isHot ? Math.pow(rand(), 0.72) : (rand() + rand() + rand()) / 3
    return { r: band.inner + (band.outer - band.inner) * t, isHot }
  }

  function sampleOrbitalOmega(r: number): number {
    // Smooth Keplerian differential rotation: inner belt drifts noticeably faster than outer belt
    const base = icy ? 0.0032 : 0.0155
    const ref = icy ? band.inner : (band.inner + band.outer) * 0.5
    return base * Math.pow(ref / Math.max(1, r), 1.35)
  }

  // 1. Real 3D sculpted instanced asteroid / KBO meshes (3 distinct rock prototypes)
  if (webgl) {
    const colorTmp = new T.Color()
    for (let pIdx = 0; pIdx < 3; pIdx++) {
      const count = rockCounts[pIdx]
      // Clone geometry so each InstancedMesh carries its own instanced attributes
      const instGeo = prototypes[pIdx].clone()
      const aOrbit = new Float32Array(count * 4)
      const aSpin = new Float32Array(count * 4)
      const aScaleTilt = new Float32Array(count * 4)

      const mesh = new T.InstancedMesh(instGeo, rockMaterial, count)
      mesh.frustumCulled = false

      for (let i = 0; i < count; i++) {
        const { r, isHot } = sampleRadius()
        const phase0 = rand() * tau
        const omega = sampleOrbitalOmega(r)
        const ySpread = icy
          ? (isHot ? 14.5 : 4.2) * (rand() + rand()) * 0.5
          : (0.45 + 2.15 * rand() ** 1.4)
        const incPhase = rand() * tau

        // Random unit spin axis & gentle tumble rate
        const sz = rand() * 2 - 1
        const sa = rand() * tau
        const sr = Math.sqrt(Math.max(0, 1 - sz * sz))
        const spinSpeed = (0.12 + rand() * 0.52) * (rand() < 0.5 ? 1 : -1)

        // Power-law size distribution: many small fragments, clearly visible mid-size rocks, and occasional boulders
        const sizeT = rand() ** 2.45
        const baseRad = icy
          ? 0.095 + sizeT * 0.3
          : 0.058 + sizeT * 0.21
        const sx = baseRad * (0.86 + rand() * 0.42)
        const sy = baseRad * (0.68 + rand() * 0.36)
        const szScale = baseRad * (0.78 + rand() * 0.38)

        const o4 = i * 4
        aOrbit[o4] = r
        aOrbit[o4 + 1] = ySpread
        aOrbit[o4 + 2] = phase0
        aOrbit[o4 + 3] = omega

        aSpin[o4] = Math.cos(sa) * sr
        aSpin[o4 + 1] = sz
        aSpin[o4 + 2] = Math.sin(sa) * sr
        aSpin[o4 + 3] = spinSpeed

        aScaleTilt[o4] = sx
        aScaleTilt[o4 + 1] = sy
        aScaleTilt[o4 + 2] = szScale
        aScaleTilt[o4 + 3] = incPhase

        mesh.setMatrixAt(i, identity)

        // Realistic spectral albedo variation (C/S/M-type for main belt; cold red tholin vs bright methane-ice for Kuiper)
        if (!icy) {
          const typeRoll = rand()
          if (typeRoll < 0.48) {
            // C-type dark carbonaceous asteroid
            const v = 0.56 + rand() * 0.24
            colorTmp.setRGB(v * 0.96, v * 0.92, v * 0.88)
          } else if (typeRoll < 0.86) {
            // S-type warm silicaceous / stony asteroid
            const v = 0.72 + rand() * 0.28
            colorTmp.setRGB(Math.min(1, v * 1.08), v * 0.96, v * 0.82)
          } else {
            // M-type slightly cooler metallic-silicate asteroid
            const v = 0.76 + rand() * 0.24
            colorTmp.setRGB(v * 0.96, v * 0.98, Math.min(1, v * 1.02))
          }
        } else {
          const iceRoll = rand()
          if (!isHot && iceRoll < 0.55) {
            // Cold classical reddish tholin-coated KBO (Arrokoth-like)
            const v = 0.7 + rand() * 0.28
            colorTmp.setRGB(Math.min(1, v * 1.06), v * 0.84, v * 0.76)
          } else if (iceRoll < 0.82) {
            // Frosted blue-grey water-ice KBO
            const v = 0.74 + rand() * 0.26
            colorTmp.setRGB(v * 0.84, v * 0.94, Math.min(1, v * 1.08))
          } else {
            // Bright methane-frost KBO
            const v = 0.86 + rand() * 0.14
            colorTmp.setRGB(v * 0.94, v * 0.97, Math.min(1, v * 1.04))
          }
        }
        mesh.setColorAt(i, colorTmp)
      }

      instGeo.setAttribute('aOrbit', new T.InstancedBufferAttribute(aOrbit, 4))
      instGeo.setAttribute('aSpin', new T.InstancedBufferAttribute(aSpin, 4))
      instGeo.setAttribute('aScaleTilt', new T.InstancedBufferAttribute(aScaleTilt, 4))
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      group.add(mesh)
    }
  }

  // 2. Soft circular distant micro-dust (fades away up close; also provides Canvas 2D & raypick coordinates)
  const dustPos = new Float32Array(dustCount * 3)
  const dustCol = new Float32Array(dustCount * 3)
  const dustOrbit = new Float32Array(dustCount * 4)
  const dustIncPhase = new Float32Array(dustCount)
  const dustSizeMul = new Float32Array(dustCount)

  for (let i = 0; i < dustCount; i++) {
    const { r, isHot } = sampleRadius()
    const phase0 = rand() * tau
    const omega = sampleOrbitalOmega(r)
    const yAmp = icy
      ? (isHot ? 14.0 : 4.2) * (rand() + rand()) * 0.5
      : (0.4 + 2.0 * rand() ** 1.35)
    const incPhase = rand() * tau
    const y0 = Math.sin(phase0 + incPhase) * yAmp

    const i3 = i * 3
    dustPos[i3] = Math.cos(phase0) * r
    dustPos[i3 + 1] = y0
    dustPos[i3 + 2] = Math.sin(phase0) * r

    const shade = icy ? 0.28 + 0.62 * rand() ** 1.8 : 0.36 + 0.58 * rand()
    if (icy) {
      const warm = !isHot && rand() < 0.35
      dustCol[i3] = shade * (warm ? 0.88 : 0.68)
      dustCol[i3 + 1] = shade * (warm ? 0.78 : 0.85)
      dustCol[i3 + 2] = shade * (warm ? 0.74 : 1.0)
    } else {
      dustCol[i3] = shade * 0.98
      dustCol[i3 + 1] = shade * 0.84
      dustCol[i3 + 2] = shade * 0.68
    }

    const i4 = i * 4
    dustOrbit[i4] = r
    dustOrbit[i4 + 1] = yAmp
    dustOrbit[i4 + 2] = phase0
    dustOrbit[i4 + 3] = omega
    dustIncPhase[i] = incPhase
    dustSizeMul[i] = 0.65 + rand() * 0.9
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
        icy ? 1.55 : 1.35,
        icy ? 0.54 : 0.48,
        icy ? 16 : 9,
        icy ? 46 : 26,
        icy,
      )
    : new T.PointsMaterial({
        size: icy ? 0.24 : 0.16,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })

  const dustPoints = new T.Points(dustGeo, dustMat)
  dustPoints.frustumCulled = false
  group.add(dustPoints)

  return { group, dustPoints }
}

export function createAsteroidBelts(
  scene: T.Scene,
  webgl: boolean,
  mainBand: BandRange,
  outerBand: BandRange,
  fallbackRockTex: T.Texture | null,
) {
  const clockUniform = { value: 0 }

  // 3 distinct sculpted 3D meteorite archetypes (angular fragment, cratered boulder, bilobed contact binary)
  const prototypes: [T.BufferGeometry, T.BufferGeometry, T.BufferGeometry] = [
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

  // Procedural high-contrast rocky & frosted-icy textures + normal maps shared by belt meshes
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
    false,
  )
  const kuiperRockMat = createBeltRockMaterial(
    icyMaps?.albedo ?? fallbackRockTex,
    icyMaps?.normal ?? null,
    clockUniform,
    true,
  )

  const main = buildBeltField({
    seed: 18474,
    band: mainBand,
    icy: false,
    rockCounts: [860, 880, 660], // 2,400 real 3D orbiting & tumbling asteroids!
    dustCount: 1650,
    prototypes,
    rockMaterial: mainRockMat,
    clockUniform,
    webgl,
  })

  const outer = buildBeltField({
    seed: 429517,
    band: outerBand,
    icy: true,
    rockCounts: [840, 920, 1040], // 2,800 real 3D icy Kuiper Belt objects (rich in bilobed KBOs!)
    dustCount: 2400,
    prototypes,
    rockMaterial: kuiperRockMat,
    clockUniform,
    webgl,
  })

  scene.add(main.group, outer.group)

  // Base prototype geometries were cloned per InstancedMesh; dispose originals right away
  for (const proto of prototypes) proto.dispose()

  return {
    belt: main.group,
    beltDust: main.dustPoints,
    kuiper: outer.group,
    kuiperDust: outer.dustPoints,
    stepBelts(clock: number) {
      clockUniform.value = clock
    },
    disposeBelts() {
      rockyMaps?.dispose()
      icyMaps?.dispose()
    },
  }
}
