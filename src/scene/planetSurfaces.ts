import * as T from 'three'
import { seeded } from './math'
import { planetAtmosphereFragment, planetAtmosphereVertex } from './shaders'

// For an oblate spheroid, Rmean³ = Requator² × Rpole (JPL planetary physical parameters).
const radiiAndDay: Record<string, [number, number, number]> = {
  Mercury: [2440.53, 2439.4, 58.6462],
  Venus: [6051.8, 6051.8, 243.018],
  Earth: [6378.1366, 6371.0084, 0.99726968],
  Mars: [3396.19, 3389.5, 1.02595676],
  Jupiter: [71492, 69911, 0.41354],
  Saturn: [60268, 58232, 0.44401],
  Uranus: [25559, 25362, 0.71833],
  Neptune: [24764, 24622, 0.67125],
  Ceres: [482, 469.7, 0.378],
  Vesta: [262.7, 262.7, 0.2226],
  Psyche: [111, 111, 0.1748],
  Chiron: [105, 105, 0.2466],
  Chariklo: [125, 125, 0.2918],
  Pholus: [70, 70, 0.416],
  Pluto: [1188.3, 1188.3, 6.387],
  Orcus: [458, 458, 0.549],
  Haumea: [816, 816, 0.1631],
  Quaoar: [555, 555, 0.7366],
  Arrokoth: [18, 18, 0.663],
  Makemake: [715, 715, 0.951],
  Gonggong: [615, 615, 0.933],
  Eris: [1163, 1163, 15.786],
  Farfarout: [200, 200, 0.65],
  VP113: [250, 250, 0.78],
  Sedna: [498, 498, 0.428],
}

export const ringInner = 1.23
export const ringOuter = 2.27
export const uranusRingInner = 1.54
export const uranusRingOuter = 2.08
export const earthCloudRadius = 1.0055

// Intersect the sunlight ray with the shell that draws the visible clouds.
const closeEarthShadow = `
  vec3 ground = normalize(vObjPos);
  vec3 sun = normalize(vObjSunDir);
  float mu = dot(ground, sun);
  float shellDelta = ${earthCloudRadius ** 2 - 1};
  float travel = shellDelta / (sqrt(mu * mu + shellDelta) + mu);
  vec3 hit = normalize(ground + travel * sun);
  vec2 horizontal = normalize(ground.xz + vec2(1e-8, 0.0));
  float du = atan(dot(hit.xz, vec2(horizontal.y, -horizontal.x)), dot(hit.xz, horizontal)) / 6.2831853;
  vec2 shadowUv = vec2(vMapUv.x - uCloudShift + du, 0.5 + asin(clamp(hit.y, -1.0, 1.0)) / 3.14159265);
  float density = smoothstep(0.04, 0.92, texture2D(uCloudMap, shadowUv).r);
  float _shFactor = 1.0 - 0.62 * density * smoothstep(-0.03, 0.14, mu);
`

// Illustrative cloud motion, in turns per simulation second. The axial tilt handles retrograde worlds.
const cloudProfiles: Partial<Record<string, { rate: number; bandWidth: number; contrast: number }>> = {
  Venus: { rate: 0.0011, bandWidth: 85, contrast: 0.68 },
  Jupiter: { rate: 0.00065, bandWidth: 12, contrast: 1 },
  Saturn: { rate: 0.00052, bandWidth: 17, contrast: 0.8 },
  Uranus: { rate: 0.00024, bandWidth: 34, contrast: 0.38 },
  Neptune: { rate: 0.00085, bandWidth: 29, contrast: 0.82 },
  Titan: { rate: 0.00032, bandWidth: 65, contrast: 0.55 },
}
export function cloudProfile(id: string) {
  return cloudProfiles[id]
}
export function cloudBand(id: string, v: number) {
  const profile = cloudProfiles[id]
  if (!profile) return 0
  const latitude = (v - 0.5) * 180
  const stormMask = id === 'Jupiter' ? T.MathUtils.smoothstep(Math.abs(latitude + 20), 6, 11) : 1
  const polarMask = 1 - T.MathUtils.smoothstep(Math.abs(latitude), 56, 72)
  return Math.tanh(2.8 * Math.cos(latitude * Math.PI / profile.bandWidth)) *
    stormMask * polarMask * profile.contrast
}

export function polarRatio(id: string) {
  const entry = radiiAndDay[id]
  return entry ? (entry[1] / entry[0]) ** 3 : 1
}

// Axial tilt already supplies the retrograde orientation of Venus and Uranus.
export function spinRate(id: string) {
  const day = radiiAndDay[id]?.[2] ?? 1
  return 0.15 * (0.99726968 / day) ** 0.58
}

interface SurfaceProfile {
  bumpScale: number
  specular: number
  shininess: number
  ambientScale: number
  wrap: number
  limbDark: number
  regolith: number
  rimColor: [number, number, number]
  rimPower: number
  rimStrength: number
  sunsetColor: [number, number, number]
  sunsetStrength: number
}

const defaultRockyProfile: SurfaceProfile = {
  bumpScale: 0.032,
  specular: 0x050505,
  shininess: 6,
  ambientScale: 0.24,
  wrap: 0.0,
  limbDark: 0.0,
  regolith: 0.36,
  rimColor: [0, 0, 0],
  rimPower: 3.2,
  rimStrength: 0.0,
  sunsetColor: [0, 0, 0],
  sunsetStrength: 0.0,
}

const icyMoonProfile: SurfaceProfile = {
  bumpScale: 0.024,
  specular: 0x26323b,
  shininess: 30,
  ambientScale: 0.28,
  wrap: 0.03,
  limbDark: 0.0,
  regolith: 0.18,
  rimColor: [0.65, 0.82, 0.96],
  rimPower: 3.6,
  rimStrength: 0.08,
  sunsetColor: [0, 0, 0],
  sunsetStrength: 0.0,
}

const surfaceProfiles: Record<string, SurfaceProfile> = {
  Mercury: {
    ...defaultRockyProfile,
    bumpScale: 0.038,
    ambientScale: 0.22,
    regolith: 0.42,
  },
  Venus: {
    bumpScale: 0.004,
    specular: 0x100e09,
    shininess: 10,
    ambientScale: 0.34,
    wrap: 0.28,
    limbDark: 0.22,
    regolith: 0.0,
    rimColor: [0.96, 0.8, 0.5],
    rimPower: 2.6,
    rimStrength: 0.42,
    sunsetColor: [0.95, 0.54, 0.2],
    sunsetStrength: 0.24,
  },
  Earth: {
    bumpScale: 0.0,
    specular: 0x182028,
    shininess: 76,
    ambientScale: 0.16,
    wrap: 0.08,
    limbDark: 0.0,
    regolith: 0.0,
    rimColor: [0.18, 0.5, 0.94],
    rimPower: 3.1,
    rimStrength: 0.72,
    sunsetColor: [0.96, 0.44, 0.16],
    sunsetStrength: 0.22,
  },
  Mars: {
    bumpScale: 0.034,
    specular: 0x090706,
    shininess: 8,
    ambientScale: 0.24,
    wrap: 0.07,
    limbDark: 0.05,
    regolith: 0.24,
    rimColor: [0.85, 0.48, 0.28],
    rimPower: 3.0,
    rimStrength: 0.36,
    sunsetColor: [0.52, 0.62, 0.86],
    sunsetStrength: 0.12,
  },
  Jupiter: {
    bumpScale: 0.007,
    specular: 0x0a0908,
    shininess: 10,
    ambientScale: 0.28,
    wrap: 0.22,
    limbDark: 0.26,
    regolith: 0.0,
    rimColor: [0.88, 0.78, 0.62],
    rimPower: 3.1,
    rimStrength: 0.22,
    sunsetColor: [0.76, 0.52, 0.34],
    sunsetStrength: 0.1,
  },
  Saturn: {
    bumpScale: 0.005,
    specular: 0x0a0908,
    shininess: 10,
    ambientScale: 0.28,
    wrap: 0.22,
    limbDark: 0.25,
    regolith: 0.0,
    rimColor: [0.84, 0.8, 0.66],
    rimPower: 3.1,
    rimStrength: 0.24,
    sunsetColor: [0.72, 0.62, 0.46],
    sunsetStrength: 0.09,
  },
  Uranus: {
    bumpScale: 0.002,
    specular: 0x0c1416,
    shininess: 12,
    ambientScale: 0.3,
    wrap: 0.26,
    limbDark: 0.24,
    regolith: 0.0,
    rimColor: [0.46, 0.88, 0.94],
    rimPower: 2.8,
    rimStrength: 0.42,
    sunsetColor: [0.24, 0.66, 0.78],
    sunsetStrength: 0.12,
  },
  Neptune: {
    bumpScale: 0.004,
    specular: 0x0b1220,
    shininess: 14,
    ambientScale: 0.28,
    wrap: 0.24,
    limbDark: 0.26,
    regolith: 0.0,
    rimColor: [0.24, 0.52, 0.98],
    rimPower: 2.7,
    rimStrength: 0.52,
    sunsetColor: [0.18, 0.34, 0.82],
    sunsetStrength: 0.14,
  },
  Pluto: {
    ...defaultRockyProfile,
    bumpScale: 0.032,
    specular: 0x101318,
    shininess: 14,
    wrap: 0.04,
    regolith: 0.24,
    rimColor: [0.56, 0.78, 0.98],
    rimPower: 3.4,
    rimStrength: 0.24,
  },
  Moon: {
    ...defaultRockyProfile,
    bumpScale: 0.04,
    ambientScale: 0.2,
    regolith: 0.44,
  },
  Io: {
    ...defaultRockyProfile,
    bumpScale: 0.03,
    specular: 0x0b0905,
    shininess: 9,
    regolith: 0.28,
  },
  Europa: {
    ...icyMoonProfile,
    bumpScale: 0.02,
    specular: 0x34424d,
    shininess: 40,
  },
  Enceladus: {
    ...icyMoonProfile,
    bumpScale: 0.018,
    specular: 0x3c4b56,
    shininess: 46,
    rimStrength: 0.14,
  },
  Titan: {
    bumpScale: 0.003,
    specular: 0x120c05,
    shininess: 8,
    ambientScale: 0.32,
    wrap: 0.3,
    limbDark: 0.22,
    regolith: 0.0,
    rimColor: [0.96, 0.64, 0.26],
    rimPower: 2.5,
    rimStrength: 0.55,
    sunsetColor: [0.92, 0.38, 0.12],
    sunsetStrength: 0.26,
  },
  Triton: {
    ...icyMoonProfile,
    bumpScale: 0.026,
    rimColor: [0.72, 0.82, 0.92],
    rimStrength: 0.14,
  },
  Ganymede: { ...icyMoonProfile, bumpScale: 0.028, specular: 0x161a1e, shininess: 18 },
  Callisto: { ...defaultRockyProfile, bumpScale: 0.036, regolith: 0.38 },
  Rhea: { ...icyMoonProfile, specular: 0x1c2228, shininess: 22 },
  Dione: { ...icyMoonProfile, specular: 0x20282e, shininess: 24 },
  Tethys: { ...icyMoonProfile, specular: 0x242c34, shininess: 26 },
  Mimas: { ...icyMoonProfile, bumpScale: 0.034, specular: 0x1c2228, shininess: 20 },
  Iapetus: { ...defaultRockyProfile, bumpScale: 0.032, regolith: 0.3 },
  Ariel: { ...icyMoonProfile, specular: 0x242d34, shininess: 26 },
  Titania: { ...icyMoonProfile, specular: 0x1c2228, shininess: 20 },
  Oberon: { ...defaultRockyProfile, bumpScale: 0.032, regolith: 0.32 },
  Umbriel: { ...defaultRockyProfile, bumpScale: 0.034, regolith: 0.38 },
  Miranda: { ...icyMoonProfile, bumpScale: 0.034, specular: 0x1e252c, shininess: 22 },
  Charon: { ...defaultRockyProfile, bumpScale: 0.032, regolith: 0.34 },
  Proteus: { ...defaultRockyProfile, bumpScale: 0.042, regolith: 0.42 },
  Nereid: { ...defaultRockyProfile, bumpScale: 0.036, regolith: 0.36 },
  Amalthea: { ...defaultRockyProfile, bumpScale: 0.044, regolith: 0.44 },
  Hyperion: { ...defaultRockyProfile, bumpScale: 0.048, regolith: 0.44 },
  Phoebe: { ...defaultRockyProfile, bumpScale: 0.042, regolith: 0.44 },
  Pan: { ...icyMoonProfile, bumpScale: 0.024, specular: 0x1e2226, shininess: 18 },
  Janus: { ...icyMoonProfile, bumpScale: 0.032, specular: 0x1e242a, shininess: 20 },
  Nix: { ...icyMoonProfile, bumpScale: 0.032, specular: 0x222a32, shininess: 24 },
  Hydra: { ...icyMoonProfile, bumpScale: 0.03, specular: 0x28323c, shininess: 28 },
  Kerberos: { ...icyMoonProfile, bumpScale: 0.032, specular: 0x1c2228, shininess: 20 },
  Styx: { ...icyMoonProfile, bumpScale: 0.032, specular: 0x20262e, shininess: 22 },
  'Hiʻiaka': { ...icyMoonProfile, bumpScale: 0.026, specular: 0x2a3640, shininess: 32 },
  Namaka: { ...icyMoonProfile, bumpScale: 0.03, specular: 0x24303a, shininess: 26 },
  'MK 2': { ...defaultRockyProfile, bumpScale: 0.042, regolith: 0.45 },
  Dysnomia: { ...defaultRockyProfile, bumpScale: 0.038, regolith: 0.4 },
  Vesta: { ...defaultRockyProfile, bumpScale: 0.044, regolith: 0.42 },
  Pallas: { ...defaultRockyProfile, bumpScale: 0.042, regolith: 0.4 },
  Juno: { ...defaultRockyProfile, bumpScale: 0.044, regolith: 0.42 },
  Hygiea: { ...defaultRockyProfile, bumpScale: 0.04, regolith: 0.4 },
  Haumea: { ...icyMoonProfile, bumpScale: 0.022, specular: 0x2a343d, shininess: 30 },
  Eris: {
    ...icyMoonProfile,
    bumpScale: 0.024,
    specular: 0x323e4a,
    shininess: 32,
    rimColor: [0.76, 0.88, 1.0],
    rimStrength: 0.16,
  },
  Makemake: { ...defaultRockyProfile, bumpScale: 0.028, specular: 0x181512, shininess: 14 },
  Ceres: { ...defaultRockyProfile, bumpScale: 0.038, regolith: 0.4 },
  Psyche: {
    ...defaultRockyProfile,
    bumpScale: 0.038,
    specular: 0x626e7c,
    shininess: 54,
    regolith: 0.18,
    rimColor: [0.68, 0.76, 0.86],
    rimPower: 3.4,
    rimStrength: 0.12,
  },
  Eurybates: { ...defaultRockyProfile, bumpScale: 0.044, regolith: 0.44 },
  Queta: { ...defaultRockyProfile, bumpScale: 0.044, regolith: 0.44 },
  Patroclus: { ...defaultRockyProfile, bumpScale: 0.04, regolith: 0.4 },
  Menoetius: { ...defaultRockyProfile, bumpScale: 0.04, regolith: 0.4 },
  Chiron: {
    ...icyMoonProfile,
    bumpScale: 0.034,
    specular: 0x243440,
    shininess: 22,
    regolith: 0.24,
    rimColor: [0.62, 0.84, 0.98],
    rimPower: 3.0,
    rimStrength: 0.22,
  },
  Chariklo: { ...defaultRockyProfile, bumpScale: 0.038, specular: 0x181b1e, shininess: 14, regolith: 0.36 },
  Pholus: { ...defaultRockyProfile, bumpScale: 0.038, specular: 0x1c1210, shininess: 12, regolith: 0.34 },
  Orcus: {
    ...icyMoonProfile,
    bumpScale: 0.024,
    specular: 0x303e4a,
    shininess: 34,
    rimColor: [0.72, 0.86, 0.98],
    rimStrength: 0.14,
  },
  Vanth: { ...defaultRockyProfile, bumpScale: 0.036, regolith: 0.38 },
  Quaoar: {
    ...icyMoonProfile,
    bumpScale: 0.028,
    specular: 0x28201e,
    shininess: 20,
    regolith: 0.24,
    rimColor: [0.84, 0.64, 0.56],
    rimStrength: 0.1,
  },
  Weywot: { ...defaultRockyProfile, bumpScale: 0.038, regolith: 0.4 },
  Arrokoth: { ...defaultRockyProfile, bumpScale: 0.036, specular: 0x160e0c, shininess: 10, regolith: 0.38 },
  Gonggong: {
    ...icyMoonProfile,
    bumpScale: 0.026,
    specular: 0x2a1d1c,
    shininess: 22,
    regolith: 0.22,
    rimColor: [0.86, 0.52, 0.46],
    rimStrength: 0.12,
  },
  Xiangliu: { ...defaultRockyProfile, bumpScale: 0.038, regolith: 0.4 },
  Farfarout: {
    ...icyMoonProfile,
    bumpScale: 0.03,
    specular: 0x262e3a,
    shininess: 24,
    rimColor: [0.7, 0.8, 0.96],
    rimStrength: 0.12,
  },
  VP113: {
    ...icyMoonProfile,
    bumpScale: 0.026,
    specular: 0x2e262a,
    shininess: 26,
    rimColor: [0.88, 0.74, 0.78],
    rimStrength: 0.12,
  },
  Sedna: {
    ...icyMoonProfile,
    bumpScale: 0.026,
    specular: 0x2c1b18,
    shininess: 24,
    regolith: 0.22,
    rimColor: [0.88, 0.48, 0.38],
    rimStrength: 0.14,
  },
  Phobos: { ...defaultRockyProfile, bumpScale: 0.046, regolith: 0.45 },
  Deimos: { ...defaultRockyProfile, bumpScale: 0.04, regolith: 0.42 },
}

export interface AtmosphereSpec {
  scale: number
  dayColor: number
  sunsetColor: number
  falloff: number
  intensity: number
  sunsetStrength: number
}

const atmosphereSpecs: Record<string, AtmosphereSpec> = {
  Venus: {
    scale: 1.055,
    dayColor: 0xf4cf86,
    sunsetColor: 0xf08a38,
    falloff: 4.1,
    intensity: 0.72,
    sunsetStrength: 0.55,
  },
  Earth: {
    scale: 1.058,
    dayColor: 0x3b8eff,
    sunsetColor: 0xff7434,
    falloff: 4.5,
    intensity: 0.92,
    sunsetStrength: 0.78,
  },
  Mars: {
    scale: 1.045,
    dayColor: 0xd98454,
    sunsetColor: 0x7092cc,
    falloff: 5.0,
    intensity: 0.54,
    sunsetStrength: 0.42,
  },
  Jupiter: {
    scale: 1.036,
    dayColor: 0xe6cda6,
    sunsetColor: 0xc98c58,
    falloff: 5.4,
    intensity: 0.36,
    sunsetStrength: 0.25,
  },
  Saturn: {
    scale: 1.038,
    dayColor: 0xdccfa8,
    sunsetColor: 0xa0b4c8,
    falloff: 5.2,
    intensity: 0.38,
    sunsetStrength: 0.24,
  },
  Uranus: {
    scale: 1.048,
    dayColor: 0x72d8e8,
    sunsetColor: 0x4ca8cc,
    falloff: 4.8,
    intensity: 0.58,
    sunsetStrength: 0.22,
  },
  Neptune: {
    scale: 1.052,
    dayColor: 0x3d7eff,
    sunsetColor: 0x2c56cc,
    falloff: 4.6,
    intensity: 0.68,
    sunsetStrength: 0.25,
  },
  Pluto: {
    scale: 1.045,
    dayColor: 0x82b8ee,
    sunsetColor: 0x5c8ec4,
    falloff: 5.6,
    intensity: 0.34,
    sunsetStrength: 0.18,
  },
  Titan: {
    scale: 1.08,
    dayColor: 0xf2a046,
    sunsetColor: 0xe05d20,
    falloff: 3.6,
    intensity: 0.85,
    sunsetStrength: 0.68,
  },
  Triton: {
    scale: 1.036,
    dayColor: 0x9ac6ec,
    sunsetColor: 0x7ca2cc,
    falloff: 6.2,
    intensity: 0.24,
    sunsetStrength: 0.14,
  },
}

export function atmosphereSpec(id: string): AtmosphereSpec | null {
  return atmosphereSpecs[id] ?? null
}

export function createAtmosphereMesh(
  spec: AtmosphereSpec,
  radius: number,
  polar: number,
  geometry: T.SphereGeometry,
  lightPos: T.Vector3 = new T.Vector3(0, 0, 0),
) {
  const mat = new T.ShaderMaterial({
    vertexShader: planetAtmosphereVertex,
    fragmentShader: planetAtmosphereFragment,
    side: T.BackSide,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: {
      uLightPos: { value: lightPos },
      uInnerRatio: { value: 1 / spec.scale },
      uDayColor: { value: new T.Color(spec.dayColor) },
      uSunsetColor: { value: new T.Color(spec.sunsetColor) },
      uFalloff: { value: spec.falloff },
      uIntensity: { value: spec.intensity },
      uSunsetStrength: { value: spec.sunsetStrength },
    },
  })
  const mesh = new T.Mesh(geometry, mat)
  mesh.scale.set(radius * spec.scale, radius * polar * spec.scale, radius * spec.scale)
  mesh.renderOrder = 2
  return mesh
}

export function planetMaterial(
  id: string,
  map: T.Texture | null,
  options?: { color?: number; cloudMap?: T.Texture | null },
) {
  const profile = surfaceProfiles[id] ?? defaultRockyProfile
  const isEarth = id === 'Earth'
  const wind = cloudProfile(id)
  const isSaturn = id === 'Saturn'
  const isIo = id === 'Io'

  const material = new T.MeshPhongMaterial({
    map,
    color: options?.color ?? 0xffffff,
    specular: profile.specular,
    shininess: profile.shininess,
  })
  if (profile.bumpScale > 0 && map && !isEarth) {
    material.bumpMap = map
    material.bumpScale = profile.bumpScale
  }
  if (isEarth) {
    material.normalScale.set(0.68, 0.68)
    material.emissive.set(0xffffff)
  } else if (isIo) {
    material.normalScale.set(0.88, 0.88)
    material.emissive.set(0xffffff)
  } else {
    material.normalScale.set(0.92, 0.92)
  }

  const cloudMapUniform: { value: T.Texture | null } = { value: options?.cloudMap ?? null }
  const cloudShiftUniform = { value: 0 }
  if (wind) material.userData.cloudDrift = { value: 0 }
  const hasCloudsUniform = { value: options?.cloudMap ? 1 : 0 }
  const saturnPoleUniform = { value: new T.Vector3(0, 1, 0) }
  const saturnRadiusUniform = { value: 1 }
  let saturnRingMat: T.MeshBasicMaterial | null = null

  if (isEarth) {
    material.userData.earthCloudMap = cloudMapUniform
    material.userData.earthCloudShift = cloudShiftUniform
    material.userData.earthHasClouds = hasCloudsUniform
  }
  if (isSaturn) {
    material.userData.bindSaturnShadow = (
      pole: T.Vector3,
      radius: number,
      ring: T.MeshBasicMaterial,
    ) => {
      saturnPoleUniform.value.copy(pole)
      saturnRadiusUniform.value = radius
      saturnRingMat = ring
    }
  }

  const cacheTag = isEarth
    ? 'planet-earth-v2'
    : isSaturn
      ? 'planet-saturn-v2'
      : isIo
        ? 'planet-io-v2'
        : 'planet-surface-v2'

  material.onBeforeCompile = (shader) => {
    const closeClouds = material.userData.photoCloudDetail === true
    Object.assign(shader.uniforms, {
      uAmbientScale: { value: profile.ambientScale },
      uWrap: { value: profile.wrap },
      uLimbDark: { value: profile.limbDark },
      uRegolith: { value: profile.regolith },
      uRimColor: { value: new T.Vector3(...profile.rimColor) },
      uRimPower: { value: profile.rimPower },
      uRimStrength: { value: profile.rimStrength },
      uSunsetColor: { value: new T.Vector3(...profile.sunsetColor) },
      uSunsetStrength: { value: profile.sunsetStrength },
    })

    if (isEarth) {
      Object.assign(shader.uniforms, {
        uCloudMap: cloudMapUniform,
        uCloudShift: cloudShiftUniform,
        uHasClouds: hasCloudsUniform,
      })
    }
    if (isSaturn) {
      Object.assign(shader.uniforms, {
        uPole: saturnPoleUniform,
        uPlanetRadius: saturnRadiusUniform,
        uPolarRatio: { value: polarRatio('Saturn') },
        uRingInner: { value: ringInner },
        uRingOuter: { value: ringOuter },
        uRingPattern: {
          get value() {
            return saturnRingMat?.map ?? null
          },
        },
      })
    }

    if (isEarth || isIo || isSaturn) {
      let vDecl = ''
      let vBody = ''
      if (isEarth || isIo) {
        vDecl += 'varying vec3 vObjPos;\n'
        vBody += 'vObjPos = normalize(position);\n'
      }
      if (isEarth) {
        vDecl += 'varying vec3 vObjSunDir;\n'
        vBody += `
          vec3 _c0 = modelMatrix[0].xyz;
          vec3 _c1 = modelMatrix[1].xyz;
          vec3 _c2 = modelMatrix[2].xyz;
          vec3 _toSunW = -modelMatrix[3].xyz;
          vObjSunDir = normalize(vec3(
            dot(_toSunW, _c0) / max(1e-8, dot(_c0, _c0)),
            dot(_toSunW, _c1) / max(1e-8, dot(_c1, _c1)),
            dot(_toSunW, _c2) / max(1e-8, dot(_c2, _c2))
          ));
        `
      }
      if (isSaturn) {
        vDecl += 'varying vec3 vSaturnOffset; varying vec3 vSaturnToSun;\n'
        vBody += `
          vSaturnOffset = mat3(modelMatrix) * transformed;
          vSaturnToSun = -(modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      }
      shader.vertexShader =
        vDecl +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>\n${vBody}`,
        )
    }

    let fDecl = `
      uniform float uAmbientScale;
      uniform float uWrap;
      uniform float uLimbDark;
      uniform float uRegolith;
      uniform vec3 uRimColor;
      uniform float uRimPower;
      uniform float uRimStrength;
      uniform vec3 uSunsetColor;
      uniform float uSunsetStrength;
    `
    if (isEarth) {
      fDecl += `
        uniform sampler2D uCloudMap;
        uniform float uCloudShift;
        uniform float uHasClouds;
        varying vec3 vObjPos;
        varying vec3 vObjSunDir;
      `
    }
    if (isIo) {
      fDecl += `varying vec3 vObjPos;\n`
    }
    if (isSaturn) {
      fDecl += `
        uniform vec3 uPole;
        uniform float uPlanetRadius;
        uniform float uPolarRatio;
        uniform float uRingInner;
        uniform float uRingOuter;
        uniform sampler2D uRingPattern;
        varying vec3 vSaturnOffset;
        varying vec3 vSaturnToSun;
      `
    }

    let frag = fDecl + shader.fragmentShader

    if (wind && closeClouds) {
      shader.uniforms.uJetDrift = material.userData.cloudDrift
      shader.vertexShader = 'attribute float jetBand; varying float vJetBand;\n' +
        shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvJetBand = jetBand;')
      frag = 'uniform float uJetDrift; varying float vJetBand;\n' + frag.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec2 advected = vMapUv - vec2(sign(vJetBand) * uJetDrift, 0.0);
          diffuseColor *= mix(texture2D(map, vMapUv), texture2D(map, advected), abs(vJetBand));
        #endif`,
      )
    }

    if (isEarth) {
      frag = frag.replace(
        '#include <emissivemap_fragment>',
        `
        float _overheadCloud = 0.0;
        #ifdef USE_MAP
          if (uHasClouds > 0.5) {
            _overheadCloud = texture2D(uCloudMap, vec2(fract(vMapUv.x - uCloudShift), vMapUv.y)).r;
          }
        #endif
        #ifdef USE_EMISSIVEMAP
          #include <emissivemap_fragment>
          #if NUM_POINT_LIGHTS > 0
            float _nightMask = 1.0 - smoothstep(-0.22, 0.1, dot(normalize(pointLights[0].position + vViewPosition), nonPerturbedNormal));
            totalEmissiveRadiance *= _nightMask * vec3(1.18, 0.96, 0.72) * (1.0 - 0.62 * _overheadCloud);
          #endif
        #else
          totalEmissiveRadiance = vec3(0.0);
        #endif
        `,
      )
    }

    if (isIo) {
      frag = frag.replace(
        '#include <emissivemap_fragment>',
        `
        #ifdef USE_EMISSIVEMAP
          #include <emissivemap_fragment>
          #if NUM_POINT_LIGHTS > 0
            float _ioNightMask = 1.0 - smoothstep(-0.22, 0.16, dot(normalize(pointLights[0].position + vViewPosition), nonPerturbedNormal));
            totalEmissiveRadiance *= (0.28 + 1.45 * _ioNightMask) * vec3(1.45, 0.88, 0.55);
          #endif
        #else
          totalEmissiveRadiance = vec3(0.0);
        #endif
        `,
      )
    }

    frag = frag.replace(
      '#include <lights_fragment_end>',
      `
      #include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= uAmbientScale;
      #if NUM_POINT_LIGHTS > 0
        vec3 _sunDirV = normalize(pointLights[0].position + vViewPosition);
        vec3 _viewDirV = normalize(vViewPosition);
        float _sunAngle = dot(nonPerturbedNormal, _sunDirV);
        float _mu = max(0.0, dot(nonPerturbedNormal, _viewDirV));
        if (uWrap > 0.001) {
          float _wrapTerm = smoothstep(-uWrap, 0.36, _sunAngle) * (1.0 - smoothstep(-0.02, 0.52, _sunAngle));
          reflectedLight.directDiffuse += diffuseColor.rgb * pointLights[0].color * (_wrapTerm * uWrap * 0.42);
        }
        if (uLimbDark > 0.001) {
          float _minnaert = pow(max(0.06, _mu * max(0.06, _sunAngle)), uLimbDark);
          reflectedLight.directDiffuse *= mix(1.0, _minnaert * 1.14, 0.72);
        }
        if (uRegolith > 0.001) {
          float _ls = 1.36 / (max(0.0, _sunAngle) + _mu + 0.46);
          reflectedLight.directDiffuse *= mix(1.0, _ls, uRegolith);
        }
        ${
          isEarth
            ? `
          reflectedLight.directSpecular *= (0.48 + 1.38 * pow(1.0 - _mu, 3.0)) * vec3(1.06, 0.99, 0.9);
          #ifdef USE_MAP
            if (uHasClouds > 0.5 && _sunAngle > -0.05) {
              ${closeClouds ? closeEarthShadow : `
              vec3 _tanU = normalize(vec3(vObjPos.z, 0.0, -vObjPos.x) + vec3(1e-5, 0.0, 0.0));
              vec3 _tanV = normalize(vec3(-vObjPos.x * vObjPos.y, 1.0 - vObjPos.y * vObjPos.y + 1e-4, -vObjPos.z * vObjPos.y));
              float _du = dot(vObjSunDir, _tanU) * 0.0024 / max(0.28, length(vObjPos.xz));
              float _dv = dot(vObjSunDir, _tanV) * 0.0042;
              vec2 _shUv = vec2(fract(vMapUv.x - uCloudShift + _du), clamp(vMapUv.y + _dv, 0.001, 0.999));
              float _shCloud = texture2D(uCloudMap, _shUv).r;
              float _shFactor = 1.0 - 0.52 * _shCloud * smoothstep(-0.02, 0.24, _sunAngle);
              `}
              reflectedLight.directDiffuse *= _shFactor;
              reflectedLight.directSpecular *= _shFactor * _shFactor;
            }
          #endif
        `
            : ''
        }
      #endif
      `,
    )

    const ioHotspots = isIo
      ? `
        #if NUM_POINT_LIGHTS > 0
          #ifndef USE_EMISSIVEMAP
            float _ioNight = 1.0 - smoothstep(-0.18, 0.14, _sunAngle);
            if (_ioNight > 0.01) {
              float _h1 = pow(max(0.0, dot(vObjPos, normalize(vec3(0.74, 0.22, 0.63)))), 420.0);
              float _h2 = pow(max(0.0, dot(vObjPos, normalize(vec3(-0.56, -0.34, 0.75)))), 560.0);
              float _h3 = pow(max(0.0, dot(vObjPos, normalize(vec3(0.18, 0.64, -0.74)))), 620.0);
              float _h4 = pow(max(0.0, dot(vObjPos, normalize(vec3(-0.82, 0.14, -0.55)))), 500.0);
              float _hot = _h1 * 1.1 + _h2 * 0.85 + _h3 * 0.75 + _h4 * 0.9;
              outgoingLight += vec3(1.35, 0.42, 0.08) * _hot * _ioNight;
            }
          #endif
        #endif
      `
      : ''

    const saturnShadowCode = isSaturn
      ? `
        vec3 _sOff = vSaturnOffset / max(0.0001, uPlanetRadius);
        vec3 _sRay = normalize(vSaturnToSun);
        float _sSlope = dot(_sRay, uPole);
        if (abs(_sSlope) > 0.0001) {
          float _st = -dot(_sOff, uPole) / _sSlope;
          float _su = (length(_sOff + _sRay * _st) - uRingInner) / (uRingOuter - uRingInner);
          if (_st > 0.0 && _su >= -0.006 && _su <= 1.006) {
            float _a0 = texture2D(uRingPattern, vec2(clamp(_su, 0.0, 1.0), 0.5)).a;
            float _a1 = texture2D(uRingPattern, vec2(clamp(_su - 0.004, 0.0, 1.0), 0.5)).a;
            float _a2 = texture2D(uRingPattern, vec2(clamp(_su + 0.004, 0.0, 1.0), 0.5)).a;
            float _ringAlpha = (_a0 * 0.5 + _a1 * 0.25 + _a2 * 0.25) * smoothstep(-0.006, 0.006, _su) * (1.0 - smoothstep(0.994, 1.006, _su));
            outgoingLight *= mix(vec3(1.0), vec3(0.14, 0.13, 0.16), 0.88 * _ringAlpha);
          }
        }
      `
      : ''

    frag = frag.replace(
      '#include <opaque_fragment>',
      `
      ${saturnShadowCode}
      #if NUM_POINT_LIGHTS > 0
        float _limb = pow(1.0 - _mu, uRimPower);
        if (uRimStrength > 0.001) {
          outgoingLight += uRimColor * _limb * smoothstep(-0.24, 0.55, _sunAngle) * uRimStrength;
        }
        if (uSunsetStrength > 0.001) {
          float _twilight = exp(-pow((_sunAngle - 0.03) / 0.21, 2.0));
          outgoingLight += uSunsetColor * _twilight * (0.22 + 0.78 * _limb) * uSunsetStrength;
        }
      #endif
      ${ioHotspots}
      #include <opaque_fragment>
      `,
    )

    shader.fragmentShader = frag
  }

  material.customProgramCacheKey = () =>
    material.userData.photoCloudDetail ? `${cacheTag}-${id}-close-clouds` : cacheTag
  return material
}

export function createEarthCloudsMaterial(alphaMap: T.Texture | null) {
  const material = new T.MeshLambertMaterial({
    color: 0xf7faff,
    alphaMap,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <lights_fragment_end>',
        `
        #include <lights_fragment_end>
        reflectedLight.indirectDiffuse *= 0.06;
        #if NUM_POINT_LIGHTS > 0
          vec3 _cSun = normalize(pointLights[0].position + vViewPosition);
          vec3 _cView = normalize(vViewPosition);
          float _cDot = dot(nonPerturbedNormal, _cSun);
          float _cWrap = smoothstep(-0.18, 0.35, _cDot) * (1.0 - smoothstep(0.0, 0.45, _cDot));
          reflectedLight.directDiffuse += vec3(1.0, 0.62, 0.34) * _cWrap * 0.28;
          float _cRim = pow(1.0 - max(0.0, dot(nonPerturbedNormal, _cView)), 2.8);
          reflectedLight.directDiffuse += vec3(0.55, 0.76, 1.0) * _cRim * smoothstep(-0.18, 0.5, _cDot) * 0.22;
        #endif
        `,
      )
  }
  material.customProgramCacheKey = () => 'earth-clouds-v2'
  return material
}

export function createVenusHazeMaterial(map: T.Texture | null) {
  const material = new T.MeshLambertMaterial({
    map,
    color: 0xf8e5be,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `
      #include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= 0.22;
      #if NUM_POINT_LIGHTS > 0
        vec3 _vSun = normalize(pointLights[0].position + vViewPosition);
        float _vDot = dot(nonPerturbedNormal, _vSun);
        float _vWrap = smoothstep(-0.28, 0.4, _vDot) * (1.0 - smoothstep(0.0, 0.5, _vDot));
        reflectedLight.directDiffuse += vec3(0.95, 0.65, 0.3) * _vWrap * 0.32;
      #endif
      `,
    )
  }
  material.customProgramCacheKey = () => 'venus-haze-v2'
  return material
}

// The ring and the cloud tops share the same analytic shadow in planet-radius units.
// This resolves the gaps in the rings without rendering six point-light shadow maps.
export function shadeSaturn(
  surface: T.MeshPhongMaterial,
  ring: T.MeshBasicMaterial,
  axis: T.Group,
  radius: number,
) {
  const pole = new T.Vector3(0, 1, 0).applyQuaternion(axis.quaternion)
  const bind = surface.userData.bindSaturnShadow as
    | ((p: T.Vector3, r: number, ringMat: T.MeshBasicMaterial) => void)
    | undefined
  bind?.(pole, radius, ring)
  shadePlanetaryRing(ring, axis, radius, polarRatio('Saturn'), true)
}

export function shadePlanetaryRing(
  ring: T.MeshBasicMaterial,
  axis: T.Group,
  radius: number,
  polar: number,
  detailed: boolean,
) {
  const pole = new T.Vector3(0, 1, 0).applyQuaternion(axis.quaternion)
  const opticalDepth = { value: 0 }
  if (detailed) ring.userData.closeOpticalDepth = opticalDepth
  ring.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      pole: { value: pole },
      polarRatio: { value: polar },
      closeOpticalDepth: opticalDepth,
    })
    shader.vertexShader =
      'varying vec3 vOffset; varying vec3 vToSun; varying vec3 vToCam; varying float vRingU;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 _rWorld = modelMatrix * vec4(transformed, 1.0);
        vOffset = mat3(modelMatrix) * transformed / ${radius.toFixed(6)};
        vToSun = -_rWorld.xyz;
        vToCam = cameraPosition - _rWorld.xyz;
        vRingU = uv.x;
      `,
      )
    shader.fragmentShader =
      `
      varying vec3 vOffset;
      varying vec3 vToSun;
      varying vec3 vToCam;
      varying float vRingU;
      uniform vec3 pole;
      uniform float polarRatio;
      uniform float closeOpticalDepth;
    ` +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
        vec3 ray = normalize(vToSun);
        vec3 viewR = normalize(vToCam);
        float stretch = 1.0 / polarRatio - 1.0;
        vec3 origin = vOffset + pole * dot(vOffset, pole) * stretch;
        vec3 dir = normalize(ray + pole * dot(ray, pole) * stretch);
        float t = max(0.0, -dot(origin, dir));
        float transmission = smoothstep(0.982, 1.018, length(origin + t * dir));
        float sunSide = dot(ray, pole);
        float camSide = dot(viewR, pole);
        ${detailed ? `if (closeOpticalDepth > 0.5) {
          float pathLength = 1.0 / max(0.32, abs(camSide));
          diffuseColor.a = 1.0 - pow(max(0.0, 1.0 - diffuseColor.a), pathLength);
        }` : ''}
        float phaseCos = dot(ray, viewR);
        float opposition = 1.0 + 0.16 * pow(max(0.0, phaseCos), 6.0);
        float forwardGlow = 0.24 * pow(max(0.0, -phaseCos), 5.0);
        float ringlets = ${
          detailed
            ? '1.0 + 0.042 * sin(vRingU * 360.0) + 0.024 * sin(vRingU * 880.0 + 1.3)'
            : '1.0 + 0.03 * sin(vRingU * 240.0)'
        };
        float litSide = (0.36 + 0.64 * sqrt(abs(sunSide))) * opposition;
        float backSide = 0.26 + 0.38 * (1.0 - diffuseColor.a) + forwardGlow;
        float sideLight = (sunSide * camSide >= 0.0) ? litSide : backSide;
        vec3 shadowTint = mix(vec3(0.09, 0.085, 0.11), vec3(1.0), transmission);
        outgoingLight *= sideLight * ringlets * shadowTint;
        #include <opaque_fragment>
      `,
      )
  }
  ring.customProgramCacheKey = () => (detailed ? 'saturn-ring-v2' : 'minor-ring-v2')
}

function makeRadialRingTexture(
  bands: { pos: number; width: number; alpha: number; color: [number, number, number] }[],
) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 4
  const k = c.getContext('2d')!
  const img = k.createImageData(512, 4)
  for (let x = 0; x < 512; x++) {
    const u = x / 511
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (const band of bands) {
      const d = (u - band.pos) / band.width
      const w = Math.exp(-d * d) * band.alpha
      r += band.color[0] * w
      g += band.color[1] * w
      b += band.color[2] * w
      a += w
    }
    const alpha = Math.min(1, a)
    const inv = a > 0.0001 ? 1 / a : 0
    const rr = Math.min(255, Math.round(r * inv))
    const gg = Math.min(255, Math.round(g * inv))
    const bb = Math.min(255, Math.round(b * inv))
    const aa = Math.round(alpha * 255)
    for (let y = 0; y < 4; y++) {
      const idx = (y * 512 + x) * 4
      img.data[idx] = rr
      img.data[idx + 1] = gg
      img.data[idx + 2] = bb
      img.data[idx + 3] = aa
    }
  }
  k.putImageData(img, 0, 0)
  const tex = new T.CanvasTexture(c)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

function buildRingMesh(
  inner: number,
  outer: number,
  texture: T.Texture,
  axis: T.Group,
  radius: number,
  polar: number,
  opacity = 1,
) {
  const g = new T.RingGeometry(inner, outer, 256, 4)
  const uv = g.attributes.uv
  const pos = g.attributes.position
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5)
  }
  g.rotateX(-Math.PI / 2)
  const mat = new T.MeshBasicMaterial({
    map: texture,
    side: T.DoubleSide,
    transparent: true,
    opacity,
    depthWrite: false,
    color: 0xffffff,
  })
  shadePlanetaryRing(mat, axis, radius, polar, false)
  return new T.Mesh(g, mat)
}

export function createUranusRings(radius: number, axis: T.Group) {
  const tex = makeRadialRingTexture([
    // Faint dusty inner sheet + 6, 5, 4 rings
    { pos: 0.14, width: 0.04, alpha: 0.1, color: [152, 178, 198] },
    { pos: 0.24, width: 0.015, alpha: 0.18, color: [168, 194, 214] },
    { pos: 0.31, width: 0.015, alpha: 0.2, color: [170, 198, 216] },
    // Alpha & Beta rings
    { pos: 0.44, width: 0.018, alpha: 0.28, color: [176, 206, 224] },
    { pos: 0.52, width: 0.018, alpha: 0.28, color: [178, 208, 226] },
    // Eta, Gamma, Delta rings
    { pos: 0.63, width: 0.025, alpha: 0.22, color: [165, 196, 218] },
    { pos: 0.69, width: 0.014, alpha: 0.34, color: [192, 220, 236] },
    { pos: 0.75, width: 0.016, alpha: 0.3, color: [184, 214, 232] },
    // Bright iconic Epsilon ring
    { pos: 0.9, width: 0.024, alpha: 0.62, color: [208, 232, 245] },
    { pos: 0.91, width: 0.06, alpha: 0.14, color: [168, 204, 224] },
  ])
  return buildRingMesh(
    radius * uranusRingInner,
    radius * uranusRingOuter,
    tex,
    axis,
    radius,
    polarRatio('Uranus'),
    0.72,
  )
}

export function createHaumeaRing(radius: number, axis: T.Group) {
  const tex = makeRadialRingTexture([
    { pos: 0.5, width: 0.18, alpha: 0.48, color: [204, 220, 236] },
    { pos: 0.5, width: 0.36, alpha: 0.14, color: [176, 198, 218] },
  ])
  return buildRingMesh(radius * 2.02, radius * 2.24, tex, axis, radius, 0.69, 0.56)
}

/** 10199 Chariklo's razor-sharp twin water-ice rings: inner denser Oiapoque & outer thinner Chuí. */
export function createCharikloRings(radius: number, axis: T.Group) {
  const tex = makeRadialRingTexture([
    // Faint dusty halo between body and rings
    { pos: 0.18, width: 0.12, alpha: 0.06, color: [164, 184, 200] },
    // Oiapoque (dense inner ring, ~7 km wide)
    { pos: 0.42, width: 0.042, alpha: 0.78, color: [208, 224, 238] },
    { pos: 0.42, width: 0.09, alpha: 0.18, color: [176, 198, 218] },
    // Crisp 9 km gap, then Chuí (narrower outer ring, ~3 km wide)
    { pos: 0.74, width: 0.026, alpha: 0.52, color: [194, 216, 234] },
  ])
  return buildRingMesh(radius * 1.56, radius * 2.12, tex, axis, radius, 0.74, 0.84)
}

/** 2060 Chiron's evolving icy-dust ring & disc system observed by stellar occultations (2011–2023). */
export function createChironRings(radius: number, axis: T.Group) {
  const tex = makeRadialRingTexture([
    { pos: 0.36, width: 0.055, alpha: 0.42, color: [176, 208, 228] },
    { pos: 0.54, width: 0.04, alpha: 0.36, color: [192, 220, 238] },
    { pos: 0.52, width: 0.28, alpha: 0.14, color: [148, 184, 212] },
  ])
  return buildRingMesh(radius * 1.58, radius * 2.24, tex, axis, radius, 0.88, 0.68)
}

/** 50000 Quaoar's famous beyond-Roche-limit double rings (inner faint Q2R & wide outer clumpy Q1R, CHEOPS 2023). */
export function createQuaoarRings(radius: number, axis: T.Group) {
  const tex = makeRadialRingTexture([
    // Inner faint Q2R ring (~2,520 km)
    { pos: 0.22, width: 0.032, alpha: 0.28, color: [196, 186, 184] },
    { pos: 0.22, width: 0.08, alpha: 0.09, color: [178, 168, 168] },
    // Prominent outer Q1R ring (~4,100 km, far outside classical Roche limit!)
    { pos: 0.84, width: 0.044, alpha: 0.68, color: [222, 212, 208] },
    { pos: 0.84, width: 0.1, alpha: 0.18, color: [194, 180, 178] },
  ])
  return buildRingMesh(radius * 1.92, radius * 3.38, tex, axis, radius, 1.0, 0.76)
}

/** Translucent active cometary CO/dust coma halo around active Centaur 2060 Chiron (95P/Chiron). */
export function createChironComa(radius: number, geometry: T.SphereGeometry) {
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.BackSide,
    blending: T.AdditiveBlending,
    uniforms: {
      uLightPos: { value: new T.Vector3(0, 0, 0) },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uLightPos;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 toSun = normalize(uLightPos - vWorldPos);
        float ndv = abs(dot(normalize(vNormalW), viewDir));
        float shell = pow(ndv, 1.65) * smoothstep(0.0, 0.35, ndv);
        float sunBias = 0.55 + 0.45 * smoothstep(-0.4, 0.8, dot(-vNormalW, toSun));
        float alpha = shell * sunBias * 0.24;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(0.62, 0.84, 1.0, alpha);
      }
    `,
  })
  const mesh = new T.Mesh(geometry, mat)
  mesh.scale.setScalar(radius * 2.75)
  mesh.renderOrder = 2
  return mesh
}

export interface CraterSpec {
  dir: [number, number, number]
  radius: number
  depth: number
  peak?: number
}

export function buildRockyGeometry(
  seed: number,
  scaleXYZ: [number, number, number],
  roughness: number,
  craterCount: number,
  specialCraters: CraterSpec[] = [],
  segments: [number, number] = [56, 38],
) {
  const rand = seeded(seed)
  const craters: { cx: number; cy: number; cz: number; radius: number; depth: number; peak: number }[] =
    specialCraters.map((c) => {
      const len = Math.hypot(c.dir[0], c.dir[1], c.dir[2]) || 1
      return {
        cx: c.dir[0] / len,
        cy: c.dir[1] / len,
        cz: c.dir[2] / len,
        radius: c.radius,
        depth: c.depth,
        peak: c.peak ?? 0,
      }
    })
  for (let i = 0; i < craterCount; i++) {
    const z = rand() * 2 - 1
    const a = rand() * Math.PI * 2
    const rr = Math.sqrt(Math.max(0, 1 - z * z))
    const rad = 0.12 + rand() * 0.26
    craters.push({
      cx: Math.cos(a) * rr,
      cy: z,
      cz: Math.sin(a) * rr,
      radius: rad,
      depth: rad * (0.14 + rand() * 0.14),
      peak: 0,
    })
  }
  const p1 = rand() * 10
  const p2 = rand() * 10
  const p3 = rand() * 10
  const geo = new T.SphereGeometry(1, segments[0], segments[1])
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i)
    const ny = pos.getY(i)
    const nz = pos.getZ(i)
    let disp =
      1 +
      roughness *
        (0.55 * Math.sin(2.4 * nx + 3.1 * ny - 1.9 * nz + p1) +
          0.32 * Math.cos(4.8 * nx - 3.7 * ny + 4.2 * nz + p2) +
          0.18 * Math.sin(8.5 * nx + 7.1 * ny + 6.4 * nz + p3))
    for (const c of craters) {
      const dot = Math.max(-1, Math.min(1, nx * c.cx + ny * c.cy + nz * c.cz))
      const angle = Math.acos(dot)
      const q = angle / c.radius
      if (q < 1.48) {
        if (q < 1.0) {
          disp -= c.depth * (1 - q * q) * (1 - 0.15 * q)
          if (c.peak > 0 && q < 0.38) {
            const pq = q / 0.38
            disp += c.peak * (1 - pq * pq) ** 2
          }
        }
        if (q > 0.78) {
          const rq = (q - 1.04) / 0.18
          disp += c.depth * 0.26 * Math.exp(-rq * rq)
        }
      }
    }
    pos.setXYZ(i, nx * disp * scaleXYZ[0], ny * disp * scaleXYZ[1], nz * disp * scaleXYZ[2])
  }
  geo.computeVertexNormals()
  return geo
}

/** Upgraded regolith-shaded material for instanced minor moons (supports per-instance color + normal map). */
export function createMinorMoonMaterial(
  map: T.Texture | null,
  normalMap: T.Texture | null = null,
) {
  const material = new T.MeshPhongMaterial({
    color: 0xffffff,
    map,
    normalMap,
    specular: 0x080809,
    shininess: 8,
  })
  material.normalScale.setScalar(1.05)
  if (!normalMap && map) {
    material.bumpMap = map
    material.bumpScale = 0.042
  }
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `
      #include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= 0.26;
      #if NUM_POINT_LIGHTS > 0
        vec3 _mSun = normalize(pointLights[0].position + vViewPosition);
        vec3 _mView = normalize(vViewPosition);
        float _mNdotL = max(0.0, dot(nonPerturbedNormal, _mSun));
        float _mMu = max(0.0, dot(nonPerturbedNormal, _mView));
        float _mLs = 1.36 / (_mNdotL + _mMu + 0.46);
        reflectedLight.directDiffuse *= mix(1.0, _mLs, 0.42);
      #endif
      `,
    )
  }
  material.customProgramCacheKey = () => 'minor-moon-regolith-v1'
  return material
}

/** Cryovolcanic water-ice plume emanating from Enceladus's south polar Tiger Stripes. */
export function createEnceladusPlumeMesh() {
  // Narrow base anchored over south-polar tiger stripes (y ≈ -0.92), fanning outward into space (y ≈ -2.27)
  const geo = new T.CylinderGeometry(0.24, 0.78, 1.35, 36, 12, true)
  geo.translate(0, -1.59, 0)
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: {
      uLightPos: { value: new T.Vector3(0, 0, 0) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uLightPos;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        // vUv.y = 1 near south pole apex, 0 at far outer tip after rotateX(PI)
        float along = 1.0 - vUv.y;
        float coreFade = smoothstep(0.0, 0.14, along) * pow(max(0.0, 1.0 - along), 1.9);
        // Discrete geyser jets emanating from the 4 tiger stripes
        float a = vUv.x * 6.2831853;
        float jets = 0.52 + 0.24 * sin(a * 4.0 + 0.4) + 0.14 * sin(a * 9.0 - 1.1) + 0.1 * cos(a * 15.0 + 2.3);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 toSun = normalize(uLightPos - vWorldPos);
        // Edge-softened volumetric cone
        float edge = pow(abs(dot(normalize(vNormalW), viewDir)), 0.72);
        // Forward Mie scattering of ice grains when backlit by the Sun
        float forward = pow(max(0.0, dot(-viewDir, toSun)), 4.0);
        float alpha = coreFade * jets * edge * (0.24 + 0.55 * forward);
        if (alpha < 0.002) discard;
        vec3 col = mix(vec3(0.68, 0.88, 1.0), vec3(0.92, 0.97, 1.0), forward);
        gl_FragColor = vec4(col, clamp(alpha * 0.55, 0.0, 0.65));
      }
    `,
  })
  const mesh = new T.Mesh(geo, mat)
  mesh.renderOrder = 3
  return mesh
}
