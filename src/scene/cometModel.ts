import * as T from 'three'
import { clamp, orbitPoint, seeded, tau, v3, type Orbit } from './math'
import type { comets } from '../data/comets'
import type { ScreenPoint } from './types'

type Comet = (typeof comets)[number]
type Project = (point: T.Vector3) => ScreenPoint | null

const ORBIT_SAMPLES = 768
const TAIL_SEGMENTS_U = 42
const PARTICLE_COUNT = 220

interface CometVisualProfile {
  seed: number
  nucleusRadius: number
  scaleXYZ: [number, number, number]
  bilobed: number
  craterCount: number
  spinRate: number
  spinTilt: [number, number]
  activityKneeAU: number
  activitySlope: number
  spiralStrength: number
  hasSodiumTail: boolean
  ionLengthMult: number
  dustLengthMult: number
  dustCurve: number
  comaScale: number
  comaCoreColor: [number, number, number]
  comaInnerColor: [number, number, number]
  comaOuterColor: [number, number, number]
  ionNearColor: [number, number, number]
  ionFarColor: [number, number, number]
  dustNearColor: [number, number, number]
  dustFarColor: [number, number, number]
  wakeColor: [number, number, number]
  crustDark: [number, number, number]
  crustMid: [number, number, number]
  iceTint: [number, number, number]
  vents: [number, number, number][]
}

const VISUAL_PROFILES: Record<Comet['id'], CometVisualProfile> = {
  '1P': {
    seed: 198603,
    nucleusRadius: 0.72,
    scaleXYZ: [1.56, 0.88, 0.8],
    bilobed: 0.31,
    craterCount: 10,
    spinRate: 0.24,
    spinTilt: [0.42, -0.28],
    activityKneeAU: 3.6,
    activitySlope: 1.55,
    spiralStrength: 0.14,
    hasSodiumTail: false,
    ionLengthMult: 1.08,
    dustLengthMult: 0.96,
    dustCurve: 0.72,
    comaScale: 1.0,
    comaCoreColor: [0.95, 0.99, 1.0],
    comaInnerColor: [0.36, 0.94, 0.84],
    comaOuterColor: [0.16, 0.66, 0.78],
    ionNearColor: [0.64, 0.94, 1.0],
    ionFarColor: [0.22, 0.54, 0.98],
    dustNearColor: [1.0, 0.94, 0.8],
    dustFarColor: [0.88, 0.72, 0.48],
    wakeColor: [0.62, 0.97, 0.9],
    crustDark: [44, 48, 56],
    crustMid: [96, 98, 102],
    iceTint: [188, 232, 240],
    vents: [
      [0.82, 0.32, 0.46],
      [-0.64, 0.58, 0.5],
      [0.18, -0.74, 0.65],
    ],
  },
  '2P': {
    seed: 202310,
    nucleusRadius: 0.58,
    scaleXYZ: [1.28, 0.92, 0.84],
    bilobed: 0.08,
    craterCount: 12,
    spinRate: 0.36,
    spinTilt: [-0.34, 0.48],
    activityKneeAU: 2.55,
    activitySlope: 1.68,
    spiralStrength: 0.08,
    hasSodiumTail: false,
    ionLengthMult: 0.96,
    dustLengthMult: 0.78,
    dustCurve: 0.8,
    comaScale: 0.88,
    comaCoreColor: [0.96, 1.0, 0.95],
    comaInnerColor: [0.34, 0.92, 0.76],
    comaOuterColor: [0.22, 0.64, 0.66],
    ionNearColor: [0.58, 0.95, 0.98],
    ionFarColor: [0.24, 0.62, 0.94],
    dustNearColor: [1.0, 0.9, 0.7],
    dustFarColor: [0.9, 0.64, 0.38],
    wakeColor: [0.97, 0.82, 0.54],
    crustDark: [54, 48, 44],
    crustMid: [112, 98, 86],
    iceTint: [204, 232, 224],
    vents: [
      [0.74, 0.48, 0.46],
      [-0.52, -0.58, 0.62],
    ],
  },
  'C/1995 O1': {
    seed: 199704,
    nucleusRadius: 0.92,
    scaleXYZ: [1.3, 1.04, 0.94],
    bilobed: 0.14,
    craterCount: 13,
    spinRate: 0.28,
    spinTilt: [0.54, 0.36],
    activityKneeAU: 7.4,
    activitySlope: 1.28,
    spiralStrength: 0.44,
    hasSodiumTail: true,
    ionLengthMult: 1.24,
    dustLengthMult: 1.18,
    dustCurve: 0.68,
    comaScale: 1.22,
    comaCoreColor: [0.98, 0.99, 1.0],
    comaInnerColor: [0.58, 0.84, 1.0],
    comaOuterColor: [0.46, 0.56, 0.98],
    ionNearColor: [0.7, 0.9, 1.0],
    ionFarColor: [0.32, 0.46, 1.0],
    dustNearColor: [1.0, 0.96, 0.86],
    dustFarColor: [0.94, 0.8, 0.58],
    wakeColor: [0.78, 0.82, 1.0],
    crustDark: [48, 52, 66],
    crustMid: [108, 114, 128],
    iceTint: [212, 236, 255],
    vents: [
      [0.76, 0.46, 0.44],
      [-0.72, 0.38, 0.58],
      [0.24, -0.78, 0.58],
      [-0.22, 0.64, -0.74],
    ],
  },
}

function hash3(x: number, y: number, z: number, seed: number) {
  return (
    Math.sin(x * 3.7 + y * 5.3 + z * 4.1 + seed) * 0.5 +
    Math.cos(x * 7.9 - y * 6.1 + z * 8.3 - seed * 1.3) * 0.3 +
    Math.sin(x * 15.1 + y * 13.7 - z * 12.9 + seed * 2.1) * 0.2
  )
}

function buildNucleusGeometry(profile: CometVisualProfile) {
  const rand = seeded(profile.seed)
  const geo = new T.SphereGeometry(1, 44, 32)
  const pos = geo.attributes.position as T.BufferAttribute
  const craters: { cx: number; cy: number; cz: number; r: number; d: number }[] = []
  for (let i = 0; i < profile.craterCount; i++) {
    const theta = rand() * tau
    const phi = Math.acos(2 * rand() - 1)
    craters.push({
      cx: Math.sin(phi) * Math.cos(theta),
      cy: Math.cos(phi),
      cz: Math.sin(phi) * Math.sin(theta),
      r: 0.16 + rand() * 0.24,
      d: 0.055 + rand() * 0.075,
    })
  }
  const s = (profile.seed % 997) * 0.017
  const [sx, sy, sz] = profile.scaleXYZ
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i)
    const ny = pos.getY(i)
    const nz = pos.getZ(i)
    // Broad potato/faceted topography + fine craggy strata
    const macro = hash3(nx * 1.15, ny * 1.15, nz * 1.15, s)
    const ridge = Math.abs(hash3(nx * 2.6, ny * 2.6, nz * 2.6, s + 4.2))
    const grit = hash3(nx * 5.8, ny * 5.8, nz * 5.8, s + 9.7)
    let r = 1.0 + 0.13 * macro - 0.065 * ridge + 0.025 * grit
    // Optional bilobed waist pinch (iconic Halley / 67P contact-binary shape)
    if (profile.bilobed > 0) {
      const waist = Math.exp(-(((nx - 0.06) / 0.34) ** 2))
      const lobeBias = 1.0 + 0.085 * nx
      r *= lobeBias * (1.0 - profile.bilobed * waist)
    }
    // Carved impact pits & sublimation depressions with crisp rims
    for (let c = 0; c < craters.length; c++) {
      const cr = craters[c]
      const dot = clamp(nx * cr.cx + ny * cr.cy + nz * cr.cz, -1, 1)
      const ang = Math.acos(dot)
      if (ang < cr.r * 1.32) {
        const u = ang / cr.r
        if (u < 1.0) {
          r -= cr.d * (1.0 - u * u)
        } else {
          const rim = Math.sin(((u - 1.0) / 0.32) * Math.PI)
          r += cr.d * 0.28 * rim
        }
      }
    }
    pos.setXYZ(i, nx * r * sx, ny * r * sy, nz * r * sz)
  }
  geo.computeVertexNormals()
  return geo
}

function buildNucleusMaps(profile: CometVisualProfile) {
  const w = 512
  const h = 256
  const albedoCanvas = document.createElement('canvas')
  const bumpCanvas = document.createElement('canvas')
  const emissiveCanvas = document.createElement('canvas')
  albedoCanvas.width = bumpCanvas.width = emissiveCanvas.width = w
  albedoCanvas.height = bumpCanvas.height = emissiveCanvas.height = h
  const aCtx = albedoCanvas.getContext('2d')!
  const bCtx = bumpCanvas.getContext('2d')!
  const eCtx = emissiveCanvas.getContext('2d')!
  const aData = aCtx.createImageData(w, h)
  const bData = bCtx.createImageData(w, h)
  const eData = eCtx.createImageData(w, h)

  const vents = profile.vents.map((v) => v3(v[0], v[1], v[2]).normalize())
  const s = (profile.seed % 773) * 0.031
  const [dr, dg, db] = profile.crustDark
  const [mr, mg, mb] = profile.crustMid
  const [ir, ig, ib] = profile.iceTint

  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h
    const phi = v * Math.PI
    const sinP = Math.sin(phi)
    const cosP = Math.cos(phi)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w
      const theta = u * tau
      const nx = -sinP * Math.cos(theta)
      const ny = cosP
      const nz = sinP * Math.sin(theta)

      const n1 = hash3(nx * 2.6, ny * 2.6, nz * 2.6, s)
      const n2 = hash3(nx * 7.2, ny * 7.2, nz * 7.2, s + 3.7)
      const n3 = hash3(nx * 16.5, ny * 16.5, nz * 16.5, s + 7.1)
      const grit = hash3(nx * 31.0, ny * 31.0, nz * 31.0, s + 13.4)
      const regolith = clamp(0.42 + 0.36 * n1 + 0.17 * n2 + 0.09 * n3 + 0.06 * grit, 0, 1)

      // Subtle rocky frost seams along fractured cliff faces
      let frost = clamp((n2 * 0.55 + n3 * 0.55 - 0.58) * 1.15, 0, 0.22)
      let ventGlow = 0
      for (let k = 0; k < vents.length; k++) {
        const d = nx * vents[k].x + ny * vents[k].y + nz * vents[k].z
        if (d > 0.915) {
          const ragged = d + 0.024 * n3 + 0.012 * grit
          const spot = T.MathUtils.smoothstep(ragged, 0.935, 0.994)
          frost = Math.max(frost, spot * 0.72)
          ventGlow = Math.max(ventGlow, spot * spot * spot)
        }
      }

      const idx = 4 * (y * w + x)
      const cr = dr + (mr - dr) * regolith
      const cg = dg + (mg - dg) * regolith
      const cb = db + (mb - db) * regolith
      aData.data[idx] = clamp(cr + (ir - cr) * frost, 0, 255)
      aData.data[idx + 1] = clamp(cg + (ig - cg) * frost, 0, 255)
      aData.data[idx + 2] = clamp(cb + (ib - cb) * frost, 0, 255)
      aData.data[idx + 3] = 255

      const bump = clamp(128 + 64 * n2 + 48 * n3 + 28 * grit - 32 * ventGlow, 0, 255)
      bData.data[idx] = bData.data[idx + 1] = bData.data[idx + 2] = bump
      bData.data[idx + 3] = 255

      const glow = clamp(ventGlow * 235 + frost * 14, 0, 255)
      eData.data[idx] = clamp(glow * 0.78, 0, 255)
      eData.data[idx + 1] = clamp(glow * 0.96, 0, 255)
      eData.data[idx + 2] = clamp(glow, 0, 255)
      eData.data[idx + 3] = 255
    }
  }
  aCtx.putImageData(aData, 0, 0)
  bCtx.putImageData(bData, 0, 0)
  eCtx.putImageData(eData, 0, 0)

  const albedo = new T.CanvasTexture(albedoCanvas)
  albedo.colorSpace = T.SRGBColorSpace
  albedo.wrapS = T.RepeatWrapping
  const bump = new T.CanvasTexture(bumpCanvas)
  bump.wrapS = T.RepeatWrapping
  const emissive = new T.CanvasTexture(emissiveCanvas)
  emissive.colorSpace = T.SRGBColorSpace
  emissive.wrapS = T.RepeatWrapping
  return { albedo, bump, emissive }
}

function makeGlowSpriteTexture(coreRGB: [number, number, number], outerRGB: [number, number, number]) {
  const n = 128
  const c = document.createElement('canvas')
  c.width = c.height = n
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(n, n)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * 2 - 1
      const y = ((j + 0.5) / n) * 2 - 1
      const r = Math.hypot(x, y)
      const k = 4 * (j * n + i)
      if (r >= 1) {
        img.data[k + 3] = 0
        continue
      }
      const core = Math.exp(-16 * r * r)
      const halo = Math.exp(-3.8 * r) * (1 - T.MathUtils.smoothstep(r, 0.58, 1))
      const t = clamp(core * 1.15, 0, 1)
      img.data[k] = clamp((outerRGB[0] * (1 - t) + coreRGB[0] * t) * 255, 0, 255)
      img.data[k + 1] = clamp((outerRGB[1] * (1 - t) + coreRGB[1] * t) * 255, 0, 255)
      img.data[k + 2] = clamp((outerRGB[2] * (1 - t) + coreRGB[2] * t) * 255, 0, 255)
      img.data[k + 3] = clamp((halo * 0.85 + core * 0.35) * 255, 0, 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new T.CanvasTexture(c)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

function makePerihelionBeaconTexture(colorHex: number) {
  const n = 64
  const c = document.createElement('canvas')
  c.width = c.height = n
  const ctx = c.getContext('2d')!
  const col = new T.Color(colorHex)
  const r = Math.round(col.r * 255)
  const g = Math.round(col.g * 255)
  const b = Math.round(col.b * 255)
  const cx = n / 2
  const grad = ctx.createRadialGradient(cx, cx, 1, cx, cx, cx)
  grad.addColorStop(0, 'rgba(255,250,235,0.96)')
  grad.addColorStop(0.24, `rgba(${r},${g},${b},0.72)`)
  grad.addColorStop(0.55, `rgba(${r},${g},${b},0.18)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, n, n)
  // Crisp rotated diamond reticle around the perihelion point
  ctx.strokeStyle = `rgba(${Math.min(255, r + 50)},${Math.min(255, g + 50)},${Math.min(255, b + 50)},0.85)`
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(cx, cx - 10)
  ctx.lineTo(cx + 10, cx)
  ctx.lineTo(cx, cx + 10)
  ctx.lineTo(cx - 10, cx)
  ctx.closePath()
  ctx.stroke()
  const tex = new T.CanvasTexture(c)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

// 3 intersecting axial sheets at 0°, 60°, 120° around the tail spine.
// Because cos²(θ) + cos²(θ-60°) + cos²(θ-120°) ≡ 1.5, view-angle weighting
// yields seamless 360° volumetric appearance with zero hard seams.
function buildCanonicalTailGeometry() {
  const sheets = 3
  const segU = TAIL_SEGMENTS_U
  const vertsPerSheet = (segU + 1) * 2
  const positions = new Float32Array(sheets * vertsPerSheet * 3)
  const indices: number[] = []
  let ptr = 0
  for (let s = 0; s < sheets; s++) {
    const phi = (s * Math.PI) / sheets
    const base = s * vertsPerSheet
    for (let i = 0; i <= segU; i++) {
      const u = i / segU
      // Left edge (v = -1) and Right edge (v = +1)
      positions[ptr++] = u
      positions[ptr++] = -1
      positions[ptr++] = phi
      positions[ptr++] = u
      positions[ptr++] = 1
      positions[ptr++] = phi
    }
    for (let i = 0; i < segU; i++) {
      const a = base + i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.boundingSphere = new T.Sphere(new T.Vector3(), 600)
  return geo
}

const orbitVertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aSunProx;
  varying float vPhase;
  varying float vSunProx;
  void main() {
    vPhase = aPhase;
    vSunProx = aSunProx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const orbitFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uWakeColor;
  uniform float uOpacity;
  uniform float uCometPhase;
  uniform float uTime;
  uniform float uFocused;
  varying float vPhase;
  varying float vSunProx;

  void main() {
    float behind = fract(uCometPhase - vPhase);
    float ahead = fract(vPhase - uCometPhase);
    float nearBodyMask = smoothstep(0.0012, 0.0065, min(behind, ahead));

    // Luminous trailing debris wake (meteoroid stream) right behind the comet
    float nearWake = exp(-behind * 14.0) * smoothstep(0.0, 0.002, behind);
    float midWake = exp(-behind * 3.8) * 0.42;
    float leadCue = exp(-ahead * 34.0) * 0.24;

    // Gentle directional shimmer so prograde vs retrograde motion is legible
    float flow = 0.5 + 0.5 * sin((vPhase * 28.0 - uTime * 0.42) * 6.2831853);
    float periGlow = vSunProx * 0.26;

    float weight = clamp(0.32 + periGlow + midWake + nearWake * 0.95 + leadCue + flow * 0.09 * uFocused, 0.0, 1.25);
    vec3 col = mix(uColor, uWakeColor, clamp(nearWake * 0.85 + midWake * 0.45 + periGlow * 0.4, 0.0, 1.0));
    col += vec3(0.22, 0.28, 0.34) * nearWake;

    float alpha = clamp(uOpacity * weight * mix(1.0, nearBodyMask, uFocused), 0.0, 0.96);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`

const comaVertexShader = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vLocalCam;
  void main() {
    vLocalPos = position;
    vec3 c0 = modelMatrix[0].xyz;
    vec3 c1 = modelMatrix[1].xyz;
    vec3 c2 = modelMatrix[2].xyz;
    vec3 center = modelMatrix[3].xyz;
    vec3 diff = cameraPosition - center;
    vLocalCam = vec3(
      dot(diff, c0) / max(1e-8, dot(c0, c0)),
      dot(diff, c1) / max(1e-8, dot(c1, c1)),
      dot(diff, c2) / max(1e-8, dot(c2, c2))
    );
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const comaFragmentShader = /* glsl */ `
  uniform vec3 uCoreColor;
  uniform vec3 uInnerColor;
  uniform vec3 uOuterColor;
  uniform float uActivity;
  uniform float uTime;
  uniform float uSpiral;
  uniform float uSeed;
  uniform float uCloseDim;
  varying vec3 vLocalPos;
  varying vec3 vLocalCam;

  void main() {
    vec3 seg = vLocalPos - vLocalCam;
    float tExit = length(seg);
    vec3 rd = seg / max(1e-6, tExit);
    float b = dot(vLocalCam, rd);
    float c = dot(vLocalCam, vLocalCam) - 1.0;
    float disc = b * b - c;
    if (disc <= 0.0) discard;
    float halfChord = sqrt(disc);
    float tEntry = max(0.0, -b - halfChord);
    float tClosest = clamp(-b, tEntry, tExit);
    vec3 p = vLocalCam + rd * tClosest;

    // Local frame: -X faces Sun (compressed parabolic bow-front), +X stretches gently anti-sunward
    vec3 q = p;
    q.x *= (p.x < 0.0) ? 1.24 : 0.78;
    float r = length(q);
    if (r >= 1.0) discard;

    float pathFraction = clamp((tExit - tEntry) * 0.5, 0.0, 1.0);
    float core = exp(-15.5 * r * r);
    float inner = exp(-4.8 * r) * (1.0 - smoothstep(0.55, 1.0, r));
    float outer = exp(-2.5 * r) * (1.0 - smoothstep(0.68, 1.0, r));

    // Sunward parabolic dust hood compression (fountain envelope)
    float sunward = smoothstep(0.25, -0.75, p.x / max(0.06, length(p)));
    float bowRidge = exp(-pow((r - 0.34) / 0.14, 2.0)) * sunward * (0.28 + 0.35 * uActivity);

    // Expanding rotating spiral dust shells (iconic on Hale-Bopp)
    float ang = atan(p.z, p.y);
    float spiralWave = 0.5 + 0.5 * sin(r * 16.5 - uTime * 1.45 + ang * 2.0 + uSeed);
    float spiralShell = spiralWave * smoothstep(0.12, 0.32, r) * (1.0 - smoothstep(0.52, 0.88, r)) * (0.45 + 0.55 * sunward) * uSpiral;

    // Soft organic gas turbulence
    float shimmer = 0.92 + 0.08 * sin(r * 11.0 - uTime * 1.1 + ang * 3.0 + uSeed * 1.7);

    float density = (core * 0.62 * uCloseDim + inner * 0.46 + outer * 0.26 + bowRidge * 0.78 + spiralShell * 0.36) * shimmer;
    density *= pow(pathFraction, 0.55) * (0.22 + 0.76 * uActivity);

    vec3 col = mix(uOuterColor, uInnerColor, clamp(inner * 1.05 + bowRidge * 0.75, 0.0, 1.0));
    col = mix(col, uCoreColor, clamp(core * 0.82 + spiralShell * 0.45, 0.0, 1.0));

    float alpha = clamp(density * 0.56, 0.0, 0.76);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`

const jetVertexShader = /* glsl */ `
  uniform vec3 uLocalAway;
  uniform float uLength;
  uniform float uFlare;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    float h = clamp(uv.y, 0.0, 1.0);
    // Taper outward from active vent and curve gracefully back under solar radiation pressure
    vec3 pos = position;
    pos.y *= uLength;
    pos.xz *= mix(0.32, 1.0 + uFlare * 0.45, pow(h, 0.78));
    pos += uLocalAway * (h * h * uLength * 0.62);

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const jetFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    float h = vUv.y;
    float edgeFade = smoothstep(0.0, 0.18, h) * (1.0 - smoothstep(0.32, 0.98, h));
    float flow1 = 0.62 + 0.38 * sin(vUv.x * 25.1327 + uSeed * 5.0 + h * 4.2);
    float flow2 = 0.70 + 0.30 * sin(h * 15.0 - uTime * 4.4 + uSeed * 9.0 + vUv.x * 12.566);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float softEdge = pow(abs(dot(normalize(vNormalW), viewDir)), 1.65);
    float alpha = edgeFade * flow1 * flow2 * softEdge * uIntensity;
    if (alpha < 0.004) discard;
    vec3 col = mix(uColor, vec3(0.96, 0.99, 1.0), (1.0 - h) * 0.42);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.58));
  }
`

const tailVertexShader = /* glsl */ `
  uniform vec3 uDir;
  uniform vec3 uCurveDir;
  uniform vec3 uPlaneNormal;
  uniform float uCurveAmount;
  uniform float uLength;
  uniform float uBaseWidth;
  uniform float uTipWidth;
  uniform float uAspectInPlane;
  uniform float uKind;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUV;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    float u = position.x;
    float v = position.y;
    float phi = position.z;

    float uPow = pow(max(u, 0.0001), 1.85);
    vec3 spine = uLength * (u * uDir + uCurveAmount * uPow * uCurveDir);
    vec3 T = normalize(uDir + uCurveAmount * 1.85 * pow(max(u, 0.001), 0.85) * uCurveDir);

    // Build orthonormal frame aligned with the orbital plane so dust fans naturally widen in-plane
    vec3 N2 = normalize(uPlaneNormal - T * dot(uPlaneNormal, T));
    vec3 N1 = normalize(cross(N2, T));

    // Subtle Kelvin-Helmholtz MHD wave ripple propagating down the ion plasma tail
    if (uKind < 0.5) {
      float wave = sin(u * 10.5 - uTime * 3.1 + uSeed) * 0.022 + sin(u * 18.0 - uTime * 5.2 + uSeed * 2.1) * 0.011;
      spine += (N1 * 0.75 + N2 * 0.45) * (wave * uLength * u * u);
    }

    float halfW = mix(uBaseWidth, uTipWidth, pow(u, 0.84));
    float c = cos(phi);
    float s = sin(phi);
    vec3 side = c * N1 * uAspectInPlane + s * N2;
    vec3 norm = normalize(-s * N1 + c * N2 * uAspectInPlane);

    vec3 localPos = spine + side * (v * halfW);
    vec4 wp = modelMatrix * vec4(localPos, 1.0);
    vWorldPos = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * norm);
    vUV = vec2(u, v);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const tailFragmentShader = /* glsl */ `
  uniform vec3 uColorNear;
  uniform vec3 uColorFar;
  uniform float uOpacity;
  uniform float uKind;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUV;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    float u = vUV.x;
    float v = vUV.y;
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float viewWeight = pow(abs(dot(normalize(vNormalW), viewDir)), 1.5);

    float entry = smoothstep(0.0, 0.055, u);
    float alpha = 0.0;
    vec3 col = mix(uColorNear, uColorFar, smoothstep(0.04, 0.82, u));

    if (uKind < 0.5) {
      // Type I Ion (Plasma) Tail: sleek streaming CO+ filaments + traveling plasma knots
      float fade = exp(-1.95 * u) * (1.0 - smoothstep(0.62, 1.0, u));
      float coreEnv = exp(-5.6 * v * v);
      float outerEnv = exp(-2.0 * v * v) * 0.45;

      float rayPhase = v * (6.2 + 5.5 * u);
      float rays1 = 0.68 + 0.32 * cos(rayPhase + sin(u * 6.0 - uTime * 2.2 + uSeed) * 1.15);
      float rays2 = 0.78 + 0.22 * cos(v * 13.5 - u * 4.5 + uTime * 1.4 + uSeed * 2.3);
      float stream = 0.78 + 0.22 * sin(u * 18.0 - uTime * 5.2 + v * 3.0 + uSeed);

      // Subtle traveling plasma condensation / disconnection pulse
      float knotT = fract(u * 0.85 - uTime * 0.24 + uSeed * 0.37);
      float knot = exp(-pow((knotT - 0.5) * 6.5, 2.0)) * 0.36 * smoothstep(0.08, 0.35, u);

      float profile = (coreEnv * rays1 + outerEnv * rays2) * (stream + knot);
      alpha = entry * fade * profile * viewWeight * uOpacity;
      col += vec3(0.14, 0.24, 0.34) * (coreEnv * (1.0 - u) * 0.42 + knot * 0.55);
    } else if (uKind < 1.5) {
      // Type II Dust Tail: silky curved luminous fan with synchrone striae
      float fade = exp(-1.55 * u) * (1.0 - smoothstep(0.56, 1.0, u));
      // Slight asymmetry: crisper sunward leading edge, softer trailing diffuse veil
      float vSkew = v < 0.0 ? v * 1.24 : v * 0.84;
      float env = exp(-2.55 * vSkew * vSkew) * (1.0 - smoothstep(0.66, 1.0, abs(v)));
      float striae = 0.80 + 0.20 * sin((u * 9.5 - v * 3.4) * 2.1 - uTime * 0.55 + uSeed);
      float drift = 0.90 + 0.10 * sin(u * 12.0 - uTime * 1.15 + uSeed * 1.4);
      alpha = entry * fade * env * striae * drift * viewWeight * uOpacity;
      col += vec3(0.08, 0.06, 0.03) * exp(-4.2 * v * v) * (1.0 - u);
    } else {
      // Neutral Sodium (Na) Tail (Hale-Bopp 3rd tail): slender golden-amber straight beam
      float fade = exp(-2.3 * u) * (1.0 - smoothstep(0.55, 1.0, u));
      float env = exp(-7.2 * v * v);
      float shimmer = 0.82 + 0.18 * sin(u * 15.0 - uTime * 3.4 + uSeed);
      alpha = entry * fade * env * shimmer * viewWeight * uOpacity;
    }

    if (alpha < 0.0025) discard;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.46));
  }
`

const particleVertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  attribute float aKind;
  attribute vec3 aSpread;

  uniform vec3 uAway;
  uniform vec3 uCurveDir;
  uniform vec3 uPlaneNormal;
  uniform float uIonLen;
  uniform float uDustLen;
  uniform float uCurveAmount;
  uniform float uComaR;
  uniform float uActivity;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPointScale;

  varying float vAlpha;
  varying float vKind;

  void main() {
    float rate = aSpeed * (0.55 + 0.85 * uActivity);
    float t = fract(aSeed + uTime * rate);
    vec3 N2 = uPlaneNormal;
    vec3 N1 = normalize(cross(N2, uAway));

    vec3 localPos;
    float baseSize;

    if (aKind < 0.5) {
      // Warm sunlit dust grains drifting along the curved dust tail
      float u = t;
      vec3 spine = uDustLen * (u * uAway + uCurveAmount * pow(max(u, 0.0001), 1.85) * uCurveDir);
      float spread = uComaR * 0.25 + u * uDustLen * 0.11;
      localPos = spine + (N1 * aSpread.x * 1.25 + N2 * aSpread.y * 0.65 + uAway * aSpread.z * 0.25) * spread;
      baseSize = 2.6 + fract(aSeed * 19.3) * 2.4;
      vAlpha = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.52, 1.0, t)) * (0.28 + 0.72 * uActivity);
    } else if (aKind < 1.5) {
      // Fast blue ion plasma sparks streaming straight down the ion tail
      float u = t;
      vec3 ionDir = normalize(uAway + uCurveDir * 0.06);
      float spread = uComaR * 0.14 + u * uIonLen * 0.032;
      localPos = ionDir * (u * uIonLen) + (N1 * aSpread.x + N2 * aSpread.y) * spread;
      baseSize = 2.1 + fract(aSeed * 31.7) * 1.9;
      vAlpha = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.48, 1.0, t)) * (0.22 + 0.78 * uActivity);
    } else {
      // Sunward fountain dust motes turning back under radiation pressure around coma
      float s = t;
      float sunPush = -uComaR * (0.85 * s - 1.35 * s * s);
      float lat = uComaR * (0.22 + 0.95 * s);
      localPos = uAway * sunPush + (N1 * aSpread.x + N2 * aSpread.y) * lat;
      baseSize = 2.2 + fract(aSeed * 43.1) * 1.8;
      vAlpha = smoothstep(0.0, 0.16, s) * (1.0 - smoothstep(0.6, 1.0, s)) * (0.3 + 0.7 * uActivity);
    }

    vec4 mv = modelViewMatrix * vec4(localPos, 1.0);
    float depth = max(0.5, -mv.z);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.72 + 0.28 * sin(uTime * 6.0 + aSeed * 80.0);
    gl_PointSize = clamp(baseSize * uPixelRatio * uPointScale / pow(depth, 0.42), 1.0, 8.5);
    vAlpha *= twinkle;
    vKind = aKind;
  }
`

const particleFragmentShader = /* glsl */ `
  uniform vec3 uDustColor;
  uniform vec3 uIonColor;
  uniform vec3 uComaColor;
  varying float vAlpha;
  varying float vKind;

  void main() {
    vec2 p = 2.0 * gl_PointCoord - 1.0;
    float r2 = dot(p, p);
    if (r2 >= 1.0) discard;
    float soft = exp(-3.4 * r2) * (1.0 - smoothstep(0.55, 1.0, r2));
    vec3 col = vKind < 0.5 ? uDustColor : (vKind < 1.5 ? uIonColor : uComaColor);
    float a = soft * vAlpha * 0.72;
    if (a < 0.006) discard;
    gl_FragColor = vec4(col, a);
  }
`

function buildParticleGeometry(seed: number) {
  const rand = seeded(seed + 7121)
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const seeds = new Float32Array(PARTICLE_COUNT)
  const speeds = new Float32Array(PARTICLE_COUNT)
  const kinds = new Float32Array(PARTICLE_COUNT)
  const spreads = new Float32Array(PARTICLE_COUNT * 3)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    seeds[i] = rand()
    const pick = rand()
    const kind = pick < 0.52 ? 0 : pick < 0.82 ? 1 : 2
    kinds[i] = kind
    speeds[i] = kind === 1 ? 0.34 + rand() * 0.36 : kind === 0 ? 0.11 + rand() * 0.14 : 0.16 + rand() * 0.18
    // Approximate Gaussian transverse offset
    const gx = (rand() + rand() + rand() - 1.5) * 0.9
    const gy = (rand() + rand() + rand() - 1.5) * 0.9
    const gz = (rand() - 0.5) * 1.4
    spreads[i * 3] = gx
    spreads[i * 3 + 1] = gy
    spreads[i * 3 + 2] = gz
  }

  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(positions, 3))
  geo.setAttribute('aSeed', new T.BufferAttribute(seeds, 1))
  geo.setAttribute('aSpeed', new T.BufferAttribute(speeds, 1))
  geo.setAttribute('aKind', new T.BufferAttribute(kinds, 1))
  geo.setAttribute('aSpread', new T.BufferAttribute(spreads, 3))
  geo.boundingSphere = new T.Sphere(new T.Vector3(), 600)
  return geo
}

// High-resolution true-anomaly sampling (uniform dν = 360°/768 ≈ 0.47°) eliminates
// perihelion polygonal kinks even at e = 0.995 (Hale-Bopp), and C1 Catmull-Rom
// interpolation guarantees smooth velocity tangents with zero dust-tail jitter.
function createCometTrajectory(comet: Comet, elements: Orbit, auToScene: (au: number) => number) {
  const N = ORBIT_SAMPLES
  const p = comet.a * (1 - comet.e * comet.e)
  const sqrtOneMinusE2 = Math.sqrt(1 - comet.e * comet.e)
  const positions = new Float32Array(N * 3)
  const sunProx = new Float32Array(N)
  const points: T.Vector3[] = new Array(N)
  const keplerFrac = new Float64Array(N + 1)
  const arcLen = new Float64Array(N + 1)
  const times = new Float64Array(N + 1)

  for (let i = 0; i < N; i++) {
    const nu = (tau * i) / N
    const cosNu = Math.cos(nu)
    const sinNu = Math.sin(nu)
    const denom = 1 + comet.e * cosNu
    const rAU = p / denom
    const sceneR = auToScene(rAU)
    const pt = v3()
      .copy(elements.u)
      .multiplyScalar(cosNu * sceneR)
      .addScaledVector(elements.v, sinNu * sceneR)
    points[i] = pt
    positions[i * 3] = pt.x
    positions[i * 3 + 1] = pt.y
    positions[i * 3 + 2] = pt.z
    sunProx[i] = 1 / (1 + (rAU / 3.8) ** 1.35)

    // Convert true anomaly ν -> eccentric anomaly E -> mean anomaly fraction
    const cosE = (comet.e + cosNu) / denom
    const sinE = (sqrtOneMinusE2 * sinNu) / denom
    let E = i === 0 ? 0 : Math.atan2(sinE, cosE)
    if (E < 0) E += tau
    keplerFrac[i] = (E - comet.e * Math.sin(E)) / tau
  }
  keplerFrac[N] = 1

  for (let i = 1; i <= N; i++) {
    arcLen[i] = arcLen[i - 1] + points[i - 1].distanceTo(points[i % N])
  }
  const totalArc = arcLen[N]
  for (let i = 1; i <= N; i++) {
    // Balanced blend: unmistakable Kepler acceleration around perihelion while keeping
    // the entire inner-system passage gracefully observable at 1× playback speed.
    times[i] = 0.64 * (arcLen[i] / totalArc) + 0.36 * keplerFrac[i]
  }
  times[N] = 1

  const phases = new Float32Array(N)
  for (let i = 0; i < N; i++) phases[i] = times[i]

  // Convert comet.startDeg (eccentric anomaly in degrees) to exact phase on our true-anomaly table
  const startE = (((comet.startDeg * Math.PI) / 180) % tau + tau) % tau
  const startNuRaw = Math.atan2(sqrtOneMinusE2 * Math.sin(startE), Math.cos(startE) - comet.e)
  const startNu = startNuRaw < 0 ? startNuRaw + tau : startNuRaw
  const startIdxF = (startNu / tau) * N
  const sLo = Math.floor(startIdxF) % N
  const sFrac = startIdxF - Math.floor(startIdxF)
  const startPhase = times[sLo] + (times[sLo + 1] - times[sLo]) * sFrac

  // Target phase for "Jump to Perihelion" (inbound ~65° before perihelion for a full slingshot fly-through)
  const periLeadIdx = Math.round(((tau - 1.12) / tau) * N) % N
  const periLeadPhase = times[periLeadIdx]

  const period = 48 * comet.a ** 0.28

  // Verify analytical orbitPoint consistency (keeps import meaningful for orbital reference)
  const perihelionPos = points[0].clone()
  const _check = orbitPoint(elements, 0, v3())
  if (_check.lengthSq() > 0) perihelionPos.copy(_check).setLength(auToScene(comet.a * (1 - comet.e)))

  let phaseOffset = 0
  let currentPhase = startPhase

  function sample(clock: number, out: T.Vector3, tangent: T.Vector3) {
    const raw = (startPhase + clock / period + phaseOffset) % 1
    const phase = raw < 0 ? raw + 1 : raw
    currentPhase = phase
    let lo = 0
    let hi = N
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1
      if (times[mid] <= phase) lo = mid
      else hi = mid
    }
    const span = Math.max(1e-9, times[hi] - times[lo])
    const f = clamp((phase - times[lo]) / span, 0, 1)

    // C1-continuous Catmull-Rom position & analytical tangent
    const p0 = points[(lo - 1 + N) % N]
    const p1 = points[lo % N]
    const p2 = points[(lo + 1) % N]
    const p3 = points[(lo + 2) % N]
    const f2 = f * f
    const f3 = f2 * f

    out.set(
      0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * f +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3),
      0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * f +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3),
      0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * f +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * f2 +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * f3),
    )

    tangent
      .set(
        0.5 *
          ((-p0.x + p2.x) +
            2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f +
            3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f2),
        0.5 *
          ((-p0.y + p2.y) +
            2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f +
            3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f2),
        0.5 *
          ((-p0.z + p2.z) +
            2 * (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * f +
            3 * (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * f2),
      )
      .normalize()

    const nu = (tau * ((lo + f) % N)) / N
    const rAU = p / (1 + comet.e * Math.cos(nu))
    // True heliocentric vis-viva orbital speed in km/s (Earth circular v0 = 29.7847 km/s)
    const speedKmS = 29.7847 * Math.sqrt(Math.max(0.0001, 2 / rAU - 1 / comet.a))
    return { rAU, speedKmS, phase }
  }

  function seekPerihelion(clock: number) {
    const base = (startPhase + clock / period) % 1
    phaseOffset = periLeadPhase - base
  }

  return {
    positions,
    phases,
    sunProx,
    points,
    perihelionPos,
    sample,
    seekPerihelion,
    get phase() {
      return currentPhase
    },
  }
}

export function createCometModel(
  comet: Comet,
  elements: Orbit,
  auToScene: (au: number) => number,
  webgl: boolean,
) {
  const profile = VISUAL_PROFILES[comet.id]
  const trajectory = createCometTrajectory(comet, elements, auToScene)

  // 1. Dynamic Orbital Trajectory Group (Shader LineLoop + Perihelion Beacon)
  const orbitGroup = new T.Group()
  orbitGroup.name = comet.id + '-orbit'
  const orbitGeo = new T.BufferGeometry()
  orbitGeo.setAttribute('position', new T.BufferAttribute(trajectory.positions, 3))
  orbitGeo.setAttribute('aPhase', new T.BufferAttribute(trajectory.phases, 1))
  orbitGeo.setAttribute('aSunProx', new T.BufferAttribute(trajectory.sunProx, 1))

  const orbitUniforms = {
    uColor: { value: new T.Color(comet.color) },
    uWakeColor: { value: new T.Color(...profile.wakeColor) },
    uOpacity: { value: 0 },
    uCometPhase: { value: trajectory.phase },
    uTime: { value: 0 },
    uFocused: { value: 0 },
  }
  const orbitMat = webgl
    ? new T.ShaderMaterial({
        vertexShader: orbitVertexShader,
        fragmentShader: orbitFragmentShader,
        uniforms: orbitUniforms,
        transparent: true,
        depthWrite: false,
      })
    : new T.LineBasicMaterial({
        color: comet.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
  const orbitLine = new T.LineLoop(orbitGeo, orbitMat)
  orbitLine.visible = false
  orbitLine.renderOrder = 0
  orbitGroup.add(orbitLine)

  const beaconTex = webgl ? makePerihelionBeaconTexture(comet.color) : null
  const periBeacon = webgl
    ? new T.Sprite(
        new T.SpriteMaterial({
          map: beaconTex,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: T.AdditiveBlending,
          toneMapped: false,
        }),
      )
    : null
  if (periBeacon) {
    periBeacon.position.copy(trajectory.perihelionPos)
    periBeacon.visible = false
    periBeacon.renderOrder = 2
    orbitGroup.add(periBeacon)
  }

  // 2. Comet 3D Body Root
  const root = new T.Group()
  root.name = comet.id + '/' + comet.en

  const disposables: { dispose(): void }[] = [orbitGeo, orbitMat]
  if (beaconTex) disposables.push(beaconTex)
  if (periBeacon) disposables.push(periBeacon.material)

  // 2a. Sculpted Rotating 3D Rocky-Icy Nucleus + Sunward Active Jets
  const nucleusTiltGroup = new T.Group()
  nucleusTiltGroup.rotation.set(profile.spinTilt[0], 0, profile.spinTilt[1])
  const nucleusSpinGroup = new T.Group()
  nucleusTiltGroup.add(nucleusSpinGroup)
  root.add(nucleusTiltGroup)

  let nucleusMesh: T.Mesh | null = null
  let nucleusMat: T.MeshPhongMaterial | null = null
  interface JetEntry {
    mesh: T.Mesh
    localDir: T.Vector3
    invLocalQuat: T.Quaternion
    uniforms: {
      uLocalAway: { value: T.Vector3 }
      uLength: { value: number }
      uFlare: { value: number }
      uColor: { value: T.Color }
      uIntensity: { value: number }
      uTime: { value: number }
      uSeed: { value: number }
    }
  }
  const jets: JetEntry[] = []

  if (webgl) {
    const nucGeo = buildNucleusGeometry(profile)
    const maps = buildNucleusMaps(profile)
    nucleusMat = new T.MeshPhongMaterial({
      color: 0xffffff,
      map: maps.albedo,
      bumpMap: maps.bump,
      bumpScale: 0.14,
      emissive: new T.Color(...profile.comaInnerColor),
      emissiveMap: maps.emissive,
      emissiveIntensity: 0.3,
      specular: new T.Color(0x6b8299),
      shininess: 18,
    })
    nucleusMesh = new T.Mesh(nucGeo, nucleusMat)
    nucleusMesh.renderOrder = 2
    nucleusSpinGroup.add(nucleusMesh)
    disposables.push(nucGeo, nucleusMat, maps.albedo, maps.bump, maps.emissive)

    // Sunward active outgassing jets anchored to surface vents on the rotating nucleus
    const jetGeo = new T.CylinderGeometry(0.62, 0.08, 1.0, 18, 10, true)
    jetGeo.translate(0, 0.5, 0)
    disposables.push(jetGeo)

    const upY = v3(0, 1, 0)
    for (let j = 0; j < profile.vents.length; j++) {
      const vDir = v3(...profile.vents[j]).normalize()
      const uniforms = {
        uLocalAway: { value: v3(1, 0, 0) },
        uLength: { value: 2.2 },
        uFlare: { value: 0.5 },
        uColor: { value: new T.Color(...profile.comaInnerColor) },
        uIntensity: { value: 0 },
        uTime: { value: 0 },
        uSeed: { value: profile.seed * 0.001 + j * 3.17 },
      }
      const jMat = new T.ShaderMaterial({
        vertexShader: jetVertexShader,
        fragmentShader: jetFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
      })
      const jMesh = new T.Mesh(jetGeo, jMat)
      // Seat base slightly inside the sculpted nucleus surface along ventDir so plumes emerge organically
      jMesh.position.set(
        vDir.x * profile.scaleXYZ[0] * 0.78,
        vDir.y * profile.scaleXYZ[1] * 0.78,
        vDir.z * profile.scaleXYZ[2] * 0.78,
      )
      jMesh.quaternion.setFromUnitVectors(upY, vDir)
      const invLocalQuat = jMesh.quaternion.clone().invert()
      jMesh.renderOrder = 3
      jMesh.frustumCulled = false
      nucleusSpinGroup.add(jMesh)
      jets.push({ mesh: jMesh, localDir: vDir, invLocalQuat, uniforms })
      disposables.push(jMat)
    }
  }

  // 2b. Volumetric 3D Coma (Asymmetric Sunward Bow-Front + Spiral Shells + Overview Core Glow)
  const comaGroup = new T.Group()
  root.add(comaGroup)
  const comaUniforms = {
    uCoreColor: { value: new T.Color(...profile.comaCoreColor) },
    uInnerColor: { value: new T.Color(...profile.comaInnerColor) },
    uOuterColor: { value: new T.Color(...profile.comaOuterColor) },
    uActivity: { value: 0.5 },
    uTime: { value: 0 },
    uSpiral: { value: profile.spiralStrength },
    uSeed: { value: (profile.seed % 1000) * 0.13 },
    uCloseDim: { value: 1.0 },
  }
  let comaMesh: T.Mesh | null = null
  let coreHalo: T.Sprite | null = null
  if (webgl) {
    const comaGeo = new T.SphereGeometry(1, 36, 24)
    const comaMat = new T.ShaderMaterial({
      vertexShader: comaVertexShader,
      fragmentShader: comaFragmentShader,
      uniforms: comaUniforms,
      side: T.BackSide,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    })
    comaMesh = new T.Mesh(comaGeo, comaMat)
    comaMesh.renderOrder = 3
    comaMesh.frustumCulled = false
    comaGroup.add(comaMesh)
    disposables.push(comaGeo, comaMat)

    const haloTex = makeGlowSpriteTexture(profile.comaCoreColor, profile.comaInnerColor)
    const haloMat = new T.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
    })
    coreHalo = new T.Sprite(haloMat)
    coreHalo.renderOrder = 4
    root.add(coreHalo)
    disposables.push(haloTex, haloMat)
  }

  // 2c. True 3D Volumetric Curved Tails (Ion + Dust + optional Hale-Bopp Sodium Tail)
  const tailGeo = webgl ? buildCanonicalTailGeometry() : null
  if (tailGeo) disposables.push(tailGeo)

  function makeTailLayer(kind: number, nearRGB: [number, number, number], farRGB: [number, number, number]) {
    const uniforms = {
      uDir: { value: v3(1, 0, 0) },
      uCurveDir: { value: v3(0, 0, 1) },
      uPlaneNormal: { value: v3(0, 1, 0) },
      uCurveAmount: { value: kind === 1 ? profile.dustCurve : kind === 2 ? 0.16 : 0.045 },
      uLength: { value: 20 },
      uBaseWidth: { value: 1.2 },
      uTipWidth: { value: 4.0 },
      uAspectInPlane: { value: kind === 1 ? 1.38 : 1.0 },
      uKind: { value: kind },
      uColorNear: { value: new T.Color(...nearRGB) },
      uColorFar: { value: new T.Color(...farRGB) },
      uOpacity: { value: 0.6 },
      uTime: { value: 0 },
      uSeed: { value: (profile.seed % 991) * 0.07 + kind * 4.3 },
    }
    const mat = new T.ShaderMaterial({
      vertexShader: tailVertexShader,
      fragmentShader: tailFragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
    })
    const mesh = new T.Mesh(tailGeo!, mat)
    mesh.renderOrder = kind === 1 ? 1 : 2
    mesh.frustumCulled = false
    root.add(mesh)
    disposables.push(mat)
    return { mesh, uniforms }
  }

  const dustTail = webgl ? makeTailLayer(1, profile.dustNearColor, profile.dustFarColor) : null
  const ionTail = webgl ? makeTailLayer(0, profile.ionNearColor, profile.ionFarColor) : null
  const sodiumTail =
    webgl && profile.hasSodiumTail ? makeTailLayer(2, [1.0, 0.86, 0.48], [0.95, 0.56, 0.18]) : null

  // 2d. GPU-Advected Dust & Ion Particle Stream
  const particleUniforms = {
    uAway: { value: v3(1, 0, 0) },
    uCurveDir: { value: v3(0, 0, 1) },
    uPlaneNormal: { value: v3(0, 1, 0) },
    uIonLen: { value: 22 },
    uDustLen: { value: 18 },
    uCurveAmount: { value: profile.dustCurve },
    uComaR: { value: 3.0 },
    uActivity: { value: 0.5 },
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uPointScale: { value: 1 },
    uDustColor: { value: new T.Color(...profile.dustNearColor) },
    uIonColor: { value: new T.Color(...profile.ionNearColor) },
    uComaColor: { value: new T.Color(...profile.comaInnerColor) },
  }
  let particles: T.Points | null = null
  if (webgl) {
    const pGeo = buildParticleGeometry(profile.seed)
    const pMat = new T.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: particleUniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    })
    particles = new T.Points(pGeo, pMat)
    particles.renderOrder = 3
    particles.frustumCulled = false
    root.add(particles)
    disposables.push(pGeo, pMat)
  }

  // Runtime state & scratch vectors (zero per-frame heap allocations)
  const tangent = v3(1, 0, 0)
  const away = v3(1, 0, 0)
  const trailDir = v3(0, 0, 1)
  const planeNormal = v3(0, 1, 0)
  const comaY = v3()
  const comaZ = v3()
  const basisMat = new T.Matrix4()
  const tipPos = v3()
  const invNucQuat = new T.Quaternion()
  const nucWorldQuat = new T.Quaternion()
  const ventWorldDir = v3()
  const localAwayTmp = v3()

  let radiusAU = 1
  let speedKmS = 30
  let activity = 0.5
  let pickPx = 18
  let labelLeft = false
  let targetOrbitOpacity = 0
  let currentOrbitOpacity = 0
  let orbitFocused = 0
  let lastClock = 0

  // 2D fallback cached screen-space vectors
  let screenIonDx = 1
  let screenIonDy = 0
  let screenDustDx = 1
  let screenDustDy = 0
  let screenDustMidDx = 1
  let screenDustMidDy = 0
  let screenComaR = 10

  function computeActivity(rAU: number) {
    // Physically motivated sublimation curve: quiet in outer system, surging inside the snow line
    const x = rAU / profile.activityKneeAU
    const raw = 1 / (1 + x ** profile.activitySlope)
    return clamp(raw, 0.04, 1.0)
  }

  function advance(clock: number) {
    lastClock = clock
    const s = trajectory.sample(clock, root.position, tangent)
    radiusAU = s.rAU
    speedKmS = s.speedKmS
    activity = computeActivity(radiusAU)
    orbitUniforms.uCometPhase.value = s.phase
  }

  function setOrbitVisual(opacity: number, focused: boolean, instant: boolean) {
    targetOrbitOpacity = opacity
    orbitFocused = focused ? 1 : 0
    if (instant) {
      currentOrbitOpacity = opacity
      applyOrbitOpacity()
    }
  }

  function applyOrbitOpacity() {
    const vis = currentOrbitOpacity > 0.004
    orbitLine.visible = vis
    if (webgl) {
      orbitUniforms.uOpacity.value = currentOrbitOpacity
      orbitUniforms.uFocused.value = orbitFocused
    } else if (orbitMat instanceof T.LineBasicMaterial) {
      orbitMat.opacity = currentOrbitOpacity
    }
    if (periBeacon) {
      periBeacon.visible = vis
      periBeacon.material.opacity = currentOrbitOpacity * (0.45 + 0.5 * orbitFocused)
    }
  }

  function stepOrbitFade(deltaSec: number, instant: boolean) {
    if (instant) {
      currentOrbitOpacity = targetOrbitOpacity
    } else if (Math.abs(currentOrbitOpacity - targetOrbitOpacity) > 0.001) {
      const k = 1 - Math.exp(-deltaSec * 10.5)
      currentOrbitOpacity += (targetOrbitOpacity - currentOrbitOpacity) * k
      if (Math.abs(currentOrbitOpacity - targetOrbitOpacity) <= 0.002) {
        currentOrbitOpacity = targetOrbitOpacity
      }
    }
    applyOrbitOpacity()
  }

  function update(
    project: Project,
    selected: boolean,
    ambientTime = 0,
    camera?: T.PerspectiveCamera,
    pixelRatio = 1,
    deltaSec = 1 / 60,
    reduceMotion = false,
  ) {
    stepOrbitFade(deltaSec, reduceMotion)
    orbitUniforms.uTime.value = ambientTime

    // Scale perihelion beacon smoothly to constant readable screen size
    if (periBeacon && periBeacon.visible) {
      const bp = project(trajectory.perihelionPos)
      if (bp) {
        const pulse = 1 + 0.1 * Math.sin(ambientTime * 2.8 + profile.seed)
        const px = (orbitFocused > 0.5 ? 15 : 10.5) * pulse
        periBeacon.scale.setScalar(px / Math.max(0.05, bp.scale))
      }
    }

    const q = project(root.position)
    root.visible = !!q
    if (!q) return

    const depth = q.z
    const scale = q.scale

    // Anti-solar vector (+away) and orthogonalized trailing orbital direction (dust tail bend)
    away.copy(root.position)
    if (away.lengthSq() < 1e-6) away.set(1, 0, 0)
    else away.normalize()

    trailDir.copy(tangent).multiplyScalar(-1)
    const dotTA = trailDir.dot(away)
    trailDir.addScaledVector(away, -dotTA)
    if (trailDir.lengthSq() < 1e-5) {
      trailDir.set(-away.z, 0, away.x)
    }
    trailDir.normalize()

    planeNormal.crossVectors(away, trailDir)
    if (planeNormal.lengthSq() < 1e-5) planeNormal.set(0, 1, 0)
    else planeNormal.normalize()

    // Smooth, continuous distance-adaptive scaling (no jarring pop when selecting!)
    // At closeup (depth ~ 3..35): true 3D physical scale.
    // At Solar System overview (depth ~ 300..1100): gentle readability lift.
    const farBoost = clamp(1 + Math.max(0, depth - 55) / 260, 1, 2.85)
    const nucWorldR = profile.nucleusRadius * (1 + Math.max(0, farBoost - 1) * 0.25)
    nucleusTiltGroup.scale.setScalar(nucWorldR)

    // Smooth 3D nuclear rotation (continues gently even when orbital motion is paused)
    const spinAngle = (reduceMotion ? 0 : ambientTime) * profile.spinRate + (profile.seed % 360) * 0.017
    nucleusSpinGroup.rotation.y = spinAngle

    // Close-up factor: when camera flies right up to the nucleus, soften central coma glare
    // so rocky craters, dark crust, and active vents stand out in sharp 3D relief
    const closeRatio = clamp((depth - nucWorldR * 4.5) / (nucWorldR * 18), 0, 1)
    const closeDim = 0.28 + 0.72 * closeRatio

    const effActivity = selected ? Math.max(activity, 0.24) : activity
    const comaWorldR =
      profile.nucleusRadius * profile.comaScale * (2.5 + 4.4 * effActivity) * farBoost

    // Align coma local +X with anti-solar direction `away`
    comaZ.copy(planeNormal)
    comaY.crossVectors(comaZ, away).normalize()
    basisMat.makeBasis(away, comaY, comaZ)
    comaGroup.quaternion.setFromRotationMatrix(basisMat)
    comaGroup.scale.setScalar(comaWorldR)

    if (webgl) {
      if (nucleusMat) {
        nucleusMat.emissiveIntensity = 0.04 + 0.28 * effActivity
      }

      // Update active sunward outgassing jets anchored to the rotating nucleus
      nucleusSpinGroup.updateMatrixWorld(true)
      nucleusSpinGroup.getWorldQuaternion(nucWorldQuat)
      invNucQuat.copy(nucWorldQuat).invert()
      localAwayTmp.copy(away).applyQuaternion(invNucQuat).normalize()
      const jetZoomVis = clamp(1.35 - depth / 160, 0.15, 1.0)
      for (let i = 0; i < jets.length; i++) {
        const jet = jets[i]
        ventWorldDir.copy(jet.localDir).applyQuaternion(nucWorldQuat).normalize()
        // Dot with toSun = -away: flares up as vent rotates onto the sunlit hemisphere!
        const sunDot = -ventWorldDir.dot(away)
        const sunExp = T.MathUtils.smoothstep(sunDot, -0.15, 0.72)
        jet.uniforms.uLocalAway.value.copy(localAwayTmp).applyQuaternion(jet.invLocalQuat)
        jet.uniforms.uLength.value = (1.5 + 3.4 * effActivity) * (0.45 + 0.55 * sunExp)
        jet.uniforms.uFlare.value = 0.35 + 0.65 * effActivity
        jet.uniforms.uIntensity.value = sunExp * (0.12 + 0.54 * effActivity) * jetZoomVis
        jet.uniforms.uTime.value = ambientTime
        jet.mesh.visible = jet.uniforms.uIntensity.value > 0.01
      }

      comaUniforms.uActivity.value = effActivity
      comaUniforms.uTime.value = ambientTime
      comaUniforms.uCloseDim.value = closeDim

      if (coreHalo) {
        const haloWorld = comaWorldR * (0.42 + 0.32 * (1 - closeRatio * 0.4)) + 8.5 / Math.max(0.05, scale)
        coreHalo.scale.setScalar(haloWorld)
        coreHalo.material.opacity = (0.16 + 0.48 * effActivity) * (0.18 + 0.82 * closeRatio)
      }

      // Tail lengths grow dramatically as the comet approaches the Sun
      const baseReach = (9.5 + 46.0 * effActivity ** 1.08) * farBoost
      const ionLen = baseReach * profile.ionLengthMult
      const dustLen = baseReach * profile.dustLengthMult * 0.86
      // Gently boost overview legibility while keeping close-up additive tails rich and unclipped
      const overviewLift = clamp(1 + Math.max(0, depth - 90) / 380, 1, 1.55)

      if (ionTail) {
        ionTail.uniforms.uDir.value.copy(away)
        ionTail.uniforms.uCurveDir.value.copy(trailDir)
        ionTail.uniforms.uPlaneNormal.value.copy(planeNormal)
        ionTail.uniforms.uLength.value = ionLen
        ionTail.uniforms.uBaseWidth.value = comaWorldR * 0.21
        ionTail.uniforms.uTipWidth.value = comaWorldR * 0.44 + ionLen * 0.052
        ionTail.uniforms.uOpacity.value = (0.07 + 0.34 * effActivity) * (0.45 + 0.55 * closeRatio) * overviewLift
        ionTail.uniforms.uTime.value = ambientTime
      }

      if (dustTail) {
        // Angle the dust tail initially ~10° toward the trailing orbital path so the warm golden
        // dust fan cleanly separates from the sleek blue ion beam even near the coma
        dustTail.uniforms.uDir.value.copy(away).addScaledVector(trailDir, 0.17).normalize()
        dustTail.uniforms.uCurveDir.value.copy(trailDir)
        dustTail.uniforms.uPlaneNormal.value.copy(planeNormal)
        dustTail.uniforms.uLength.value = dustLen
        dustTail.uniforms.uBaseWidth.value = comaWorldR * 0.32
        dustTail.uniforms.uTipWidth.value = comaWorldR * 0.78 + dustLen * 0.165
        dustTail.uniforms.uOpacity.value = (0.075 + 0.30 * effActivity) * (0.42 + 0.58 * closeRatio) * overviewLift
        dustTail.uniforms.uTime.value = ambientTime
      }

      if (sodiumTail) {
        const naAct = T.MathUtils.smoothstep(effActivity, 0.22, 0.92)
        sodiumTail.mesh.visible = naAct > 0.01
        sodiumTail.uniforms.uDir.value.copy(away).addScaledVector(trailDir, 0.075).normalize()
        sodiumTail.uniforms.uCurveDir.value.copy(trailDir)
        sodiumTail.uniforms.uPlaneNormal.value.copy(planeNormal)
        sodiumTail.uniforms.uLength.value = ionLen * 0.86
        sodiumTail.uniforms.uBaseWidth.value = comaWorldR * 0.14
        sodiumTail.uniforms.uTipWidth.value = comaWorldR * 0.3 + ionLen * 0.028
        sodiumTail.uniforms.uOpacity.value = naAct * 0.17 * (0.45 + 0.55 * closeRatio) * overviewLift
        sodiumTail.uniforms.uTime.value = ambientTime
      }

      if (particles) {
        particleUniforms.uAway.value.copy(away)
        particleUniforms.uCurveDir.value.copy(trailDir)
        particleUniforms.uPlaneNormal.value.copy(planeNormal)
        particleUniforms.uIonLen.value = ionLen * 0.95
        particleUniforms.uDustLen.value = dustLen * 0.95
        particleUniforms.uComaR.value = comaWorldR
        particleUniforms.uActivity.value = effActivity
        particleUniforms.uTime.value = ambientTime
        particleUniforms.uPixelRatio.value = pixelRatio
        particleUniforms.uPointScale.value = selected ? 1.35 : 0.92
        particles.visible = depth < 680 && effActivity > 0.06
      }
    }

    // Screen-space projection for label placement & 2D fallback
    const screenReach = (8.5 + 46.0 * effActivity ** 1.15) * farBoost
    const ionTip = project(tipPos.copy(root.position).addScaledVector(away, screenReach))
    screenIonDx = ionTip ? ionTip.x - q.x : 0
    screenIonDy = ionTip ? ionTip.y - q.y : 0

    const dustTip = project(
      tipPos
        .copy(root.position)
        .addScaledVector(away, screenReach * 0.82)
        .addScaledVector(trailDir, screenReach * 0.82 * profile.dustCurve),
    )
    screenDustDx = dustTip ? dustTip.x - q.x : screenIonDx
    screenDustDy = dustTip ? dustTip.y - q.y : screenIonDy

    const dustMid = project(
      tipPos
        .copy(root.position)
        .addScaledVector(away, screenReach * 0.42)
        .addScaledVector(trailDir, screenReach * 0.42 * profile.dustCurve * 0.34),
    )
    screenDustMidDx = dustMid ? dustMid.x - q.x : screenDustDx * 0.5
    screenDustMidDy = dustMid ? dustMid.y - q.y : screenDustDy * 0.5

    screenComaR = clamp(comaWorldR * scale, 5, selected ? 92 : 24)
    pickPx = clamp(screenComaR * 0.95, 16, 48)
    // Place label on the side opposite the tails so it never overlaps the glowing streams
    const tailX = screenDustDx * 0.65 + screenIonDx * 0.35
    const tailLen2D = Math.hypot(tailX, screenDustDy * 0.65 + screenIonDy * 0.35)
    labelLeft = tailLen2D > 4 && tailX / tailLen2D > 0.35
    void camera
  }

  function drawOrbit2D(ctx: CanvasRenderingContext2D, project: Project) {
    if (currentOrbitOpacity <= 0.004) return
    const pts = trajectory.points
    ctx.save()
    ctx.strokeStyle = '#' + new T.Color(comet.color).getHexString()
    ctx.lineWidth = orbitFocused > 0.5 ? 1.5 : 1.1
    ctx.globalAlpha = currentOrbitOpacity * 0.65
    ctx.beginPath()
    let down = false
    for (let i = 0; i <= pts.length; i++) {
      const q = project(pts[i % pts.length])
      if (!q) {
        down = false
        continue
      }
      if (down) ctx.lineTo(q.x, q.y)
      else ctx.moveTo(q.x, q.y)
      down = true
    }
    ctx.stroke()

    const pq = project(trajectory.perihelionPos)
    if (pq) {
      ctx.globalAlpha = currentOrbitOpacity * 0.85
      ctx.beginPath()
      ctx.moveTo(pq.x, pq.y - 4.5)
      ctx.lineTo(pq.x + 4.5, pq.y)
      ctx.lineTo(pq.x, pq.y + 4.5)
      ctx.lineTo(pq.x - 4.5, pq.y)
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
  }

  function draw2D(ctx: CanvasRenderingContext2D, q: ScreenPoint) {
    ctx.save()
    ctx.translate(q.x, q.y)
    ctx.globalCompositeOperation = 'lighter'

    // Curved 2D dust fan
    const dustLen = Math.min(Math.hypot(screenDustDx, screenDustDy), 360)
    if (dustLen > 2) {
      const s = dustLen / Math.max(1, Math.hypot(screenDustDx, screenDustDy))
      const ex = screenDustDx * s
      const ey = screenDustDy * s
      const mx = screenDustMidDx * s
      const my = screenDustMidDy * s
      const g = ctx.createLinearGradient(0, 0, ex, ey)
      g.addColorStop(0, `rgba(255,240,204,${(0.32 + 0.45 * activity).toFixed(2)})`)
      g.addColorStop(0.45, `rgba(235,196,138,${(0.18 + 0.25 * activity).toFixed(2)})`)
      g.addColorStop(1, 'rgba(210,160,100,0)')
      ctx.strokeStyle = g
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(2.5, screenComaR * 0.72)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(mx, my, ex, ey)
      ctx.stroke()
    }

    // Straight cyan-blue ion tail
    const ionLen = Math.min(Math.hypot(screenIonDx, screenIonDy), 420)
    if (ionLen > 2) {
      const s = ionLen / Math.max(1, Math.hypot(screenIonDx, screenIonDy))
      const ex = screenIonDx * s
      const ey = screenIonDy * s
      const g = ctx.createLinearGradient(0, 0, ex, ey)
      g.addColorStop(0, `rgba(170,242,255,${(0.36 + 0.52 * activity).toFixed(2)})`)
      g.addColorStop(0.5, `rgba(92,168,255,${(0.16 + 0.28 * activity).toFixed(2)})`)
      g.addColorStop(1, 'rgba(60,120,255,0)')
      ctx.strokeStyle = g
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(1.5, screenComaR * 0.34)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(ex, ey)
      ctx.stroke()
    }

    // Layered radial coma glow
    const comaG = ctx.createRadialGradient(0, 0, 0, 0, 0, screenComaR)
    const [ir, ig, ib] = profile.comaInnerColor.map((c) => Math.round(c * 255))
    comaG.addColorStop(0, 'rgba(248,254,255,0.95)')
    comaG.addColorStop(0.28, `rgba(${ir},${ig},${ib},${(0.42 + 0.42 * activity).toFixed(2)})`)
    comaG.addColorStop(0.68, `rgba(${ir},${ig},${ib},0.12)`)
    comaG.addColorStop(1, `rgba(${ir},${ig},${ib},0)`)
    ctx.fillStyle = comaG
    ctx.beginPath()
    ctx.arc(0, 0, screenComaR, 0, tau)
    ctx.fill()

    // Tiny shaded nucleus dot
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#c8d6dc'
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(1.5, screenComaR * 0.14), 0, tau)
    ctx.fill()
    ctx.restore()
  }

  function disposeMaps() {
    for (const item of disposables) item.dispose()
  }

  return {
    root,
    orbitGroup,
    advance,
    update,
    setOrbitVisual,
    seekPerihelion: () => {
      trajectory.seekPerihelion(lastClock)
      advance(lastClock)
    },
    draw2D,
    drawOrbit2D,
    disposeMaps,
    get radiusAU() {
      return radiusAU
    },
    get speedKmS() {
      return speedKmS
    },
    get activity() {
      return activity
    },
    get nucleusRadius() {
      return profile.nucleusRadius
    },
    get inbound() {
      return tangent.dot(root.position) < 0
    },
    get labelLeft() {
      return labelLeft
    },
    get pickRadius() {
      return pickPx
    },
  }
}
