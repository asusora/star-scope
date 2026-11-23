import * as T from 'three'
import { detailSources, sources } from '../../data/assets'
import { seeded, tau } from '../math'
import type { Landscape } from './landscape'

export interface RealisticSky {
  group: T.Group
  update: (cameraPos: T.Vector3, time: number, pixelRatio: number) => void
  dispose: () => void
}

const skyDomeVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}`

const moonSkyFrag = `
uniform vec3 uSunDir;
varying vec3 vDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

void main() {
  vec3 d = normalize(vDir);
  // True airless lunar vacuum: pitch black all the way down to the razor-sharp horizon.
  vec3 col = vec3(0.0);

  float sunCos = dot(d, uSunDir);
  // Camera glare suppression: stars & faint Milky Way fade out only near the blazing Sun.
  float glareKeep = smoothstep(0.95, 0.65, sunCos);

  // Ultra-subtle Milky Way dust band visible away from solar glare.
  vec3 galDir = vec3(
    d.x * 0.82 - d.y * 0.57,
    d.x * 0.57 + d.y * 0.82,
    d.z
  );
  float galBand = exp(-pow(galDir.y * 4.2, 2.0));
  if (galBand > 0.01 && glareKeep > 0.01) {
    float n1 = vnoise3(galDir * 3.6 + vec3(1.4, -2.1, 0.7));
    float n2 = vnoise3(galDir * 9.2 - vec3(2.3, 1.1, 3.4));
    float rift = smoothstep(0.38, 0.72, vnoise3(galDir * 6.4 + vec3(4.2, 0.8, -1.9)));
    float mw = galBand * (0.45 * n1 + 0.55 * n2) * (1.0 - 0.62 * rift);
    col += vec3(0.032, 0.042, 0.062) * mw * glareKeep;
  }

  // Faint zodiacal light cone along the ecliptic near the Sun.
  float zodi = pow(max(0.0, sunCos), 10.0) * 0.016;
  col += vec3(0.95, 0.96, 1.0) * zodi;

  // True lunar Sun (angular diameter ~0.53 deg, cos(0.265 deg) = 0.9999893)
  // Crisp white solar photosphere + subtle optical corona + delicate camera diffraction spikes.
  float disk = smoothstep(0.999968, 0.999991, sunCos);
  float innerCorona = pow(max(0.0, sunCos), 1800.0) * 1.15;
  float midGlow = pow(max(0.0, sunCos), 180.0) * 0.16;
  float outerVeil = pow(max(0.0, sunCos), 28.0) * 0.032;

  float spikes = 0.0;
  if (sunCos > 0.94) {
    vec3 upRef = abs(uSunDir.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 sRight = normalize(cross(upRef, uSunDir));
    vec3 sUp = cross(uSunDir, sRight);
    vec2 sp = vec2(dot(d, sRight), dot(d, sUp));
    float angDist = length(sp);
    if (angDist > 1e-4) {
      float s1 = exp(-abs(sp.y) * 290.0) * exp(-abs(sp.x) * 14.0);
      float s2 = exp(-abs(sp.x) * 290.0) * exp(-abs(sp.y) * 14.0);
      vec2 rot = vec2(sp.x * 0.7071 - sp.y * 0.7071, sp.x * 0.7071 + sp.y * 0.7071);
      float s3 = (exp(-abs(rot.y) * 340.0) * exp(-abs(rot.x) * 22.0) +
                  exp(-abs(rot.x) * 340.0) * exp(-abs(rot.y) * 22.0)) * 0.42;
      spikes = (s1 + s2 + s3) * 0.45 * smoothstep(0.94, 0.995, sunCos);
    }
  }

  vec3 sunCol = vec3(1.0, 0.99, 0.96) * (disk * 4.5 + innerCorona + spikes)
              + vec3(0.94, 0.96, 1.0) * (midGlow + outerVeil);
  col += sunCol;

  // ACES filmic shoulder so the Sun stays luminous white without ugly hard clipping.
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`

const moonStarsVert = `
attribute vec3 color;
attribute float aSize;
uniform vec3 uSunDir;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 dir = normalize(position);
  float sunCos = dot(dir, uSunDir);
  // Suppress stars within ~22 deg of the blazing Sun while keeping the rest of the black sky crisp.
  float glareKeep = smoothstep(0.96, 0.72, sunCos);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPixelRatio, 1.2, 4.8 * uPixelRatio);
  vColor = color;
  vAlpha = glareKeep;
}`

const moonStarsFrag = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 >= 1.0) discard;
  float core = exp(-r2 * 10.5);
  float halo = exp(-r2 * 3.2) * 0.42;
  float a = clamp((core * 1.15 + halo) * vAlpha, 0.0, 1.0);
  vec3 c = mix(vColor, vec3(1.0), clamp(core * 0.8, 0.0, 1.0));
  gl_FragColor = vec4(c * a, a);
}`

const earthInSkyVert = `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDirW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDirW = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const earthInSkyFrag = `
uniform sampler2D uMap;
uniform sampler2D uClouds;
uniform sampler2D uNight;
uniform float uHasMap;
uniform float uHasClouds;
uniform float uHasNight;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDirW;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(vViewDirW);
  float ndl = dot(n, uSunDir);
  float day = smoothstep(-0.08, 0.12, ndl);
  float diffuse = max(0.0, ndl);
  float mu = max(0.0, dot(n, v));

  // Fallback oceanic blue + white swirls before textures finish decoding.
  vec3 albedo = vec3(0.08, 0.24, 0.56);
  if (uHasMap > 0.5) {
    albedo = texture2D(uMap, vUv).rgb;
  }

  float cloud = 0.0;
  if (uHasClouds > 0.5) {
    cloud = texture2D(uClouds, vec2(fract(vUv.x - 0.06), vUv.y)).r;
  }

  // Subtle oceanic specular glint
  vec3 halfV = normalize(uSunDir + v);
  float oceanMask = clamp((albedo.b - max(albedo.r, albedo.g) * 0.85) * 4.5, 0.0, 1.0);
  float spec = pow(max(0.0, dot(n, halfV)), 42.0) * oceanMask * (1.0 - cloud * 0.85) * diffuse * 0.42;

  vec3 surface = mix(albedo, vec3(0.95, 0.97, 1.0), clamp(cloud * 0.92, 0.0, 0.94));
  // Realistic Earthshine + daylight illumination
  vec3 lit = surface * (diffuse * 1.28 + 0.008) + vec3(0.95, 0.97, 1.0) * spec;

  // Delicate blue Rayleigh atmospheric limb glow on the sunlit crescent
  float rim = pow(1.0 - mu, 3.0);
  lit += vec3(0.24, 0.58, 1.0) * rim * smoothstep(-0.18, 0.45, ndl) * 0.82;
  // Subtle twilight warm band right along the terminator
  float term = exp(-pow((ndl - 0.01) / 0.11, 2.0));
  lit += vec3(0.75, 0.34, 0.14) * term * rim * 0.28;

  // Faint golden city lights on the night hemisphere
  if (uHasNight > 0.5) {
    vec3 nightTex = texture2D(uNight, vUv).rgb;
    float nightMask = 1.0 - smoothstep(-0.16, 0.04, ndl);
    lit += nightTex * nightMask * (1.0 - 0.65 * cloud) * vec3(1.0, 0.78, 0.48) * 0.55;
  }

  // Soft filmic tone curve
  lit = (lit * (2.51 * lit + 0.03)) / (lit * (2.43 * lit + 0.59) + 0.14);
  gl_FragColor = vec4(lit, 1.0);
}`

const earthHaloFrag = `
uniform vec3 uSunDir;
varying vec3 vNormalW;
varying vec3 vViewDirW;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(vViewDirW);
  float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 3.4);
  float day = smoothstep(-0.22, 0.45, dot(-n, uSunDir));
  vec3 col = vec3(0.26, 0.62, 1.0);
  float a = rim * (0.04 + 0.72 * day);
  if (a < 0.002) discard;
  gl_FragColor = vec4(col * a, a);
}`

// Martian Mie iron-oxide dust + Rayleigh scattering sky shader
const marsSkyFrag = `
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm2(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise2(p);
    p = rot * p * 2.12 + vec2(7.3, -4.1);
    a *= 0.48;
  }
  return v;
}

float hgPhase(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * 3.14159265 * pow(max(0.001, 1.0 + g2 - 2.0 * g * cosTheta), 1.5));
}

void main() {
  vec3 d = normalize(vDir);
  float y = max(0.0, d.y);
  float sunCos = dot(d, uSunDir);

  // Martian suspended iron-oxide dust (~1.5 um) atmospheric gradient:
  // Warm dusty peach-butterscotch near the horizon, deepening to muted dusty sienna/slate at zenith.
  float hCurve = pow(y, 0.52);
  vec3 horizonCol = vec3(0.76, 0.50, 0.34);
  vec3 midSkyCol  = vec3(0.58, 0.36, 0.25);
  vec3 zenithCol  = vec3(0.24, 0.16, 0.14);
  vec3 sky = mix(horizonCol, midSkyCol, smoothstep(0.0, 0.34, hCurve));
  sky = mix(sky, zenithCol, smoothstep(0.26, 1.0, hCurve));

  // Subtle horizon dust belt density (thickest within 0..8 deg elevation)
  float dustBelt = exp(-y * 11.5);
  sky = mix(sky, vec3(0.84, 0.58, 0.40), dustBelt * 0.42);

  // Martian forward-scattering signature:
  // Broad warm butterscotch aureole + iconic cool pale-blue/silver Mie forward-scattering halo near the Sun!
  float broadScatter = hgPhase(sunCos, 0.48);
  float blueForward = hgPhase(sunCos, 0.86);
  float sunHorizonBoost = 0.72 + 0.55 * exp(-y * 5.2);

  vec3 warmAureole = vec3(0.95, 0.64, 0.40) * min(broadScatter * 0.54, 0.42) * sunHorizonBoost;
  // Cool blue-white forward scatter characteristic of Mars ~1.5um iron-oxide dust around low Sun
  float blueMask = clamp(blueForward * 0.11, 0.0, 0.78);
  vec3 blueHalo = vec3(0.62, 0.78, 0.98) * blueMask * (0.78 + 0.45 * exp(-y * 3.8));
  sky = mix(sky, vec3(0.46, 0.54, 0.66), clamp(pow(max(0.0, sunCos), 18.0) * 0.42, 0.0, 0.42));
  sky += warmAureole + blueHalo;

  // Delicate high-altitude Martian water-ice cirrus clouds (40-60 km, Perseverance/Curiosity style)
  if (d.y > 0.025) {
    vec2 cloudUv = d.xz / (d.y + 0.14) * 1.15;
    vec2 drift = vec2(uTime * 0.0024, -uTime * 0.0011);
    float warp = fbm2(cloudUv * 0.55 + drift);
    float streaks = fbm2(vec2(cloudUv.x * 0.85 + warp * 0.9, cloudUv.y * 2.8 - warp * 0.5) + drift * 1.4);
    float detail = fbm2(cloudUv * 3.1 - drift * 0.8);
    float cirrus = smoothstep(0.55, 0.86, streaks * 0.72 + detail * 0.28);
    cirrus *= smoothstep(0.025, 0.16, d.y) * (1.0 - smoothstep(0.58, 0.95, d.y));
    vec3 cirrusCol = mix(vec3(0.84, 0.72, 0.62), vec3(0.96, 0.95, 0.94), smoothstep(0.4, 0.96, sunCos));
    sky = mix(sky, cirrusCol, cirrus * 0.24);
  }

  // True Martian Sun: smaller angular diameter (~0.35 deg, cos(0.175 deg) = 0.9999953)
  // Softened gently by atmospheric dust with a cool luminous white core.
  float disk = smoothstep(0.999982, 0.999996, sunCos);
  float tightGlow = pow(max(0.0, sunCos), 950.0) * 0.92;
  vec3 sunTint = vec3(0.96, 0.97, 1.0) * (disk * 3.2) + vec3(0.86, 0.91, 0.98) * tightGlow;
  sky += sunTint;

  // Below horizon fill (smooth ground bounce in case terrain edge ever peeks)
  if (d.y < 0.0) {
    sky = mix(horizonCol, vec3(0.32, 0.19, 0.12), smoothstep(0.0, -0.25, d.y));
  }

  // Gentle ACES filmic shoulder + 1-bit dither to guarantee zero sky banding
  sky = (sky * (2.51 * sky + 0.03)) / (sky * (2.43 * sky + 0.59) + 0.14);
  sky += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(max(sky, vec3(0.0)), 1.0);
}`

function createMoonStars(sunVec: T.Vector3, seed: number) {
  const count = 2600
  const rand = seeded(seed ^ 0x51a7f3)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  const palette: [number, number, number, number][] = [
    [0.16, 0.68, 0.84, 1.0],
    [0.42, 0.86, 0.93, 1.0],
    [0.72, 0.98, 0.99, 1.0],
    [0.88, 1.0, 0.92, 0.76],
    [0.96, 1.0, 0.80, 0.58],
    [1.0, 1.0, 0.68, 0.52],
  ]

  for (let i = 0; i < count; i++) {
    const u = rand() * tau
    const y = rand() * 1.15 - 0.15 // Mostly upper hemisphere, slight margin below horizon
    const clampedY = Math.max(-0.15, Math.min(0.998, y))
    const flat = Math.sqrt(Math.max(0, 1 - clampedY * clampedY))
    const r = 3400
    const i3 = i * 3
    positions[i3] = Math.cos(u) * flat * r
    positions[i3 + 1] = clampedY * r
    positions[i3 + 2] = Math.sin(u) * flat * r

    const roll = rand()
    let cr = 0.97, cg = 0.98, cb = 1.0
    for (const [cut, r0, g0, b0] of palette) {
      if (roll <= cut) {
        cr = r0
        cg = g0
        cb = b0
        break
      }
    }
    // Realistic stellar magnitude curve: crisp pinpoint stars visible against black lunar vacuum
    const mag = rand() ** 2.2
    const bright = 0.34 + 0.66 * mag
    colors[i3] = cr * bright
    colors[i3 + 1] = cg * bright
    colors[i3 + 2] = cb * bright
    sizes[i] = 1.35 + mag * 3.1
  }

  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(positions, 3))
  geo.setAttribute('color', new T.BufferAttribute(colors, 3))
  geo.setAttribute('aSize', new T.BufferAttribute(sizes, 1))
  const mat = new T.ShaderMaterial({
    vertexShader: moonStarsVert,
    fragmentShader: moonStarsFrag,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: {
      uSunDir: { value: sunVec.clone() },
      uPixelRatio: { value: 1 },
    },
  })
  const pts = new T.Points(geo, mat)
  pts.frustumCulled = false
  pts.renderOrder = 2
  return { pts, geo, mat }
}

function createEarthInLunarSky(
  sunVec: T.Vector3,
  requestDraw: () => void,
) {
  const earthGroup = new T.Group()
  // Iconic Earthrise placement: cleanly framed upper-right in both wide and narrow viewports (~17.5 deg elevation)
  const earthDir = new T.Vector3(0.18, 0.30, -0.935).normalize()
  const earthDist = 3050
  const earthRadius = 64 // ~2.4 deg apparent diameter — vivid Apollo Earthrise presence in the black lunar sky

  const geo = new T.SphereGeometry(earthRadius, 56, 40)
  const uniforms = {
    uMap: { value: null as T.Texture | null },
    uClouds: { value: null as T.Texture | null },
    uNight: { value: null as T.Texture | null },
    uHasMap: { value: 0 },
    uHasClouds: { value: 0 },
    uHasNight: { value: 0 },
    uSunDir: { value: sunVec.clone() },
  }
  const mat = new T.ShaderMaterial({
    vertexShader: earthInSkyVert,
    fragmentShader: earthInSkyFrag,
    uniforms,
    depthTest: true,
    depthWrite: true,
  })
  const earthMesh = new T.Mesh(geo, mat)
  earthMesh.position.copy(earthDir).multiplyScalar(earthDist)
  // Orient Earth to show Africa/Europe/Atlantic or Pacific/Asia beautifully lit on the sunlit side
  earthMesh.rotation.set(0.32, 2.35, -0.38)
  earthMesh.frustumCulled = false
  earthMesh.renderOrder = 2
  earthGroup.add(earthMesh)

  const haloGeo = new T.SphereGeometry(earthRadius * 1.055, 40, 28)
  const haloMat = new T.ShaderMaterial({
    vertexShader: earthInSkyVert,
    fragmentShader: earthHaloFrag,
    uniforms: { uSunDir: { value: sunVec.clone() } },
    side: T.BackSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  })
  const haloMesh = new T.Mesh(haloGeo, haloMat)
  haloMesh.position.copy(earthMesh.position)
  haloMesh.frustumCulled = false
  haloMesh.renderOrder = 4
  earthGroup.add(haloMesh)

  const ownedTextures: T.Texture[] = []
  const pendingImages: HTMLImageElement[] = []
  let disposed = false

  function loadChannel(
    url: string | undefined,
    srgb: boolean,
    apply: (tex: T.Texture) => void,
  ) {
    if (!url) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    pendingImages.push(img)
    img.onload = () => {
      if (disposed) return
      const tex = new T.Texture(img)
      tex.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace
      tex.wrapS = T.RepeatWrapping
      tex.wrapT = T.ClampToEdgeWrapping
      tex.needsUpdate = true
      ownedTextures.push(tex)
      apply(tex)
      requestDraw()
    }
    img.src = url
  }

  loadChannel(detailSources.Earth ?? sources.Earth, true, (tex) => {
    uniforms.uMap.value = tex
    uniforms.uHasMap.value = 1
  })
  loadChannel(detailSources.EarthClouds ?? sources.Clouds, false, (tex) => {
    uniforms.uClouds.value = tex
    uniforms.uHasClouds.value = 1
  })
  loadChannel(detailSources.EarthNight, true, (tex) => {
    uniforms.uNight.value = tex
    uniforms.uHasNight.value = 1
  })

  return {
    group: earthGroup,
    dispose() {
      disposed = true
      for (const img of pendingImages) {
        img.onload = null
        img.removeAttribute('src')
      }
      for (const tex of ownedTextures) tex.dispose()
      geo.dispose()
      mat.dispose()
      haloGeo.dispose()
      haloMat.dispose()
    },
  }
}

function createPhobosInMarsSky(sunVec: T.Vector3) {
  const geo = new T.IcosahedronGeometry(3.8, 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const r = 1 + 0.14 * Math.sin(x * 0.9 + y * 0.6) + 0.08 * Math.cos(z * 1.1 - x * 0.7)
    pos.setXYZ(i, x * 1.24 * r, y * 0.88 * r, z * 0.96 * r)
  }
  geo.computeVertexNormals()
  const mat = new T.ShaderMaterial({
    uniforms: { uSunDir: { value: sunVec.clone() } },
    vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uSunDir;
      varying vec3 vN;
      void main() {
        float d = max(0.0, dot(normalize(vN), uSunDir));
        // Phobos is very dark carbonaceous grey-brown, partially veiled by Martian sky dust
        vec3 col = mix(vec3(0.42, 0.27, 0.21), vec3(0.68, 0.56, 0.48), 0.18 + 0.82 * d);
        gl_FragColor = vec4(col, 0.82);
      }`,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  })
  const mesh = new T.Mesh(geo, mat)
  const dir = new T.Vector3(0.38, 0.45, -0.81).normalize()
  mesh.position.copy(dir).multiplyScalar(3000)
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  return { mesh, geo, mat }
}

export function createRealisticSky(
  site: Landscape,
  sunDir: [number, number, number],
  requestDraw: () => void,
): RealisticSky {
  const group = new T.Group()
  const sunVec = new T.Vector3(sunDir[0], sunDir[1], sunDir[2]).normalize()
  const domeGeo = new T.SphereGeometry(3600, 64, 40)

  if (site.id === 'Moon') {
    const domeMat = new T.ShaderMaterial({
      vertexShader: skyDomeVert,
      fragmentShader: moonSkyFrag,
      side: T.BackSide,
      depthTest: true,
      depthWrite: false,
      depthFunc: T.LessEqualDepth,
      uniforms: { uSunDir: { value: sunVec } },
    })
    const dome = new T.Mesh(domeGeo, domeMat)
    dome.frustumCulled = false
    dome.renderOrder = 1
    group.add(dome)

    const stars = createMoonStars(sunVec, site.seed)
    group.add(stars.pts)

    const earth = createEarthInLunarSky(sunVec, requestDraw)
    group.add(earth.group)

    return {
      group,
      update(cameraPos: T.Vector3, _time: number, pixelRatio: number) {
        group.position.copy(cameraPos)
        stars.mat.uniforms.uPixelRatio.value = pixelRatio
      },
      dispose() {
        domeGeo.dispose()
        domeMat.dispose()
        stars.geo.dispose()
        stars.mat.dispose()
        earth.dispose()
      },
    }
  }

  // Mars physical Mie + Rayleigh dust sky + high-altitude ice cirrus + Phobos
  const timeUniform = { value: 0 }
  const domeMat = new T.ShaderMaterial({
    vertexShader: skyDomeVert,
    fragmentShader: marsSkyFrag,
    side: T.BackSide,
    depthTest: true,
    depthWrite: false,
    depthFunc: T.LessEqualDepth,
    uniforms: {
      uSunDir: { value: sunVec },
      uTime: timeUniform,
    },
  })
  const dome = new T.Mesh(domeGeo, domeMat)
  dome.frustumCulled = false
  dome.renderOrder = 1
  group.add(dome)

  const phobos = createPhobosInMarsSky(sunVec)
  group.add(phobos.mesh)

  return {
    group,
    update(cameraPos: T.Vector3, time: number) {
      group.position.copy(cameraPos)
      timeUniform.value = time
    },
    dispose() {
      domeGeo.dispose()
      domeMat.dispose()
      phobos.geo.dispose()
      phobos.mat.dispose()
    },
  }
}
