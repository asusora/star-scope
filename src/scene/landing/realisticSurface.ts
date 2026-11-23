import * as T from 'three'
import gravelUrl from '../../assets/landing/gravel.jpg'
import screeUrl from '../../assets/landing/scree.jpg'
import { clamp, seeded, tau } from '../math'
import { landingSunDirection, type Landscape, type Terrain } from './landscape'
import { createRealisticSky } from './skyShader'
import type { SurfacePose } from './software'

const DIVISIONS = 176
const STRIDE = DIVISIONS + 1
const OFFSETS = Float32Array.from({ length: STRIDE }, (_, i) => {
  const t = (2 * i) / DIVISIONS - 1
  return Math.sign(t) * 8.5 * Math.expm1(Math.abs(t) * 5.56)
})

const ROCK_CELL = 5.5
const ROCK_GRID_HALF = 16 // ~88m radius around player

interface RockCollider {
  x: number
  z: number
  r: number
}

function cellRand(gx: number, gz: number, seed: number) {
  let h = (Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663) ^ seed) >>> 0
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return h / 4294967296
  }
}

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

/** Sculpt sharp-faceted angular lunar breccia or Martian layered flagstone/ventifact rock prototypes. */
function buildRockPrototype(seed: number, mode: 'lunar' | 'marsSlab' | 'marsVentifact'): T.BufferGeometry {
  const rand = seeded(seed)
  const geo = new T.IcosahedronGeometry(1, 3)
  const pos = geo.attributes.position

  const cutCount = mode === 'marsSlab' ? 9 : 11
  const planes: { nx: number; ny: number; nz: number; dist: number; sharp: number }[] = []
  for (let i = 0; i < cutCount; i++) {
    const z = rand() * 2 - 1
    const a = rand() * tau
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    planes.push({
      nx: Math.cos(a) * r,
      ny: z,
      nz: Math.sin(a) * r,
      dist: mode === 'marsSlab' ? 0.62 + rand() * 0.24 : 0.58 + rand() * 0.24,
      sharp: mode === 'lunar' ? 2.8 : 2.2,
    })
  }
  if (mode === 'marsSlab') {
    // Crisp sedimentary top and bottom bedding planes
    planes.push({ nx: 0, ny: 1, nz: 0, dist: 0.48, sharp: 3.4 })
    planes.push({ nx: 0, ny: -1, nz: 0, dist: 0.44, sharp: 3.2 })
  }

  const sx = mode === 'marsSlab' ? 1.18 + rand() * 0.35 : 0.92 + rand() * 0.36
  const sy = mode === 'marsSlab' ? 0.44 + rand() * 0.2 : 0.68 + rand() * 0.32
  const sz = mode === 'marsSlab' ? 1.05 + rand() * 0.32 : 0.86 + rand() * 0.34

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    let r = 1.0
    for (let p = 0; p < planes.length; p++) {
      const pl = planes[p]
      const dot = x * pl.nx + y * pl.ny + z * pl.nz
      if (dot > pl.dist) {
        const excess = dot - pl.dist
        r -= excess * (0.72 + 0.22 * pl.sharp * excess)
      }
    }
    const n1 = noise3(x * 2.5 + 3.1, y * 2.5 - 1.4, z * 2.5 + 2.7, seed) - 0.5
    const n2 = noise3(x * 5.6 - 1.8, y * 5.6 + 2.9, z * 5.6 - 0.7, seed + 59) - 0.5
    r += n1 * 0.16 + n2 * 0.065
    if (mode === 'marsSlab') {
      // Subtle horizontal wind-carved stratification grooves on slab sides
      r += 0.032 * Math.sin(y * 16.0 + n1 * 3.0) * (1 - Math.abs(y) * 0.7)
    }
    r = Math.max(0.32, r)
    pos.setXYZ(i, x * r * sx, y * r * sy, z * r * sz)
  }
  geo.computeVertexNormals()
  return geo
}

function createTerrainMaterial(
  site: Landscape,
  sunVec: T.Vector3,
  tileUniform: { value: T.Texture | null },
  screeUniform: { value: T.Texture | null },
  readyUniform: { value: number },
) {
  const isMoon = site.id === 'Moon'
  const mat = new T.MeshStandardMaterial({
    color: 0xffffff,
    roughness: isMoon ? 0.96 : 0.92,
    metalness: 0.0,
  })

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = { value: sunVec }
    shader.uniforms.uDetailTex = tileUniform
    shader.uniforms.uScreeTex = screeUniform
    shader.uniforms.uTexReady = readyUniform

    shader.vertexShader =
      `
      attribute vec4 aMeta;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vMeta;
      ` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 _wp = modelMatrix * vec4(transformed, 1.0);
        vWorldPos = _wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        vMeta = aMeta;
        `,
      )

    shader.fragmentShader =
      `
      uniform vec3 uSunDir;
      uniform sampler2D uDetailTex;
      uniform sampler2D uScreeTex;
      uniform float uTexReady;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vMeta;

      float _h21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float _vn2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(_h21(i), _h21(i + vec2(1.0, 0.0)), f.x),
          mix(_h21(i + vec2(0.0, 1.0)), _h21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      // Anti-tiled multi-scale height sampling from detail textures
      float _sampleDetail(sampler2D tex, vec2 wp, float dist) {
        vec2 uv1 = wp * 0.29;
        vec2 uv2 = mat2(0.798, -0.602, 0.602, 0.798) * (wp * 0.074) + vec2(0.37, 0.61);
        vec2 uv3 = mat2(0.325, 0.945, -0.945, 0.325) * (wp * 0.017) + vec2(0.19, 0.83);
        float nearW = 1.0 - smoothstep(14.0, 75.0, dist);
        float midW  = 1.0 - smoothstep(90.0, 420.0, dist);
        float s1 = texture2D(tex, uv1).r;
        float s2 = texture2D(tex, uv2).r;
        float s3 = texture2D(tex, uv3).r;
        return mix(s3, mix(s2, s1 * 0.56 + s2 * 0.44, nearW), 0.38 + 0.62 * midW);
      }
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          vec3 _wn = normalize(vWorldNormal);
          float _camDist = length(vWorldPos - cameraPosition);
          float _slope = clamp(1.0 - _wn.y, 0.0, 1.0);
          float _macroN = _vn2(vWorldPos.xz * 0.018 + vec2(4.2, -1.7));
          float _medN = _vn2(vWorldPos.xz * 0.095 - vec2(2.1, 3.8));
          float _grain = uTexReady > 0.5 ? _sampleDetail(uDetailTex, vWorldPos.xz, _camDist) : 0.55;
          float _scree = uTexReady > 0.5 ? _sampleDetail(uScreeTex, vWorldPos.xz * 0.85, _camDist) : 0.55;

          ${
            isMoon
              ? `
              // Authentic lunar mare basalt regolith + brighter anorthosite ejecta & crater walls
              vec3 _mareDark = vec3(0.24, 0.242, 0.238);
              vec3 _mareMid  = vec3(0.37, 0.365, 0.354);
              vec3 _ejectaBright = vec3(0.56, 0.545, 0.52);
              float _toneMix = clamp(0.25 + 0.55 * _macroN + 0.22 * _medN, 0.0, 1.0);
              vec3 _albedo = mix(_mareDark, _mareMid, _toneMix);
              // Fresh crater ejecta & steep excavated walls expose brighter highland/breccia material
              float _brightMask = clamp(vMeta.x * 0.82 + smoothstep(0.18, 0.52, _slope) * 0.35, 0.0, 1.0);
              _albedo = mix(_albedo, _ejectaBright, _brightMask * (0.55 + 0.45 * _scree));
              // Micro regolith dust pockmarks & subtle mineral grit (fine powdery Apollo look)
              float _gritTone = mix(0.86, 1.14, _grain * 0.65 + _scree * 0.35);
              _albedo *= _gritTone;
              // Darken sheltered crater floors slightly
              _albedo *= (0.80 + 0.20 * vMeta.y);
              diffuseColor.rgb = _albedo;
              `
              : `
              // Authentic Martian geology (Perseverance / Curiosity natural-color palette):
              // Rusty ochre windblown dust in flats + dark grey-brown basaltic sand + layered sedimentary rock on cliffs
              vec3 _ochreDust   = vec3(0.55, 0.30, 0.17);
              vec3 _paleSand    = vec3(0.67, 0.42, 0.26);
              vec3 _darkBasalt  = vec3(0.24, 0.19, 0.175);
              vec3 _strataWarm  = vec3(0.50, 0.26, 0.15);
              vec3 _strataDark  = vec3(0.28, 0.19, 0.155);
              vec3 _strataPale  = vec3(0.64, 0.41, 0.27);

              // Base basin dust with dark basaltic coarse sand streaks (characteristic of Gale/Jezero)
              vec3 _albedo = mix(_ochreDust, _paleSand, clamp(_macroN * 0.72 + _medN * 0.28, 0.0, 1.0));
              float _basaltStreak = smoothstep(0.54, 0.84, _vn2(vWorldPos.xz * 0.045 + vec2(_macroN * 2.4, -1.2)));
              _albedo = mix(_albedo, _darkBasalt, _basaltStreak * 0.40 * (1.0 - vMeta.z * 0.5));

              // Exposed layered sedimentary bedrock on slopes, mesas, and outcrops
              float _rockMask = clamp(smoothstep(0.13, 0.42, _slope) + vMeta.x * 0.72, 0.0, 1.0);
              float _strataY = vWorldPos.y * 1.15 + _macroN * 2.6 + _medN * 0.48;
              float _bandA = 0.5 + 0.5 * sin(_strataY * 3.1);
              float _bandB = 0.5 + 0.5 * sin(_strataY * 7.8 + 1.4);
              float _crack = smoothstep(0.93, 0.995, abs(sin(_strataY * 3.1)));
              vec3 _rockCol = mix(_strataDark, _strataWarm, _bandA);
              _rockCol = mix(_rockCol, _strataPale, smoothstep(0.55, 0.92, _bandB) * 0.55);
              _rockCol *= (1.0 - 0.28 * _crack);
              _rockCol *= mix(0.82, 1.18, _scree);

              _albedo = mix(_albedo * mix(0.86, 1.14, _grain), _rockCol, _rockMask);

              // Subtle organic brightness modulation across patchy wind-drift sand ripples
              if (vMeta.z > 0.02 && _camDist < 150.0) {
                float _wWarp = _vn2(vWorldPos.xz * 0.065) * 6.5 + _vn2(vWorldPos.xz * 0.19) * 2.2;
                float _rPhase = (vWorldPos.z * 1.4 + vWorldPos.x * 0.75) + _wWarp;
                float _crest = 0.5 + 0.5 * sin(_rPhase);
                float _rFade = (1.0 - smoothstep(45.0, 150.0, _camDist)) * vMeta.z * (1.0 - _rockMask);
                _albedo *= mix(1.0, 0.92 + 0.14 * _crest, _rFade);
              }
              diffuseColor.rgb = _albedo;
              `
          }
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `
          #include <normal_fragment_maps>
          if (uTexReady > 0.5) {
            float _nDist = length(vWorldPos - cameraPosition);
            float _microFade = 1.0 - smoothstep(14.0, 115.0, _nDist);
            float _eps = mix(0.18, 0.65, clamp(_nDist / 80.0, 0.0, 1.0));
            float _h0 = _sampleDetail(${isMoon ? 'uDetailTex' : 'uScreeTex'}, vWorldPos.xz, _nDist);
            float _hx = _sampleDetail(${isMoon ? 'uDetailTex' : 'uScreeTex'}, vWorldPos.xz + vec2(_eps, 0.0), _nDist);
            float _hz = _sampleDetail(${isMoon ? 'uDetailTex' : 'uScreeTex'}, vWorldPos.xz + vec2(0.0, _eps), _nDist);
            // Gently calibrated micro-normal relief: crisp powder/gravel texture without harsh black speckle artifacts
            float _bumpAmp = ${isMoon ? '0.078' : '0.092'} * (0.28 + 0.72 * _microFade);
            vec3 _wBump = vec3((_h0 - _hx) * _bumpAmp / _eps, 0.0, (_h0 - _hz) * _bumpAmp / _eps);

            ${
              isMoon
                ? ''
                : `
                // Crisp horizontal strata ledges + subtle organic wind-drift micro-normals on Mars
                float _rockSlope = clamp(smoothstep(0.13, 0.42, 1.0 - normalize(vWorldNormal).y) + vMeta.x * 0.72, 0.0, 1.0);
                if (_rockSlope > 0.05) {
                  float _sy = vWorldPos.y * 1.15 + _vn2(vWorldPos.xz * 0.018 + vec2(4.2, -1.7)) * 2.6;
                  float _ledge = cos(_sy * 3.1) * 0.18 + cos(_sy * 7.8 + 1.4) * 0.09;
                  _wBump.y += _ledge * _rockSlope * (0.35 + 0.65 * _microFade);
                }
                if (vMeta.z > 0.02 && _nDist < 120.0) {
                  float _rw = _vn2(vWorldPos.xz * 0.065) * 6.5 + _vn2(vWorldPos.xz * 0.19) * 2.2;
                  float _rp = (vWorldPos.z * 1.4 + vWorldPos.x * 0.75) + _rw;
                  float _dr = (cos(_rp) + 0.42 * cos(_rp * 2.0 - 0.5)) * 0.10 * vMeta.z * (1.0 - _rockSlope) * (1.0 - smoothstep(35.0, 120.0, _nDist));
                  _wBump += vec3(_dr * 0.52, 0.0, _dr);
                }
                `
            }
            _wBump = clamp(_wBump, vec3(-0.42), vec3(0.42));
            vec3 _perturbedW = normalize(normalize(vWorldNormal) + _wBump);
            normal = normalize((viewMatrix * vec4(_perturbedW, 0.0)).xyz);
          }
          `,
        )
        .replace(
          '#include <lights_fragment_end>',
          `
          #include <lights_fragment_end>
          // Smoothly blend distant macro terrain self-shadowing outside the 72m live shadow-map range
          float _shadowEdge = smoothstep(54.0, 72.0, length(vWorldPos.xz - cameraPosition.xz));
          float _farOcc = mix(1.0, vMeta.y, _shadowEdge);
          reflectedLight.directDiffuse *= _farOcc;

          ${
            isMoon
              ? `
              // Lunar Hapke / Lommel-Seeliger powder regolith response:
              // Strong opposition surge back-scatter when looking away from Sun; razor-sharp high-contrast shadow side.
              vec3 _toCamW = normalize(cameraPosition - vWorldPos);
              vec3 _wnL = normalize(vWorldNormal);
              float _ndl = max(0.0, dot(_wnL, uSunDir));
              float _ndv = max(0.05, dot(_wnL, _toCamW));
              float _ls = 1.42 / (_ndl + _ndv + 0.36);
              float _opp = 1.0 + 0.24 * pow(max(0.0, dot(_toCamW, uSunDir)), 4.0);
              reflectedLight.directDiffuse *= mix(1.0, _ls, 0.52) * _opp;
              reflectedLight.directSpecular *= 0.12;
              `
              : `
              // Dusty Martian soil has matte Oren-Nayar-like broad diffuse reflection
              reflectedLight.directSpecular *= 0.22;
              `
          }
          `,
        )
        .replace(
          '#include <dithering_fragment>',
          `
          ${
            isMoon
              ? `
              // Airless Moon: ZERO atmospheric haze. Distant mountains stay razor-sharp against black vacuum!
              `
              : `
              // Physical Mars height-attenuated & sun-forward-scattering dust aerial perspective
              vec3 _toFrag = vWorldPos - cameraPosition;
              float _distM = length(_toFrag);
              vec3 _rayD = _toFrag / max(_distM, 0.001);
              float _heightFactor = exp(-max(0.0, vWorldPos.y - cameraPosition.y) * 0.0085);
              float _fogAmt = 1.0 - exp(-(_distM / 1180.0) * (0.58 + 0.42 * _heightFactor));
              float _sunAlign = max(0.0, dot(_rayD, uSunDir));
              vec3 _marsFogBase = vec3(0.75, 0.49, 0.34);
              vec3 _marsFogSun  = vec3(0.88, 0.72, 0.56);
              vec3 _marsFogCol  = mix(_marsFogBase, _marsFogSun, pow(_sunAlign, 3.0) * 0.65);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, _marsFogCol, clamp(_fogAmt * 0.92, 0.0, 0.92));
              `
          }
          // ACES Filmic tone mapping matching the realistic sky shader
          vec3 _tc = gl_FragColor.rgb;
          gl_FragColor.rgb = (_tc * (2.51 * _tc + 0.03)) / (_tc * (2.43 * _tc + 0.59) + 0.14);
          #include <dithering_fragment>
          `,
        )
  }

  mat.customProgramCacheKey = () => (isMoon ? 'landing-moon-terrain-v1' : 'landing-mars-terrain-v1')
  return mat
}

function createRockMaterial(
  site: Landscape,
  sunVec: T.Vector3,
  screeUniform: { value: T.Texture | null },
  readyUniform: { value: number },
) {
  const isMoon = site.id === 'Moon'
  const mat = new T.MeshStandardMaterial({
    color: 0xffffff,
    roughness: isMoon ? 0.92 : 0.88,
    metalness: 0.0,
  })

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = { value: sunVec }
    shader.uniforms.uScreeTex = screeUniform
    shader.uniforms.uTexReady = readyUniform

    shader.vertexShader =
      `
      varying vec3 vRockWorldPos;
      varying vec3 vRockWorldNormal;
      varying float vRockLocalY;
      ` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 _rwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          _rwp = instanceMatrix * _rwp;
        #endif
        _rwp = modelMatrix * _rwp;
        vRockWorldPos = _rwp.xyz;
        vec3 _rn = objectNormal;
        #ifdef USE_INSTANCING
          _rn = mat3(instanceMatrix) * _rn;
        #endif
        vRockWorldNormal = normalize(mat3(modelMatrix) * _rn);
        vRockLocalY = position.y;
        `,
      )

    shader.fragmentShader =
      `
      uniform vec3 uSunDir;
      uniform sampler2D uScreeTex;
      uniform float uTexReady;
      varying vec3 vRockWorldPos;
      varying vec3 vRockWorldNormal;
      varying float vRockLocalY;
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          vec3 _rn = normalize(vRockWorldNormal);
          // Triplanar rock micro-grain sampling
          float _g = 0.55;
          if (uTexReady > 0.5) {
            vec3 _bw = abs(_rn);
            _bw /= (_bw.x + _bw.y + _bw.z + 1e-4);
            float _gx = texture2D(uScreeTex, vRockWorldPos.yz * 0.72).r;
            float _gy = texture2D(uScreeTex, vRockWorldPos.xz * 0.72).r;
            float _gz = texture2D(uScreeTex, vRockWorldPos.xy * 0.72).r;
            _g = _gx * _bw.x + _gy * _bw.y + _gz * _bw.z;
          }
          ${
            isMoon
              ? `
              // Lunar angular basalt & breccia boulders with subtle fine regolith dust skirt at base
              diffuseColor.rgb *= mix(0.68, 1.32, _g);
              float _dustSkirt = smoothstep(0.1, -0.45, vRockLocalY);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.355, 0.345), _dustSkirt * 0.45);
              `
              : `
              // Martian dark grey-brown basalt / mudstone slabs with rusty ochre windblown dust settling on upward faces!
              diffuseColor.rgb *= mix(0.66, 1.30, _g);
              float _topDust = smoothstep(0.42, 0.86, _rn.y);
              float _baseDust = smoothstep(0.0, -0.45, vRockLocalY);
              vec3 _marsDustCol = vec3(0.57, 0.32, 0.18);
              diffuseColor.rgb = mix(diffuseColor.rgb, _marsDustCol, clamp(_topDust * 0.52 + _baseDust * 0.48, 0.0, 0.72));
              `
          }
          `,
        )
        .replace(
          '#include <dithering_fragment>',
          `
          ${
            isMoon
              ? ''
              : `
              vec3 _rToF = vRockWorldPos - cameraPosition;
              float _rDist = length(_rToF);
              vec3 _rDir = _rToF / max(_rDist, 0.001);
              float _rFog = 1.0 - exp(-(_rDist / 1180.0));
              float _rSun = max(0.0, dot(_rDir, uSunDir));
              vec3 _rFogCol = mix(vec3(0.75, 0.49, 0.34), vec3(0.88, 0.72, 0.56), pow(_rSun, 3.0) * 0.65);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, _rFogCol, clamp(_rFog * 0.92, 0.0, 0.92));
              `
          }
          vec3 _rtc = gl_FragColor.rgb;
          gl_FragColor.rgb = (_rtc * (2.51 * _rtc + 0.03)) / (_rtc * (2.43 * _rtc + 0.59) + 0.14);
          #include <dithering_fragment>
          `,
        )
  }

  mat.customProgramCacheKey = () => (isMoon ? 'landing-moon-rock-v1' : 'landing-mars-rock-v1')
  return mat
}

export function createRealisticSurface(
  site: Landscape,
  terrain: Terrain,
  renderer: T.WebGLRenderer,
  requestDraw: () => void,
) {
  const isMoon = site.id === 'Moon'
  const sunDir = landingSunDirection(site)
  const sunVec = new T.Vector3(sunDir[0], sunDir[1], sunDir[2]).normalize()

  const prevShadowEnabled = renderer.shadowMap.enabled
  const prevShadowType = renderer.shadowMap.type
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFSoftShadowMap

  const scene = new T.Scene()
  const camera = new T.PerspectiveCamera(66, 1, 0.12, 5000)

  // Real-time directional sun light with crisp 2048x2048 texel-snapped shadow map
  const sunLight = new T.DirectionalLight(isMoon ? 0xfffef8 : 0xffe4c4, isMoon ? 3.55 : 3.05)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(2048, 2048)
  const shadowExtent = 74
  sunLight.shadow.camera.left = -shadowExtent
  sunLight.shadow.camera.right = shadowExtent
  sunLight.shadow.camera.top = shadowExtent
  sunLight.shadow.camera.bottom = -shadowExtent
  sunLight.shadow.camera.near = 10
  sunLight.shadow.camera.far = 420
  sunLight.shadow.bias = -0.00035
  sunLight.shadow.normalBias = 0.055
  sunLight.shadow.radius = isMoon ? 1.0 : 2.6
  scene.add(sunLight)
  scene.add(sunLight.target)

  // Moon: near-black vacuum bounce only; Mars: warm dusty sky dome + reddish ground bounce
  const hemiLight = isMoon
    ? new T.HemisphereLight(0x14161c, 0x2a2926, 0.11)
    : new T.HemisphereLight(0xd9956c, 0x693d26, 0.62)
  scene.add(hemiLight)

  // Physical GLSL sky dome (with real Earthrise on Moon / Mie blue-halo dust sky & Phobos on Mars)
  const sky = createRealisticSky(site, sunDir, requestDraw)
  scene.add(sky.group)

  // Shared detail textures (gravel & scree)
  const tileUniform: { value: T.Texture | null } = { value: null }
  const screeUniform: { value: T.Texture | null } = { value: null }
  const readyUniform = { value: 0 }
  const ownedTextures: T.Texture[] = []
  let disposed = false
  let loadedCount = 0

  function loadDetailTex(url: string, target: { value: T.Texture | null }) {
    const img = new Image()
    img.onload = () => {
      if (disposed) return
      const tex = new T.Texture(img)
      tex.wrapS = tex.wrapT = T.RepeatWrapping
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      tex.needsUpdate = true
      ownedTextures.push(tex)
      target.value = tex
      loadedCount++
      if (loadedCount >= 2) readyUniform.value = 1
      requestDraw()
    }
    img.src = url
    return img
  }
  const gravelImg = loadDetailTex(gravelUrl, tileUniform)
  const screeImg = loadDetailTex(screeUrl, screeUniform)

  // Pre-allocated reusable terrain buffers (zero GC churn when shifting patch!)
  const vertexCount = STRIDE * STRIDE
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const metas = new Float32Array(vertexCount * 4)
  const indices = new Uint32Array(DIVISIONS * DIVISIONS * 6)
  let ptr = 0
  for (let iz = 0; iz < DIVISIONS; iz++) {
    for (let ix = 0; ix < DIVISIONS; ix++) {
      const i = iz * STRIDE + ix
      indices[ptr++] = i
      indices[ptr++] = i + STRIDE
      indices[ptr++] = i + 1
      indices[ptr++] = i + 1
      indices[ptr++] = i + STRIDE
      indices[ptr++] = i + STRIDE + 1
    }
  }

  const terrainGeo = new T.BufferGeometry()
  const posAttr = new T.BufferAttribute(positions, 3)
  const normAttr = new T.BufferAttribute(normals, 3)
  const metaAttr = new T.BufferAttribute(metas, 4)
  terrainGeo.setAttribute('position', posAttr)
  terrainGeo.setAttribute('normal', normAttr)
  terrainGeo.setAttribute('aMeta', metaAttr)
  terrainGeo.setIndex(new T.BufferAttribute(indices, 1))

  const terrainMat = createTerrainMaterial(site, sunVec, tileUniform, screeUniform, readyUniform)
  const terrainMesh = new T.Mesh(terrainGeo, terrainMat)
  terrainMesh.frustumCulled = false
  terrainMesh.receiveShadow = true
  terrainMesh.castShadow = true
  terrainMesh.renderOrder = 0
  scene.add(terrainMesh)

  // Sculpted instanced rock meshes (4 distinct real-world geological prototypes per world)
  const rockProtos = isMoon
    ? [
        buildRockPrototype(site.seed + 11, 'lunar'),
        buildRockPrototype(site.seed + 29, 'lunar'),
        buildRockPrototype(site.seed + 47, 'lunar'),
        buildRockPrototype(site.seed + 73, 'lunar'),
      ]
    : [
        buildRockPrototype(site.seed + 13, 'marsSlab'),
        buildRockPrototype(site.seed + 31, 'marsSlab'),
        buildRockPrototype(site.seed + 53, 'marsVentifact'),
        buildRockPrototype(site.seed + 83, 'marsVentifact'),
      ]
  const rockMat = createRockMaterial(site, sunVec, screeUniform, readyUniform)
  const maxPerProto = 640
  const rockMeshes = rockProtos.map((proto) => {
    const im = new T.InstancedMesh(proto, rockMat, maxPerProto)
    im.count = 0
    im.frustumCulled = false
    im.castShadow = true
    im.receiveShadow = true
    im.instanceMatrix.setUsage(T.DynamicDrawUsage)
    scene.add(im)
    return im
  })

  const colliders: RockCollider[] = []
  const tmpMat = new T.Matrix4()
  const tmpPos = new T.Vector3()
  const tmpQuat = new T.Quaternion()
  const tmpScale = new T.Vector3()
  const tmpEuler = new T.Euler()
  const tmpCol = new T.Color()

  let patchCx = Infinity
  let patchCz = Infinity

  function rebuildTerrainPatch(cx: number, cz: number) {
    const sunRuns = [8, 26, 75, 190, 440]

    for (let iz = 0; iz < STRIDE; iz++) {
      const dz = OFFSETS[iz]
      const z = cz + dz
      for (let ix = 0; ix < STRIDE; ix++) {
        const dx = OFFSETS[ix]
        const x = cx + dx
        const idx = iz * STRIDE + ix
        const i3 = idx * 3
        const y = terrain.height(x, z)
        positions[i3] = x
        positions[i3 + 1] = y
        positions[i3 + 2] = z

        const meta = terrain.sampleMeta(x, z)
        const dist = Math.hypot(dx, dz)

        // Macro terrain sun-ray self-occlusion for distances outside the 74m live shadow map
        let occ = 0
        if (dist > 36 && dist < 1750) {
          for (let rIdx = 0; rIdx < sunRuns.length; rIdx++) {
            const run = sunRuns[rIdx]
            const blocker =
              terrain.height(x + run * sunDir[0], z + run * sunDir[2]) - y - run * sunDir[1]
            if (blocker > 0) {
              occ = Math.max(occ, clamp(blocker / (1.8 + run * 0.045), 0, 1))
            }
          }
        }
        const i4 = idx * 4
        metas[i4] = meta.exposure
        metas[i4 + 1] = clamp((1 - occ * (isMoon ? 0.92 : 0.72)) * meta.ao, isMoon ? 0.06 : 0.24, 1)
        metas[i4 + 2] = meta.sand
        metas[i4 + 3] = meta.rockCluster
      }
    }

    // Smooth central-difference vertex normals matching the exact non-uniform grid
    for (let iz = 0; iz < STRIDE; iz++) {
      const z0 = iz > 0 ? iz - 1 : iz
      const z1 = iz < DIVISIONS ? iz + 1 : iz
      for (let ix = 0; ix < STRIDE; ix++) {
        const x0 = ix > 0 ? ix - 1 : ix
        const x1 = ix < DIVISIONS ? ix + 1 : ix
        const l = (iz * STRIDE + x0) * 3
        const r = (iz * STRIDE + x1) * 3
        const b = (z0 * STRIDE + ix) * 3
        const f = (z1 * STRIDE + ix) * 3
        const nx = (positions[l + 1] - positions[r + 1]) / Math.max(1e-4, positions[r] - positions[l])
        const nz = (positions[b + 1] - positions[f + 1]) / Math.max(1e-4, positions[f + 2] - positions[b + 2])
        const inv = 1 / Math.hypot(nx, 1, nz)
        const i3 = (iz * STRIDE + ix) * 3
        normals[i3] = nx * inv
        normals[i3 + 1] = inv
        normals[i3 + 2] = nz * inv
      }
    }

    posAttr.needsUpdate = true
    normAttr.needsUpdate = true
    metaAttr.needsUpdate = true

    // Populate geologically clustered instanced rocks
    const counts = [0, 0, 0, 0]
    colliders.length = 0
    const baseGx = Math.floor(cx / ROCK_CELL)
    const baseGz = Math.floor(cz / ROCK_CELL)

    for (let gz = baseGz - ROCK_GRID_HALF; gz <= baseGz + ROCK_GRID_HALF; gz++) {
      for (let gx = baseGx - ROCK_GRID_HALF; gx <= baseGx + ROCK_GRID_HALF; gx++) {
        const rand = cellRand(gx, gz, site.seed ^ 0x9e3779b9)
        const rxCenter = (gx + 0.15 + rand() * 0.7) * ROCK_CELL
        const rzCenter = (gz + 0.15 + rand() * 0.7) * ROCK_CELL
        const dPlayer = Math.hypot(rxCenter - cx, rzCenter - cz)
        if (dPlayer > 86) continue

        const meta = terrain.sampleMeta(rxCenter, rzCenter)
        // Natural clustering: dense near crater rims / talus aprons, realistic scattered cobbles across flats
        const clusterProb = isMoon
          ? 0.34 + meta.rockCluster * 0.64
          : 0.48 + meta.rockCluster * 0.50
        if (rand() > clusterProb) continue

        // Spawn 1..4 rocks in high-cluster cells (main boulder + satellite cobbles & pebbles)
        const subCount =
          dPlayer < 55
            ? meta.rockCluster > 0.38
              ? 2 + Math.floor(rand() * 2.6)
              : 1 + Math.floor(rand() * 1.8)
            : 1
        for (let s = 0; s < subCount; s++) {
          const jx = s === 0 ? rxCenter : rxCenter + (rand() - 0.5) * 2.8
          const jz = s === 0 ? rzCenter : rzCenter + (rand() - 0.5) * 2.8
          // Keep spawn landing spot immediately clear
          if (jx * jx + jz * jz < 6.5) continue

          const protoIdx = Math.floor(rand() * 4)
          if (counts[protoIdx] >= maxPerProto) continue

          // Power-law size distribution (many small cobbles, occasional dramatic large boulders)
          const sizeRoll = rand()
          const scaleMul = s === 0 ? 1 : 0.48
          const baseRad =
            (0.11 + sizeRoll ** 3.6 * (isMoon ? 1.55 : 1.35) * (0.65 + 0.55 * meta.rockCluster)) *
            scaleMul
          const sx = baseRad * (0.8 + rand() * 0.48)
          const sy = baseRad * (0.72 + rand() * 0.42)
          const sz = baseRad * (0.8 + rand() * 0.48)

          const groundY = terrain.height(jx, jz)
          // Embed rocks deeply (32%..48%) into lunar regolith / Martian dust so they never float!
          const embed = sy * (0.34 + rand() * 0.18)
          tmpPos.set(jx, groundY + sy * 0.42 - embed, jz)
          tmpEuler.set(
            (rand() - 0.5) * (isMoon ? 0.55 : 0.28),
            rand() * tau,
            (rand() - 0.5) * (isMoon ? 0.55 : 0.28),
          )
          tmpQuat.setFromEuler(tmpEuler)
          tmpScale.set(sx, sy, sz)
          tmpMat.compose(tmpPos, tmpQuat, tmpScale)

          const instanceIdx = counts[protoIdx]++
          rockMeshes[protoIdx].setMatrixAt(instanceIdx, tmpMat)

          if (isMoon) {
            const v = 0.24 + rand() * 0.26 + meta.exposure * 0.1
            tmpCol.setRGB(v, v * 0.99, v * 0.97)
          } else {
            // Mix dark grey-blue basaltic cobbles & reddish-brown mudstone slabs
            const isBasalt = protoIdx >= 2 || rand() < 0.45
            if (isBasalt) {
              const v = 0.18 + rand() * 0.14
              tmpCol.setRGB(v * 1.12, v * 0.96, v * 0.90)
            } else {
              const v = 0.30 + rand() * 0.18
              tmpCol.setRGB(v * 1.38, v * 0.84, v * 0.56)
            }
          }
          rockMeshes[protoIdx].setColorAt(instanceIdx, tmpCol)

          if (sy > 0.38 && baseRad > 0.36) {
            colliders.push({ x: jx, z: jz, r: Math.max(sx, sz) * 0.95 + 0.22 })
          }
        }
      }
    }

    for (let p = 0; p < rockMeshes.length; p++) {
      const rm = rockMeshes[p]
      rm.count = counts[p]
      rm.instanceMatrix.needsUpdate = true
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true
    }
  }

  // Texel-snapped directional shadow camera positioning to eliminate shadow swimming during movement
  const shadowAxisX = new T.Vector3()
  const shadowAxisY = new T.Vector3()
  const shadowUp = new T.Vector3(0, 1, 0)
  shadowAxisX.crossVectors(shadowUp, sunVec).normalize()
  shadowAxisY.crossVectors(sunVec, shadowAxisX).normalize()
  const shadowTexelSize = (shadowExtent * 2) / 2048

  function updateSunShadow(px: number, py: number, pz: number) {
    const u = Math.round((px * shadowAxisX.x + py * shadowAxisX.y + pz * shadowAxisX.z) / shadowTexelSize) * shadowTexelSize
    const v = Math.round((px * shadowAxisY.x + py * shadowAxisY.y + pz * shadowAxisY.z) / shadowTexelSize) * shadowTexelSize
    const w = px * sunVec.x + py * sunVec.y + pz * sunVec.z
    const tx = shadowAxisX.x * u + shadowAxisY.x * v + sunVec.x * w
    const ty = shadowAxisX.y * u + shadowAxisY.y * v + sunVec.y * w
    const tz = shadowAxisX.z * u + shadowAxisY.z * v + sunVec.z * w
    sunLight.target.position.set(tx, ty, tz)
    sunLight.position.set(tx + sunVec.x * 185, ty + sunVec.y * 185, tz + sunVec.z * 185)
    sunLight.target.updateMatrixWorld()
  }

  function walkableAt(x: number, z: number): boolean {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i]
      const dx = x - c.x
      const dz = z - c.z
      if (dx * dx + dz * dz < c.r * c.r) return false
    }
    return true
  }

  function draw(pose: SurfacePose, width: number, height: number, time: number) {
    if (Math.abs(pose.x - patchCx) > 22 || Math.abs(pose.z - patchCz) > 22) {
      patchCx = Math.round(pose.x / 20) * 20
      patchCz = Math.round(pose.z / 20) * 20
      rebuildTerrainPatch(patchCx, patchCz)
    }
    if (camera.aspect !== width / height) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    camera.position.set(pose.x, pose.y, pose.z)
    camera.rotation.set(pose.pitch, -pose.heading, 0, 'YXZ')
    updateSunShadow(pose.x, pose.y, pose.z)
    sky.update(camera.position, time, renderer.getPixelRatio())
    renderer.render(scene, camera)
  }

  function dispose() {
    disposed = true
    gravelImg.onload = screeImg.onload = null
    terrainGeo.dispose()
    terrainMat.dispose()
    for (const p of rockProtos) p.dispose()
    for (const im of rockMeshes) im.dispose()
    rockMat.dispose()
    for (const tex of ownedTextures) tex.dispose()
    sky.dispose()
    scene.clear()
    // Restore renderer shadow settings so the main Solar System scene pays zero shadow overhead
    renderer.shadowMap.enabled = prevShadowEnabled
    renderer.shadowMap.type = prevShadowType
  }

  return { draw, dispose, walkableAt }
}
