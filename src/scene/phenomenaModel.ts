import * as T from 'three'
import {
  ALIGNMENT_BODY_IDS,
  SL9_ROCHE_YEAR,
  computeAlignmentState,
  computeConjunctionState,
  sampleOumuamuaAU,
  sl9Fragments,
  sl9JupiterSpinRad,
} from '../data/phenomena'
import { createRadialMapper } from '../data/voyager'
import type { Label, PhenomenonId, ScreenPoint, World } from './types'
import { clamp, rad, tau, v3 } from './math'
import { pick, type Locale } from '../i18n'

type Project = (point: T.Vector3) => ScreenPoint | null

function setLabelText(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text
}

function wrapAngleDiff(target: number, current: number): number {
  let d = (target - current) % tau
  if (d > Math.PI) d -= tau
  if (d < -Math.PI) d += tau
  return d
}

function createGlowTexture(
  innerColor: string,
  midColor: string,
  outerColor: string,
  size = 128,
): T.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const half = size * 0.5
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half)
  grad.addColorStop(0, innerColor)
  grad.addColorStop(0.28, midColor)
  grad.addColorStop(0.66, outerColor)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new T.CanvasTexture(canvas)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

function createScarTexture(size = 128): T.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const half = size * 0.5
  const ejecta = ctx.createRadialGradient(
    half * 1.12,
    half * 1.04,
    half * 0.14,
    half * 1.05,
    half * 1.02,
    half * 0.94,
  )
  ejecta.addColorStop(0, 'rgba(34, 18, 12, 0.92)')
  ejecta.addColorStop(0.36, 'rgba(52, 30, 20, 0.72)')
  ejecta.addColorStop(0.68, 'rgba(72, 46, 30, 0.34)')
  ejecta.addColorStop(1, 'rgba(40, 22, 14, 0)')
  ctx.fillStyle = ejecta
  ctx.fillRect(0, 0, size, size)

  const core = ctx.createRadialGradient(half * 0.92, half * 0.96, 0, half * 0.92, half * 0.96, half * 0.42)
  core.addColorStop(0, 'rgba(12, 7, 6, 0.98)')
  core.addColorStop(0.55, 'rgba(24, 14, 10, 0.88)')
  core.addColorStop(1, 'rgba(36, 20, 14, 0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(half * 0.92, half * 0.96, half * 0.44, 0, tau)
  ctx.fill()

  const tex = new T.CanvasTexture(canvas)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

function makeCirclePoints(radius: number, segments: number): T.Vector3[] {
  const pts: T.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * tau
    pts.push(v3(Math.cos(a) * radius, 0, -Math.sin(a) * radius))
  }
  return pts
}

export function createPhenomenaModel(
  scene: T.Scene,
  webgl: boolean,
  worlds: World[],
  planets: World[],
  mapOuterAU: (au: number) => number,
  tag: (text: string, cls?: string) => HTMLSpanElement,
) {
  const mapper = createRadialMapper(planets, mapOuterAU)
  const worldById = new Map(worlds.map((w) => [w.id, w]))
  const jupiter = worldById.get('Jupiter')!
  const saturn = worldById.get('Saturn')!
  const earth = worldById.get('Earth')!
  const pluto = worldById.get('Pluto')!

  const root = new T.Group()
  root.visible = false
  scene.add(root)

  const ownedTextures: T.Texture[] = []
  function trackTex(t: T.CanvasTexture) {
    ownedTextures.push(t)
    return t
  }

  const comaTex = webgl
    ? trackTex(createGlowTexture('rgba(255,252,240,1)', 'rgba(176,238,255,0.72)', 'rgba(92,180,255,0.16)'))
    : null
  const fireTex = webgl
    ? trackTex(createGlowTexture('rgba(255,255,244,1)', 'rgba(255,196,86,0.94)', 'rgba(255,78,24,0.32)'))
    : null
  const emberTex = webgl
    ? trackTex(createGlowTexture('rgba(255,168,72,0.92)', 'rgba(220,76,22,0.52)', 'rgba(120,24,8,0)'))
    : null
  const scarTex = webgl ? trackTex(createScarTexture()) : null
  const glowRingTex = webgl
    ? trackTex(createGlowTexture('rgba(255,232,164,0.92)', 'rgba(255,176,74,0.45)', 'rgba(70,217,255,0.08)'))
    : null

  // Pre-allocated scratch math objects (ZERO per-frame GC allocations!)
  const tmpColor = new T.Color()
  const cyanColor = new T.Color(0x46c8ff)
  const goldColor = new T.Color(0xffc95e)
  const plutoGoldColor = new T.Color(0xffd278)
  const conjCyanColor = new T.Color(0x62dcff)
  const conjGoldColor = new T.Color(0xffd068)
  const upAxis = v3(0, 1, 0)
  const scratchA = v3()
  const scratchB = v3()
  const scratchC = v3()
  const scratchD = v3()

  let activeId: PhenomenonId = 'alignment1982'
  let activeYear = 1981.3
  let activeVisible = false

  // =========================================================================
  // 1. 1982 NINE-PLANET ALIGNMENT (九星连珠)
  // =========================================================================
  const alignGroup = new T.Group()
  root.add(alignGroup)

  const ALIGN_SECT_SEGS = 128
  const alignOuterR = Math.max(pluto.a * 1.08, mapper.neptuneOrbitR * 1.24)
  const sectorPosArr = new Float32Array((ALIGN_SECT_SEGS + 2) * 3)
  const sectorRadArr = new Float32Array(ALIGN_SECT_SEGS + 2)
  const sectorIdx: number[] = []
  sectorRadArr[0] = 0
  for (let i = 1; i <= ALIGN_SECT_SEGS + 1; i++) sectorRadArr[i] = 1
  for (let i = 1; i <= ALIGN_SECT_SEGS; i++) {
    sectorIdx.push(0, i, i + 1)
  }
  const sectorGeo = new T.BufferGeometry()
  sectorGeo.setAttribute('position', new T.BufferAttribute(sectorPosArr, 3))
  sectorGeo.setAttribute('aRadius', new T.BufferAttribute(sectorRadArr, 1))
  sectorGeo.setIndex(sectorIdx)

  const sectorUniforms = {
    uColor: { value: new T.Color(0xffc45c) },
    uOpacity: { value: 0.16 },
    uTime: { value: 0 },
  }
  const sectorMat = webgl
    ? new T.ShaderMaterial({
        uniforms: sectorUniforms,
        vertexShader: `
          attribute float aRadius;
          varying float vR;
          void main() {
            vR = aRadius;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uTime;
          varying float vR;
          void main() {
            float pulse = 0.92 + 0.08 * sin(uTime * 1.8 - vR * 6.0);
            float rim = smoothstep(0.76, 1.0, vR) * 0.65;
            float body = smoothstep(0.02, 0.28, vR) * (1.0 - smoothstep(0.82, 1.0, vR) * 0.25);
            float alpha = uOpacity * (body * 0.65 + rim) * pulse;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
        transparent: true,
        side: T.DoubleSide,
        depthWrite: false,
        blending: T.AdditiveBlending,
      })
    : new T.MeshBasicMaterial({
        color: 0xffc45c,
        transparent: true,
        opacity: 0.14,
        side: T.DoubleSide,
        depthWrite: false,
        blending: T.AdditiveBlending,
      })
  const sectorMesh = new T.Mesh(sectorGeo, sectorMat)
  sectorMesh.position.y = -0.18
  alignGroup.add(sectorMesh)

  const arcPts = new Float32Array((ALIGN_SECT_SEGS + 3) * 3)
  const arcGeo = new T.BufferGeometry()
  arcGeo.setAttribute('position', new T.BufferAttribute(arcPts, 3))
  const arcMat = new T.LineBasicMaterial({
    color: 0xffd274,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  })
  const arcLine = new T.Line(arcGeo, arcMat)
  alignGroup.add(arcLine)

  const rayPts = new Float32Array(ALIGNMENT_BODY_IDS.length * 2 * 3)
  const rayGeo = new T.BufferGeometry()
  rayGeo.setAttribute('position', new T.BufferAttribute(rayPts, 3))
  const rayMat = new T.LineBasicMaterial({
    color: 0x76e8ff,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
    blending: T.AdditiveBlending,
  })
  const alignRays = new T.LineSegments(rayGeo, rayMat)
  alignGroup.add(alignRays)

  const alignRings: { world: World; ring: T.Line; mat: T.LineBasicMaterial }[] = []
  for (const id of ALIGNMENT_BODY_IDS) {
    const w = worldById.get(id)
    if (!w) continue
    const ringR = Math.max(w.r * 1.9, id === 'Pluto' ? 4.2 : 2.5)
    const mat = new T.LineBasicMaterial({
      color: id === 'Pluto' ? 0xffcf78 : 0x7eeeff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
    const ring = new T.Line(new T.BufferGeometry().setFromPoints(makeCirclePoints(ringR, 48)), mat)
    alignGroup.add(ring)
    alignRings.push({ world: w, ring, mat })
  }

  const compassLine = new T.Line(
    new T.BufferGeometry().setFromPoints(makeCirclePoints(alignOuterR, 144)),
    new T.LineBasicMaterial({ color: 0x4ca4d8, transparent: true, opacity: 0.16, depthWrite: false }),
  )
  alignGroup.add(compassLine)

  const alignSectorAnchor = v3()
  const alignLabel = tag('', 'star phen-label gold')
  let alignSpanDeg = 95.5
  let displayStartLon = 0
  let displaySweep = Math.PI * 0.53
  let alignHasInit = false

  function updateAlignment(year: number, dt: number, snap: boolean) {
    const state = computeAlignmentState(year)
    alignSpanDeg = state.spanDeg

    // Smoothly damp sector start/sweep during continuous playback so boundary swaps never snap!
    if (snap || !alignHasInit || dt <= 0) {
      displayStartLon = state.startLonRad
      displaySweep = state.sweepRad
      alignHasInit = true
    } else {
      const k = 1 - Math.exp(-dt * 9.5)
      displayStartLon += wrapAngleDiff(state.startLonRad, displayStartLon) * k
      displaySweep += (state.sweepRad - displaySweep) * k
    }

    const peakness = clamp((132 - state.spanDeg) / 36, 0, 1)
    tmpColor.copy(cyanColor).lerp(goldColor, peakness)
    if (webgl) {
      sectorUniforms.uColor.value.copy(tmpColor)
      sectorUniforms.uOpacity.value = 0.11 + peakness * 0.21
    } else {
      const bm = sectorMat as T.MeshBasicMaterial
      bm.color.copy(tmpColor)
      bm.opacity = 0.07 + peakness * 0.14
    }
    arcMat.color.copy(tmpColor)
    arcMat.opacity = 0.48 + peakness * 0.42
    rayMat.color.copy(tmpColor)
    rayMat.opacity = 0.34 + peakness * 0.36

    sectorPosArr[0] = 0
    sectorPosArr[1] = 0
    sectorPosArr[2] = 0
    arcPts[0] = 0
    arcPts[1] = 0
    arcPts[2] = 0
    for (let i = 0; i <= ALIGN_SECT_SEGS; i++) {
      const lon = displayStartLon + (i / ALIGN_SECT_SEGS) * displaySweep
      const x = Math.cos(lon) * alignOuterR
      const z = -Math.sin(lon) * alignOuterR
      const si = (i + 1) * 3
      sectorPosArr[si] = x
      sectorPosArr[si + 1] = 0
      sectorPosArr[si + 2] = z
      arcPts[si] = x
      arcPts[si + 1] = 0
      arcPts[si + 2] = z
    }
    const lastIdx = (ALIGN_SECT_SEGS + 2) * 3
    arcPts[lastIdx] = 0
    arcPts[lastIdx + 1] = 0
    arcPts[lastIdx + 2] = 0
    sectorGeo.attributes.position.needsUpdate = true
    arcGeo.attributes.position.needsUpdate = true

    const midLon = displayStartLon + displaySweep * 0.5
    alignSectorAnchor.set(Math.cos(midLon) * alignOuterR * 0.72, 4, -Math.sin(midLon) * alignOuterR * 0.72)

    for (let i = 0; i < ALIGNMENT_BODY_IDS.length; i++) {
      const w = worldById.get(ALIGNMENT_BODY_IDS[i])
      if (!w) continue
      const k = i * 6
      rayPts[k] = 0
      rayPts[k + 1] = 0
      rayPts[k + 2] = 0
      rayPts[k + 3] = w.pos.x
      rayPts[k + 4] = w.pos.y
      rayPts[k + 5] = w.pos.z
    }
    rayGeo.attributes.position.needsUpdate = true

    for (const { world, ring, mat } of alignRings) {
      ring.position.copy(world.pos)
      mat.color.copy(world.id === 'Pluto' ? plutoGoldColor : tmpColor)
    }
  }

  // =========================================================================
  // 2. 1994 COMET SHOEMAKER-LEVY 9 IMPACT ON JUPITER (彗星撞击木星)
  // =========================================================================
  const sl9Group = new T.Group()
  root.add(sl9Group)

  const sl9Jovian = new T.Group()
  sl9Group.add(sl9Jovian)

  const jupRx = jupiter.mesh.scale.x
  const jupRy = jupiter.mesh.scale.y
  const SL9_IMPACT_LAT_RAD = -44 * rad
  const SL9_IMPACT_AZ = 0.68
  const SL9_APOAPSIS_R = jupRx * 8.6

  function jupiterSurfacePoint(latRad: number, lonRad: number, radiusScale = 1.0, out = v3()): T.Vector3 {
    const cosLat = Math.cos(latRad)
    return out.set(
      jupRx * radiusScale * cosLat * Math.cos(lonRad),
      jupRy * radiusScale * Math.sin(latRad),
      -jupRx * radiusScale * cosLat * Math.sin(lonRad),
    )
  }

  const sl9ImpactLocal = jupiterSurfacePoint(SL9_IMPACT_LAT_RAD, SL9_IMPACT_AZ, 1.0, v3())
  const sl9ImpactDir = sl9ImpactLocal.clone().normalize()
  const sl9OrbRight = v3(-Math.sin(SL9_IMPACT_AZ), 0, -Math.cos(SL9_IMPACT_AZ)).normalize()
  const sl9OrbUp = v3().crossVectors(sl9ImpactDir, sl9OrbRight).normalize()

  /**
   * Smooth C² monotonic mapping from orbital fraction [0, 1] to visual arc parameter [0, 1].
   * Eliminates velocity kinks and infinite-slope snaps near impact while keeping all 21 pearls
   * gracefully spaced during the July 1994 plunge!
   */
  function sl9VisualPhase(phase: number): number {
    if (phase <= 0) return phase
    if (phase >= 1) return 1
    // Smooth Kepler-like acceleration toward periapsis: gentle near apoapsis, brisk & silky into impact
    const u = 1 - phase
    return 1 - (0.72 * u + 0.28 * u * u)
  }

  function sl9OrbitPosition(visualP: number, out = v3()): T.Vector3 {
    if (visualP < 0) {
      const s = clamp(-visualP, 0, 1)
      const dist = jupRx * 1.42 + s * jupRx * 14.0
      return out
        .copy(sl9ImpactDir)
        .multiplyScalar(-dist * 0.25)
        .addScaledVector(sl9OrbRight, -dist * 0.88)
        .addScaledVector(sl9OrbUp, dist * 0.28)
    }
    const p = clamp(visualP, 0, 1)
    const theta = p * Math.PI
    const sinT = Math.sin(theta)
    const radialLoop = Math.pow(sinT, 1.08)
    const lateral = Math.sin(p * Math.PI * 2) * jupRx * 2.4 * (1 - p * 0.62)
    const rocheBlend = Math.pow(1 - p, 4)
    const impactR = sl9ImpactLocal.length()
    const along = impactR + (SL9_APOAPSIS_R - impactR) * radialLoop

    return out
      .copy(sl9ImpactDir)
      .multiplyScalar(along)
      .addScaledVector(sl9OrbRight, lateral - rocheBlend * jupRx * 1.55)
      .addScaledVector(sl9OrbUp, -sinT * jupRx * 0.65 + rocheBlend * jupRx * 0.9)
  }

  const sl9CurvePts: T.Vector3[] = []
  for (let i = 0; i <= 220; i++) {
    sl9CurvePts.push(sl9OrbitPosition(i / 220, v3()))
  }
  const sl9CurveLine = new T.Line(
    new T.BufferGeometry().setFromPoints(sl9CurvePts),
    new T.LineBasicMaterial({ color: 0x7cd8ff, transparent: true, opacity: 0.3, depthWrite: false }),
  )
  sl9Jovian.add(sl9CurveLine)

  const rocheRingR = jupRx * 1.65
  const rocheRingMat = new T.LineBasicMaterial({
    color: 0xff7b54,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  })
  const rocheRing = new T.Line(
    new T.BufferGeometry().setFromPoints(makeCirclePoints(rocheRingR, 88)),
    rocheRingMat,
  )
  sl9Jovian.add(rocheRing)

  const sl9ScarSpinGroup = new T.Group()
  sl9Jovian.add(sl9ScarSpinGroup)

  const trainRibbonPts = new Float32Array(sl9Fragments.length * 3)
  const trainRibbonGeo = new T.BufferGeometry()
  trainRibbonGeo.setAttribute('position', new T.BufferAttribute(trainRibbonPts, 3))
  const trainRibbon = new T.Line(
    trainRibbonGeo,
    new T.LineBasicMaterial({
      color: 0xa8e8ff,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  )
  sl9Jovian.add(trainRibbon)

  // Soft volumetric mushroom-plume geometry + feathered gradient shader (no sharp cone silhouette!)
  const shockGeo = new T.RingGeometry(0.66, 1.0, 36)
  const coreGeo = new T.SphereGeometry(0.15, 12, 12)
  const plumeGeo = new T.SphereGeometry(0.65, 20, 16)
  plumeGeo.scale(0.85, 1.45, 0.85)
  plumeGeo.translate(0, 0.52, 0)
  const scarGeo = new T.PlaneGeometry(1, 1)

  interface Sl9Visual {
    frag: (typeof sl9Fragments)[number]
    posLocal: T.Vector3
    alive: boolean
    sprite: T.Sprite
    core: T.Mesh
    fireball: T.Sprite
    fireMat: T.SpriteMaterial
    plume: T.Mesh
    plumeMat: T.ShaderMaterial | T.MeshBasicMaterial
    plumeOpacity: { value: number }
    shockwave: T.Mesh
    shockMat: T.MeshBasicMaterial
    ember: T.Sprite
    emberMat: T.SpriteMaterial
    scar: T.Mesh
    scarMat: T.MeshBasicMaterial
    scarLonRad: number
    scarBasePos: T.Vector3
    scarNormal: T.Vector3
  }

  const sl9Visuals: Sl9Visual[] = sl9Fragments.map((frag) => {
    const sprite = new T.Sprite(
      new T.SpriteMaterial({
        map: comaTex,
        color: frag.sizeWeight > 0.85 ? 0xfff0c2 : 0xbceeff,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    )
    const core = new T.Mesh(coreGeo, new T.MeshBasicMaterial({ color: 0xfff8e6 }))
    sl9Jovian.add(sprite, core)

    const fireMat = new T.SpriteMaterial({
      map: fireTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: T.AdditiveBlending,
    })
    const fireball = new T.Sprite(fireMat)
    fireball.visible = false
    sl9Jovian.add(fireball)

    const plumeOpacity = { value: 0 }
    const plumeMat = webgl
      ? new T.ShaderMaterial({
          uniforms: { uOpacity: plumeOpacity },
          vertexShader: `
            varying vec3 vNormalV;
            varying vec3 vViewDir;
            varying float vHeight;
            void main() {
              vHeight = clamp(position.y / 1.45, 0.0, 1.0);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vNormalV = normalize(normalMatrix * normal);
              vViewDir = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            uniform float uOpacity;
            varying vec3 vNormalV;
            varying vec3 vViewDir;
            varying float vHeight;
            void main() {
              float edge = pow(max(0.0, abs(dot(normalize(vNormalV), normalize(vViewDir)))), 1.6);
              vec3 hot = mix(vec3(1.0, 0.96, 0.82), vec3(1.0, 0.52, 0.16), smoothstep(0.05, 0.85, vHeight));
              float fade = smoothstep(0.0, 0.18, vHeight) * (1.0 - smoothstep(0.55, 1.0, vHeight));
              gl_FragColor = vec4(hot, uOpacity * edge * fade);
            }
          `,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
        })
      : new T.MeshBasicMaterial({
          color: 0xffa448,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: T.AdditiveBlending,
        })
    const plume = new T.Mesh(plumeGeo, plumeMat)
    plume.visible = false
    sl9Jovian.add(plume)

    const scarLonRad = SL9_IMPACT_AZ - sl9JupiterSpinRad(frag.impactYear)
    const scarBasePos = jupiterSurfacePoint(frag.latDeg * rad, scarLonRad, 1.015, v3())
    const scarNormal = scarBasePos.clone().normalize()

    const shockMat = new T.MeshBasicMaterial({
      color: 0xffc86b,
      transparent: true,
      opacity: 0,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    })
    const shockwave = new T.Mesh(shockGeo, shockMat)
    shockwave.position.copy(scarBasePos).addScaledVector(scarNormal, 0.05)
    shockwave.lookAt(scarBasePos.clone().add(scarNormal))
    shockwave.visible = false
    sl9ScarSpinGroup.add(shockwave)

    const emberMat = new T.SpriteMaterial({
      map: emberTex,
      color: 0xffa852,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: T.AdditiveBlending,
    })
    const ember = new T.Sprite(emberMat)
    ember.position.copy(scarBasePos).addScaledVector(scarNormal, 0.14)
    ember.visible = false
    sl9ScarSpinGroup.add(ember)

    const scarMat = new T.MeshBasicMaterial({
      map: scarTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
    const scar = new T.Mesh(scarGeo, scarMat)
    scar.position.copy(scarBasePos)
    scar.lookAt(scarBasePos.clone().add(scarNormal))
    const scarScale = (0.72 + frag.sizeWeight * 1.48) * (jupRx / 6.18)
    scar.scale.set(scarScale * 1.15, scarScale, 1)
    scar.visible = false
    sl9ScarSpinGroup.add(scar)

    return {
      frag,
      posLocal: v3(),
      alive: true,
      sprite,
      core,
      fireball,
      fireMat,
      plume,
      plumeMat,
      plumeOpacity,
      shockwave,
      shockMat,
      ember,
      emberMat,
      scar,
      scarMat,
      scarLonRad,
      scarBasePos,
      scarNormal,
    }
  })

  const sl9TrainCenterWorld = v3()
  const sl9ImpactWorld = v3()
  const sl9TrainLabel = tag('', 'star phen-label')
  const sl9ImpactLabel = tag('', 'star phen-label gold')
  const sl9RocheLabel = tag('', 'star phen-label')
  let sl9ActiveBlastId = ''

  function updateSl9(year: number) {
    sl9Jovian.position.copy(jupiter.pos)
    sl9Jovian.rotation.copy(jupiter.axis.rotation)

    const spin = sl9JupiterSpinRad(year)
    jupiter.mesh.rotation.y = spin
    sl9ScarSpinGroup.rotation.y = spin

    // Smoothly pulse Roche limit visibility around the 1992 tidal disruption pass
    const rocheDt = (year - SL9_ROCHE_YEAR) / 0.14
    rocheRingMat.opacity = 0.2 + 0.56 * Math.exp(-0.5 * rocheDt * rocheDt)

    sl9Jovian.updateMatrixWorld(true)
    sl9ImpactWorld.copy(sl9ImpactLocal).applyMatrix4(sl9Jovian.matrixWorld)

    let aliveCount = 0
    scratchA.set(0, 0, 0) // trainSum
    let ribbonCount = 0
    sl9ActiveBlastId = ''
    let newestBlastAge = 999

    for (let i = 0; i < sl9Visuals.length; i++) {
      const v = sl9Visuals[i]
      const span = v.frag.impactYear - SL9_ROCHE_YEAR
      const phase = (year - SL9_ROCHE_YEAR) / span

      if (phase < 1.0) {
        v.alive = true
        sl9OrbitPosition(sl9VisualPhase(phase), v.posLocal)

        if (year < SL9_ROCHE_YEAR) {
          v.sprite.visible = i === 0
          v.core.visible = i === 0
          if (i === 0) {
            v.sprite.position.copy(v.posLocal)
            v.sprite.scale.set(2.05, 2.05, 1)
            v.core.position.copy(v.posLocal)
            v.core.scale.setScalar(1.3)
          }
        } else {
          v.sprite.visible = true
          v.core.visible = true
          const s = 0.65 + v.frag.sizeWeight * 0.96
          v.sprite.position.copy(v.posLocal)
          v.sprite.scale.set(s, s, 1)
          v.core.position.copy(v.posLocal)
          v.core.scale.setScalar(0.55 + v.frag.sizeWeight * 0.65)
        }

        scratchA.add(v.posLocal)
        aliveCount++
        trainRibbonPts[ribbonCount * 3] = v.posLocal.x
        trainRibbonPts[ribbonCount * 3 + 1] = v.posLocal.y
        trainRibbonPts[ribbonCount * 3 + 2] = v.posLocal.z
        ribbonCount++

        v.fireball.visible = false
        v.plume.visible = false
        v.shockwave.visible = false
        v.ember.visible = false
        v.scar.visible = false
      } else {
        v.alive = false
        v.sprite.visible = false
        v.core.visible = false

        const ageHours = (year - v.frag.impactYear) * 365.25 * 24
        if (ageHours >= 0 && ageHours < 5.2) {
          const t = ageHours / 5.2
          // Smooth bell rise & exponential cooling tail (zero sharp edges!)
          const rise = Math.sin(Math.min(1, t * 4.2) * Math.PI * 0.5)
          const decay = Math.pow(1 - t, 1.55)
          const flashEnv = rise * decay

          const liveLon = v.scarLonRad + spin
          jupiterSurfacePoint(v.frag.latDeg * rad, liveLon, 1.03, scratchB) // hitPt
          scratchC.copy(scratchB).normalize() // hitNorm

          v.fireball.visible = true
          v.fireball.position.copy(scratchB).addScaledVector(scratchC, 0.22 + t * 0.9 * v.frag.sizeWeight)
          const fbScale =
            (1.65 + v.frag.sizeWeight * 3.85) * (0.45 + 0.95 * Math.sin(Math.min(1, t * 2.6) * Math.PI * 0.5))
          v.fireball.scale.set(fbScale, fbScale, 1)
          v.fireMat.opacity = clamp(flashEnv * 1.2, 0, 1)

          v.plume.visible = true
          v.plume.position.copy(scratchB)
          v.plume.quaternion.setFromUnitVectors(upAxis, scratchC)
          const pHeight = (0.48 + v.frag.sizeWeight * 1.15) * Math.sin(Math.min(1, t * 1.35) * Math.PI)
          const pWidth = 0.55 + t * 1.35 * v.frag.sizeWeight
          v.plume.scale.set(pWidth, Math.max(0.05, pHeight), pWidth)
          const pAlpha = clamp(flashEnv * 0.92, 0, 0.95)
          v.plumeOpacity.value = pAlpha
          if (!webgl) (v.plumeMat as T.MeshBasicMaterial).opacity = pAlpha * 0.72

          // Expanding surface shockwave ring across Jupiter's southern cloud deck!
          const swT = clamp(ageHours / 3.2, 0, 1)
          if (swT < 1) {
            v.shockwave.visible = true
            const swR = (0.35 + swT * (1.35 + v.frag.sizeWeight * 1.55)) * (jupRx / 6.18)
            v.shockwave.scale.set(swR, swR, 1)
            v.shockMat.opacity = (1 - swT) * (1 - swT) * 0.78
          } else {
            v.shockwave.visible = false
          }

          // Glowing incandescent cooling ember that melts smoothly into the dark soot scar!
          v.ember.visible = true
          const emberScale = (0.95 + v.frag.sizeWeight * 1.65) * (0.7 + 0.4 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5))
          v.ember.scale.set(emberScale, emberScale, 1)
          v.emberMat.opacity = clamp(Math.pow(1 - t, 1.2) * 0.88, 0, 0.9)

          if (ageHours < newestBlastAge) {
            newestBlastAge = ageHours
            sl9ActiveBlastId = v.frag.id
          }
        } else {
          v.fireball.visible = false
          v.plume.visible = false
          v.shockwave.visible = false
          v.ember.visible = false
        }

        v.scar.visible = true
        const scarFadeIn = clamp(ageHours / 0.85, 0.18, 1)
        v.scarMat.opacity = (0.68 + v.frag.sizeWeight * 0.28) * scarFadeIn
      }
    }

    trainRibbon.visible = year >= SL9_ROCHE_YEAR && ribbonCount >= 2
    trainRibbonGeo.setDrawRange(0, ribbonCount)
    trainRibbonGeo.attributes.position.needsUpdate = true

    if (aliveCount > 0) {
      sl9TrainCenterWorld.copy(scratchA).divideScalar(aliveCount).applyMatrix4(sl9Jovian.matrixWorld)
    } else {
      sl9TrainCenterWorld.copy(sl9ImpactWorld)
    }
  }

  // =========================================================================
  // 3. 2020 GREAT CONJUNCTION OF JUPITER & SATURN (土木大合)
  // =========================================================================
  const conjGroup = new T.Group()
  root.add(conjGroup)

  const conjRayPts = new Float32Array(4 * 3)
  const conjRayGeo = new T.BufferGeometry()
  conjRayGeo.setAttribute('position', new T.BufferAttribute(conjRayPts, 3))
  const conjRayMat = new T.LineBasicMaterial({
    color: 0xffd274,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: T.AdditiveBlending,
  })
  const conjRays = new T.LineSegments(conjRayGeo, conjRayMat)
  conjGroup.add(conjRays)

  // Smooth angular separation arc between Earth->Jupiter and Earth->Saturn sightlines
  const CONJ_ARC_SEGS = 48
  const conjArcPts = new Float32Array((CONJ_ARC_SEGS + 1) * 3)
  const conjArcGeo = new T.BufferGeometry()
  conjArcGeo.setAttribute('position', new T.BufferAttribute(conjArcPts, 3))
  const conjArcMat = new T.LineBasicMaterial({
    color: 0x86e8ff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: T.AdditiveBlending,
  })
  const conjArc = new T.Line(conjArcGeo, conjArcMat)
  conjGroup.add(conjArc)

  const wedgePts = new Float32Array(3 * 3)
  const wedgeGeo = new T.BufferGeometry()
  wedgeGeo.setAttribute('position', new T.BufferAttribute(wedgePts, 3))
  const wedgeMat = new T.MeshBasicMaterial({
    color: 0x62dcff,
    transparent: true,
    opacity: 0.14,
    side: T.DoubleSide,
    depthWrite: false,
    blending: T.AdditiveBlending,
  })
  const conjWedge = new T.Mesh(wedgeGeo, wedgeMat)
  conjGroup.add(conjWedge)

  const conjTargets = [earth, jupiter, saturn].map((w) => {
    const ring = new T.Line(
      new T.BufferGeometry().setFromPoints(makeCirclePoints(w.r * 1.95 + 1.4, 56)),
      new T.LineBasicMaterial({
        color: w.id === 'Earth' ? 0x62e2ff : 0xffd274,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    )
    conjGroup.add(ring)
    return { world: w, ring }
  })

  const conjStarMat = new T.SpriteMaterial({
    map: glowRingTex,
    color: 0xffe49c,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
  })
  const conjStarGlow = new T.Sprite(conjStarMat)
  conjGroup.add(conjStarGlow)

  const conjMidWorld = v3()
  const conjLabel = tag('', 'star phen-label gold')
  let conjSepDeg = 0.1

  function updateConjunction(year: number) {
    const state = computeConjunctionState(year)
    conjSepDeg = state.sepDeg
    const peakness = clamp((6 - state.sepDeg) / 5.8, 0, 1)

    tmpColor.copy(conjCyanColor).lerp(conjGoldColor, peakness)
    conjRayMat.color.copy(tmpColor)
    conjRayMat.opacity = 0.45 + peakness * 0.48
    conjArcMat.color.copy(tmpColor)
    conjArcMat.opacity = 0.35 + peakness * 0.55
    wedgeMat.color.copy(tmpColor)
    wedgeMat.opacity = 0.08 + peakness * 0.14

    const ePos = earth.pos
    const jPos = jupiter.pos
    const sPos = saturn.pos
    const distES = ePos.distanceTo(sPos)
    const distEJ = ePos.distanceTo(jPos)
    scratchA.subVectors(jPos, ePos).normalize() // dirEJ
    scratchB.subVectors(sPos, ePos).normalize() // dirES
    scratchC.copy(scratchA).multiplyScalar(distES).add(ePos) // jExt

    conjRayPts[0] = ePos.x
    conjRayPts[1] = ePos.y
    conjRayPts[2] = ePos.z
    conjRayPts[3] = scratchC.x
    conjRayPts[4] = scratchC.y
    conjRayPts[5] = scratchC.z
    conjRayPts[6] = ePos.x
    conjRayPts[7] = ePos.y
    conjRayPts[8] = ePos.z
    conjRayPts[9] = sPos.x
    conjRayPts[10] = sPos.y
    conjRayPts[11] = sPos.z
    conjRayGeo.attributes.position.needsUpdate = true

    // Smooth arc between dirEJ and dirES at ~65% of Earth-Jupiter distance
    const arcR = distEJ * 0.74
    for (let i = 0; i <= CONJ_ARC_SEGS; i++) {
      const f = i / CONJ_ARC_SEGS
      scratchD.copy(scratchA).lerp(scratchB, f).normalize().multiplyScalar(arcR).add(ePos)
      conjArcPts[i * 3] = scratchD.x
      conjArcPts[i * 3 + 1] = scratchD.y
      conjArcPts[i * 3 + 2] = scratchD.z
    }
    conjArcGeo.attributes.position.needsUpdate = true

    wedgePts[0] = ePos.x
    wedgePts[1] = ePos.y
    wedgePts[2] = ePos.z
    wedgePts[3] = scratchC.x
    wedgePts[4] = scratchC.y
    wedgePts[5] = scratchC.z
    wedgePts[6] = sPos.x
    wedgePts[7] = sPos.y
    wedgePts[8] = sPos.z
    wedgeGeo.attributes.position.needsUpdate = true

    for (const { world, ring } of conjTargets) {
      ring.position.copy(world.pos)
    }

    conjMidWorld.addVectors(jPos, sPos).multiplyScalar(0.5)
    conjStarGlow.position.copy(jPos).lerp(sPos, 0.35)
    const starScale = 14 + peakness * 26
    conjStarGlow.scale.set(starScale, starScale, 1)
    conjStarMat.opacity = peakness * 0.65
  }

  // =========================================================================
  // 4. 2017 INTERSTELLAR VISITOR 1I/'OUMUAMUA (星际访客 · 奥陌陌)
  // =========================================================================
  const oumGroup = new T.Group()
  root.add(oumGroup)

  const oumSampleTmp = v3()
  function oumuamuaScenePos(year: number, out = v3()): T.Vector3 {
    const sample = sampleOumuamuaAU(year, oumSampleTmp)
    const rScene = mapper.auToScene(sample.rAU)
    const scale = rScene / Math.max(1e-5, sample.rAU)
    return out.copy(sample.auPos).multiplyScalar(scale)
  }

  // High-resolution perihelion-dense hyperbolic path (360 samples with smooth sinh clustering near 2017.69)
  const OUM_SAMPLES = 360
  const oumStartY = 2017.0
  const oumEndY = 2019.0
  const oumPeriY = 2017.69
  const oumYears = new Float64Array(OUM_SAMPLES + 1)
  const oumAllPts: T.Vector3[] = []
  const uMin = Math.asinh((oumStartY - oumPeriY) * 4.5)
  const uMax = Math.asinh((oumEndY - oumPeriY) * 4.5)
  for (let i = 0; i <= OUM_SAMPLES; i++) {
    const u = uMin + (i / OUM_SAMPLES) * (uMax - uMin)
    const y = clamp(oumPeriY + Math.sinh(u) / 4.5, oumStartY, oumEndY)
    oumYears[i] = y
    oumAllPts.push(oumuamuaScenePos(y, v3()))
  }
  const oumFutureLine = new T.Line(
    new T.BufferGeometry().setFromPoints(oumAllPts),
    new T.LineBasicMaterial({ color: 0xa47cff, transparent: true, opacity: 0.34, depthWrite: false }),
  )
  oumGroup.add(oumFutureLine)

  const oumPastPts = new Float32Array((OUM_SAMPLES + 2) * 3)
  const oumPastGeo = new T.BufferGeometry()
  oumPastGeo.setAttribute('position', new T.BufferAttribute(oumPastPts, 3))
  const oumPastLine = new T.Line(
    oumPastGeo,
    new T.LineBasicMaterial({
      color: 0xff7ae0,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  )
  oumGroup.add(oumPastLine)

  const oumCraft = new T.Group()
  const oumRockGeo = new T.IcosahedronGeometry(1, 2)
  const oumPosAttr = oumRockGeo.attributes.position
  const pTmp = v3()
  for (let i = 0; i < oumPosAttr.count; i++) {
    pTmp.fromBufferAttribute(oumPosAttr, i)
    const crag = 1 + 0.14 * Math.sin(pTmp.x * 5.2 + pTmp.y * 3.1) * Math.cos(pTmp.z * 4.4)
    pTmp.set(pTmp.x * 2.55 * crag, pTmp.y * 0.44 * crag, pTmp.z * 0.52 * crag)
    oumPosAttr.setXYZ(i, pTmp.x, pTmp.y, pTmp.z)
  }
  oumRockGeo.computeVertexNormals()
  const oumRock = new T.Mesh(
    oumRockGeo,
    new T.MeshStandardMaterial({
      color: 0xb66252,
      emissive: 0x3b1818,
      roughness: 0.78,
      metalness: 0.15,
    }),
  )
  oumCraft.add(oumRock)

  const oumHalo = new T.Sprite(
    new T.SpriteMaterial({
      map: comaTex,
      color: 0xff8ce6,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  )
  oumHalo.scale.set(5.2, 5.2, 1)
  oumCraft.add(oumHalo)
  oumGroup.add(oumCraft)

  const oumEarthLinkPts = new Float32Array(6)
  const oumEarthLinkGeo = new T.BufferGeometry()
  oumEarthLinkGeo.setAttribute('position', new T.BufferAttribute(oumEarthLinkPts, 3))
  const oumEarthLink = new T.Line(
    oumEarthLinkGeo,
    new T.LineBasicMaterial({ color: 0x62e2ff, transparent: true, opacity: 0.72, depthWrite: false }),
  )
  oumGroup.add(oumEarthLink)

  const oumPosWorld = v3()
  const oumLabel = tag('', 'star phen-label')
  let oumEarthAU = 1.0

  function updateOumuamua(year: number) {
    const s = sampleOumuamuaAU(year, oumSampleTmp)
    oumEarthAU = s.earthAU
    const rScene = mapper.auToScene(s.rAU)
    oumPosWorld.copy(s.auPos).multiplyScalar(rScene / Math.max(1e-5, s.rAU))
    oumCraft.position.copy(oumPosWorld)

    // Binary search perihelion-dense sample table for exact smooth glowing wake up to current instant!
    const clampedY = clamp(year, oumStartY, oumEndY)
    let lo = 0
    let hi = OUM_SAMPLES
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1
      if (oumYears[mid] <= clampedY) lo = mid
      else hi = mid - 1
    }
    const count = Math.max(1, lo + 1)
    for (let i = 0; i < count; i++) {
      const pt = oumAllPts[i]
      oumPastPts[i * 3] = pt.x
      oumPastPts[i * 3 + 1] = pt.y
      oumPastPts[i * 3 + 2] = pt.z
    }
    oumPastPts[count * 3] = oumPosWorld.x
    oumPastPts[count * 3 + 1] = oumPosWorld.y
    oumPastPts[count * 3 + 2] = oumPosWorld.z
    oumPastGeo.setDrawRange(0, count + 1)
    oumPastGeo.attributes.position.needsUpdate = true

    const showLink = s.earthAU < 0.65
    oumEarthLink.visible = showLink
    if (showLink) {
      oumEarthLinkPts[0] = earth.pos.x
      oumEarthLinkPts[1] = earth.pos.y
      oumEarthLinkPts[2] = earth.pos.z
      oumEarthLinkPts[3] = oumPosWorld.x
      oumEarthLinkPts[4] = oumPosWorld.y
      oumEarthLinkPts[5] = oumPosWorld.z
      oumEarthLinkGeo.attributes.position.needsUpdate = true
    }
  }

  function syncSubVisibility() {
    root.visible = activeVisible
    alignGroup.visible = activeVisible && activeId === 'alignment1982'
    sl9Group.visible = activeVisible && activeId === 'sl9_1994'
    conjGroup.visible = activeVisible && activeId === 'conjunction2020'
    oumGroup.visible = activeVisible && activeId === 'oumuamua2017'
  }

  function refreshLabels(lang: Locale) {
    setLabelText(
      alignLabel,
      alignSpanDeg <= 106
        ? pick('九星连珠极值扇区', '9-Body Alignment Peak', lang)
        : pick('九星汇聚扇区', '9-Body Sector', lang),
    )
    setLabelText(sl9TrainLabel, pick('SL9 彗星碎片链', 'SL9 Pearl Train', lang))
    setLabelText(sl9RocheLabel, pick('木星洛希极限', 'Jupiter Roche Limit', lang))
    setLabelText(
      sl9ImpactLabel,
      sl9ActiveBlastId
        ? pick(`碎片 ${sl9ActiveBlastId} 撞击爆发!`, `Fragment ${sl9ActiveBlastId} Impact!`, lang)
        : '',
    )
    setLabelText(
      conjLabel,
      conjSepDeg <= 1.2
        ? pick('0.1° 土木极近大合', '0.1° Great Conjunction', lang)
        : pick('木土会合视线', 'Jup–Sat Sightline', lang),
    )
    setLabelText(oumLabel, pick('1I/ʻOumuamua 奥陌陌', '1I/ʻOumuamua', lang))
  }

  return {
    root,
    setActive(visible: boolean, id: PhenomenonId) {
      activeVisible = visible
      activeId = id
      syncSubVisibility()
    },
    setEpoch(id: PhenomenonId, year: number, lang: Locale, dt = 0, snap = false) {
      activeId = id
      activeYear = year
      syncSubVisibility()
      if (!activeVisible) return
      if (id === 'alignment1982') updateAlignment(year, dt, snap)
      else if (id === 'sl9_1994') updateSl9(year)
      else if (id === 'conjunction2020') updateConjunction(year)
      else updateOumuamua(year)
      refreshLabels(lang)
    },
    update(camera: T.PerspectiveCamera, time: number) {
      if (!activeVisible) return
      if (activeId === 'alignment1982') {
        sectorUniforms.uTime.value = time
        for (const { ring } of alignRings) ring.lookAt(camera.position)
      } else if (activeId === 'conjunction2020') {
        for (const { ring } of conjTargets) ring.lookAt(camera.position)
      } else if (activeId === 'oumuamua2017') {
        oumRock.rotation.set(time * 0.42, time * 0.78, time * 0.27)
        const camDist = camera.position.distanceTo(oumPosWorld)
        const rockScale = clamp(camDist * 0.018, 0.55, 2.2)
        oumRock.scale.setScalar(rockScale)
        const haloScale = clamp(camDist * 0.048, 1.8, 9.5)
        oumHalo.scale.set(haloScale, haloScale, 1)
      }
    },
    getCameraAnchor(id: PhenomenonId, view: string, out = v3()): T.Vector3 {
      if (id === 'alignment1982') return out.set(0, 0, 0)
      if (id === 'sl9_1994') {
        if (view === 'train') return out.copy(sl9TrainCenterWorld).lerp(jupiter.pos, 0.25)
        if (view === 'orbit') return out.copy(jupiter.pos).lerp(sl9TrainCenterWorld, 0.42)
        return out.copy(jupiter.pos)
      }
      if (id === 'conjunction2020') {
        if (view === 'sightline') return out.copy(jupiter.pos).lerp(saturn.pos, 0.24)
        if (view === 'top') return out.copy(earth.pos).lerp(saturn.pos, 0.35)
        return out.copy(earth.pos).lerp(jupiter.pos, 0.52)
      }
      if (view === 'object') return out.copy(oumPosWorld)
      if (view === 'perihelion') return out.set(0, 0, 0)
      return out.copy(oumPosWorld).multiplyScalar(0.32)
    },
    getCameraFraming(
      id: PhenomenonId,
      view: string,
      cameraAspect: number,
      narrowViewport: boolean,
    ): { distance: number; yaw: number; pitch: number } {
      const narrow = Math.max(1, 1.2 / cameraAspect)
      if (id === 'alignment1982') {
        if (view === 'inner') return { distance: 128 * narrow, yaw: 0.4, pitch: 1.18 }
        if (view === 'edge') return { distance: alignOuterR * 2.25 * narrow, yaw: 0.9, pitch: 0.08 }
        if (view === 'overview') return { distance: alignOuterR * 2.35 * narrow, yaw: 0.62, pitch: 0.64 }
        return { distance: alignOuterR * 2.48 * narrow, yaw: 0.14, pitch: 1.44 }
      }
      if (id === 'sl9_1994') {
        const sl9FrontYaw = Math.PI / 2 + SL9_IMPACT_AZ
        if (view === 'south') return { distance: jupRx * 4.3 * narrow, yaw: sl9FrontYaw + 0.15, pitch: -0.92 }
        if (view === 'orbit') return { distance: SL9_APOAPSIS_R * 1.45 * narrow, yaw: sl9FrontYaw + 1.25, pitch: 0.52 }
        if (view === 'train') return { distance: jupRx * 5.6 * narrow, yaw: sl9FrontYaw + 0.92, pitch: 0.14 }
        return { distance: jupRx * 4.6 * narrow, yaw: sl9FrontYaw + 0.55, pitch: -0.22 }
      }
      if (id === 'conjunction2020') {
        if (view === 'sightline') {
          scratchA.subVectors(earth.pos, saturn.pos)
          const sightYaw = Math.atan2(scratchA.x, scratchA.z)
          return { distance: saturn.pos.distanceTo(earth.pos) * 1.16 * narrow, yaw: sightYaw + 0.05, pitch: 0.06 }
        }
        if (view === 'top') return { distance: saturn.a * 2.6 * narrow, yaw: 0.25, pitch: 1.44 }
        if (view === 'side') return { distance: saturn.a * 2.15 * narrow, yaw: 1.2, pitch: 0.1 }
        return { distance: saturn.a * 2.35 * narrow, yaw: 0.72, pitch: narrowViewport ? 0.62 : 0.44 }
      }
      if (view === 'object') return { distance: 11.5 * narrow, yaw: 0.85, pitch: 0.26 }
      if (view === 'perihelion') return { distance: 78 * narrow, yaw: 0.74, pitch: 0.42 }
      if (view === 'side') return { distance: 165 * narrow, yaw: 1.52, pitch: 0.09 }
      return { distance: 158 * narrow, yaw: 0.68, pitch: narrowViewport ? 0.58 : 0.42 }
    },
    collectLabels(project: Project, width: number, height: number, markers: Label[], lang: Locale) {
      if (!activeVisible) return
      refreshLabels(lang)
      const inBounds = (q: ScreenPoint | null) =>
        !!q && q.x > 8 && q.x < width - 8 && q.y > 16 && q.y < height - 16
      if (activeId === 'alignment1982') {
        const q = project(alignSectorAnchor)
        if (inBounds(q)) markers.push({ el: alignLabel, q: q!, r: 6 })
      } else if (activeId === 'sl9_1994') {
        const qTrain = project(sl9TrainCenterWorld)
        if (inBounds(qTrain) && sl9TrainCenterWorld.distanceTo(sl9ImpactWorld) > 2.2) {
          markers.push({ el: sl9TrainLabel, q: qTrain!, r: 10 })
        }
        if (sl9ActiveBlastId) {
          const qHit = project(sl9ImpactWorld)
          if (inBounds(qHit)) markers.unshift({ el: sl9ImpactLabel, q: qHit!, r: 14 })
        }
        if (Math.abs(activeYear - SL9_ROCHE_YEAR) < 0.16) {
          scratchA.set(rocheRingR, 0, 0).applyMatrix4(sl9Jovian.matrixWorld)
          const qR = project(scratchA)
          if (inBounds(qR)) markers.push({ el: sl9RocheLabel, q: qR!, r: 6 })
        }
      } else if (activeId === 'conjunction2020') {
        const q = project(conjMidWorld)
        if (inBounds(q)) markers.unshift({ el: conjLabel, q: q!, r: 10 })
      } else if (activeId === 'oumuamua2017') {
        const q = project(oumPosWorld)
        if (inBounds(q)) markers.unshift({ el: oumLabel, q: q!, r: 10 })
      }
    },
    draw2D(ctx: CanvasRenderingContext2D, project: Project) {
      if (!activeVisible) return
      ctx.save()
      if (activeId === 'alignment1982') {
        const sunQ = project(scratchA.set(0, 0, 0))
        if (sunQ) {
          ctx.beginPath()
          ctx.moveTo(sunQ.x, sunQ.y)
          for (let i = 0; i <= 56; i++) {
            const lon = displayStartLon + (i / 56) * displaySweep
            const q = project(scratchB.set(Math.cos(lon) * alignOuterR, 0, -Math.sin(lon) * alignOuterR))
            if (q) ctx.lineTo(q.x, q.y)
          }
          ctx.closePath()
          ctx.fillStyle = alignSpanDeg <= 106 ? 'rgba(255,201,94,0.16)' : 'rgba(70,200,255,0.10)'
          ctx.fill()
          ctx.strokeStyle = alignSpanDeg <= 106 ? 'rgba(255,212,116,0.75)' : 'rgba(110,224,255,0.5)'
          ctx.lineWidth = 1.4
          ctx.stroke()

          ctx.lineWidth = 1
          ctx.strokeStyle = alignSpanDeg <= 106 ? 'rgba(255,212,120,0.42)' : 'rgba(118,232,255,0.32)'
          for (const id of ALIGNMENT_BODY_IDS) {
            const w = worldById.get(id)
            const q = w ? project(w.pos) : null
            if (!q) continue
            ctx.beginPath()
            ctx.moveTo(sunQ.x, sunQ.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }
      } else if (activeId === 'sl9_1994') {
        ctx.strokeStyle = 'rgba(124,216,255,0.35)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        let started = false
        for (const pt of sl9CurvePts) {
          const q = project(scratchA.copy(pt).applyMatrix4(sl9Jovian.matrixWorld))
          if (q && started) ctx.lineTo(q.x, q.y)
          else if (q) ctx.moveTo(q.x, q.y)
          started = !!q
        }
        ctx.stroke()
        for (const v of sl9Visuals) {
          if (v.alive && v.sprite.visible) {
            const q = project(scratchA.copy(v.posLocal).applyMatrix4(sl9Jovian.matrixWorld))
            if (q) {
              ctx.fillStyle = 'rgba(195,240,255,0.92)'
              ctx.beginPath()
              ctx.arc(q.x, q.y, Math.max(2, q.scale * 0.22), 0, tau)
              ctx.fill()
            }
          } else if (v.fireball.visible) {
            const q = project(scratchA.copy(v.fireball.position).applyMatrix4(sl9Jovian.matrixWorld))
            if (q) {
              ctx.fillStyle = 'rgba(255,196,86,0.92)'
              ctx.beginPath()
              ctx.arc(q.x, q.y, Math.max(5, q.scale * 0.9), 0, tau)
              ctx.fill()
            }
          }
        }
      } else if (activeId === 'conjunction2020') {
        const qE = project(earth.pos)
        const qJ = project(jupiter.pos)
        const qS = project(saturn.pos)
        if (qE && qJ && qS) {
          ctx.strokeStyle = conjSepDeg < 1.2 ? 'rgba(255,212,116,0.85)' : 'rgba(98,220,255,0.65)'
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(qE.x, qE.y)
          ctx.lineTo(qJ.x, qJ.y)
          ctx.moveTo(qE.x, qE.y)
          ctx.lineTo(qS.x, qS.y)
          ctx.stroke()
        }
      } else if (activeId === 'oumuamua2017') {
        ctx.strokeStyle = 'rgba(164,124,255,0.38)'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        let started = false
        for (const pt of oumAllPts) {
          const q = project(pt)
          if (q && started) ctx.lineTo(q.x, q.y)
          else if (q) ctx.moveTo(q.x, q.y)
          started = !!q
        }
        ctx.stroke()
        const qO = project(oumPosWorld)
        if (qO) {
          ctx.fillStyle = '#ff92e6'
          ctx.beginPath()
          ctx.arc(qO.x, qO.y, 4.5, 0, tau)
          ctx.fill()
        }
        if (oumEarthAU < 0.65) {
          const qE = project(earth.pos)
          if (qE && qO) {
            ctx.strokeStyle = 'rgba(98,226,255,0.7)'
            ctx.beginPath()
            ctx.moveTo(qE.x, qE.y)
            ctx.lineTo(qO.x, qO.y)
            ctx.stroke()
          }
        }
      }
      ctx.restore()
    },
    refreshLabels,
    dispose() {
      alignLabel.remove()
      sl9TrainLabel.remove()
      sl9ImpactLabel.remove()
      sl9RocheLabel.remove()
      conjLabel.remove()
      oumLabel.remove()
      for (const tex of ownedTextures) tex.dispose()
      ownedTextures.length = 0
    },
  }
}
