import * as T from 'three'
import { v3, tau, clamp, seeded } from './math'
import { surfaceSources } from '../data/assets'
import {
  fieldVertex,
  fieldFragment,
  volumeVertex,
  volumeFragment,
  normalVertex,
  starFragment,
} from './shaders'
import { createAtmosphereMesh, type AtmosphereSpec } from './planetSurfaces'
import { galaxyProfile, buildSoftwareVolume } from './galaxyVolume'
import type {
  GalaxyForm,
  PlanetSystem,
  StarLook,
  Surface,
  DeepModel,
  DeepBody,
  LightSamples,
} from './deepTypes'
// Spatial density models. Coordinates describe morphology, not measured star positions.
export const galaxyForms: Record<string, GalaxyForm> = {
  m31: { seed: 31, pitch: 0.25, roll: -0.15, height: 0.32, bulge: 1.4, depth: 5.8, type: 0 },
  m33: { seed: 33, pitch: 0.67, roll: 0.1, height: 0.44, bulge: 0.55, depth: 5.8, type: 0 },
  m51: { seed: 51, pitch: 1.17, roll: -0.12, height: 0.33, bulge: 0.78, depth: 5.9, type: 1 },
  m104: { seed: 104, pitch: 0.14, roll: -0.095, height: 0.34, bulge: 2.8, depth: 5.75, type: 2 },
  m82: { seed: 82, pitch: 0.22, roll: 0.16, height: 0.56, bulge: 0.8, depth: 3.9, type: 3 },
  m87: { seed: 87, pitch: 0.52, roll: -0.06, height: 3.1, bulge: 0.8, depth: 4.0, type: 4 },
}
const starLooks: Record<string, StarLook> = {
  blue: { dark: [105, 144, 201], hot: [242, 246, 255], halo: '#a9cdff', map: 'photosphere' },
  white: { dark: [157, 180, 206], hot: [255, 251, 241], halo: '#d7e7ff', map: 'photosphere' },
  gold: { dark: [166, 76, 28], hot: [255, 232, 160], halo: '#ffb867', map: 'photosphere' },
  orange: { dark: [121, 40, 24], hot: [255, 189, 99], halo: '#ff9b53', map: 'photosphere' },
  red: { dark: [92, 21, 17], hot: [255, 151, 82], halo: '#ff7f4d', map: 'photosphere' },
  giant: { dark: [100, 26, 18], hot: [255, 189, 98], halo: '#ff9b53', map: 'giant-cells' },
}
export const planetarySystems: Record<string, PlanetSystem> = {
  'proxima-centauri-b': {
    host: '比邻星',
    star: 'red',
    days: 11.2,
    axis: 11,
    radius: 1.48,
    rim: '#dda98f',
  },
  'trappist-1-e': {
    host: 'TRAPPIST-1',
    star: 'red',
    days: 6.1,
    axis: 9.5,
    radius: 1.35,
    rim: '#b3cbce',
  },
  '51-pegasi-b': {
    host: '飞马座 51',
    star: 'gold',
    days: 4.2,
    axis: 10.8,
    radius: 2.38,
    rim: '#edbc9c',
  },
  '55-cancri-e': {
    host: '巨蟹座 55 A',
    star: 'orange',
    days: 0.736,
    axis: 8.9,
    radius: 1.62,
    rim: '#e58b58',
  },
  'kepler-452-b': {
    host: 'Kepler-452',
    star: 'gold',
    days: 384.8,
    axis: 16.3,
    radius: 1.73,
    rim: '#a7cbd5',
  },
  'hd-209458-b': {
    host: 'HD 209458',
    star: 'white',
    days: 3.5,
    axis: 11.3,
    radius: 2.5,
    rim: '#91c6df',
  },
}
export function createDeepModels(
  renderer: T.WebGLRenderer | null,
  sphere: T.SphereGeometry,
  tag: (name: string, cls?: string) => HTMLSpanElement,
  requestDraw: () => void,
  isActive: (model: DeepModel) => boolean,
) {
  let disposed = false
  const surfaceCache = new Map<string, Surface>()
  function createLightField(d: DeepModel, points: LightSamples, dust = 0) {
    const g = new T.BufferGeometry()
    for (const [key, values, size] of [
      ['position', points.pos, 3],
      ['tint', points.color, 3],
      ['diameter', points.diameter, 1],
      ['strength', points.alpha, 1],
    ] as const)
      g.setAttribute(key, new T.Float32BufferAttribute(values, size))
    const mat = new T.ShaderMaterial({
      vertexShader: fieldVertex,
      fragmentShader: fieldFragment,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: { focal: { value: 600 }, dust: { value: dust }, localEye: { value: v3() } },
    })
    const cloud = new T.Points(g, mat)
    d.root.add(cloud)
    d.fields.push(cloud)
    return cloud
  }
  function pointData(): LightSamples {
    return { pos: [], color: [], diameter: [], alpha: [] }
  }
  function addLight(
    data: LightSamples,
    x: number,
    y: number,
    z: number,
    c: number[],
    diameter: number,
    alpha: number,
  ) {
    data.pos.push(x, y, z)
    data.color.push(c[0] / 255, c[1] / 255, c[2] / 255)
    data.diameter.push(diameter)
    data.alpha.push(alpha)
  }
  function makeGalaxy(d: DeepModel) {
    const f = d.form!,
      s = Math.sin(f.pitch),
      c = Math.cos(f.pitch),
      map = getSurface('density-' + d.entry.id)
    const uniforms = {
      localEye: { value: v3() },
      skyMap: { value: map.texture },
      profile: { value: new T.Vector4(s, c, f.height, f.bulge) },
      kind: { value: f.type },
    }
    const material = new T.ShaderMaterial({
      vertexShader: volumeVertex,
      fragmentShader: volumeFragment,
      uniforms,
      side: T.BackSide,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
    })
    d.volume = new T.Mesh(new T.BoxGeometry(32.1, 26, 42), material)
    d.volume.frustumCulled = false
    d.root.add(d.volume)
    // The companion, wind and jet are coordinates within the illustrative model.
    if (f.type === 1)
      d.landmarks.push(['伴星系 NGC 5195', v3(11.7, 0.4, -3.2), tag('伴星系 NGC 5195')])
    if (f.type === 3) d.landmarks.push(['星暴外流', v3(-1.7, 4.8, 0.1), tag('星暴外流')])
    if (f.type === 4) d.landmarks.push(['中心喷流', v3(2.1, 0.46, 0.2), tag('中心喷流')])
    map.ready.then(() => {
      if (!isActive(d) || !map.pixels) return
      const { data, width: w, height: h } = map.pixels,
        count = w * h,
        cumulative = new Float64Array(count)
      let total = 0
      for (let i = 0; i < count; i++) {
        const maximum = Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) / 255
        total += -Math.log(Math.max(0.015, 1 - maximum))
        cumulative[i] = total
      }
      const rand = seeded(f.seed * 841),
        specks = pointData()
      for (let i = 0; i < 14000; i++) {
        const pick = rand() * total
        let lo = 0,
          hi = count - 1
        while (lo < hi) {
          const m = (lo + hi) >> 1
          if (cumulative[m] < pick) lo = m + 1
          else hi = m
        }
        const x = (((lo % w) + rand()) / w - 0.5) * 32,
          v = (0.5 - (Math.floor(lo / w) + rand()) / h) * 24
        const ell = galaxyProfile(f, x, v),
          gauss = Math.sqrt(-2 * Math.log(Math.max(0.000001, rand()))) * Math.cos(tau * rand())
        const l = ell.mean + gauss * ell.sigma,
          y = v * c + l * s,
          z = -v * s + l * c
        const index = 4 * lo,
          max = Math.max(1, data[index], data[index + 1], data[index + 2])
        const tint = [0, 1, 2].map((k) => (255 * data[index + k]) / max)
        const size = 0.025 + rand() * 0.074,
          opacity = 0.09 + rand() * 0.25
        const t = clamp((Math.hypot(x, z) - 12.6) / 3.8, 0, 1)
        addLight(specks, x, y, z, tint, size, opacity * (1 - t * t * (3 - 2 * t)))
      }
      if (!renderer) buildSoftwareVolume(d, map.pixels)
      createLightField(d, specks, f.type === 2 ? 0.65 : 0)
      requestDraw()
    })
  }
  const rgbVector = (c: number[]) => v3(c[0] / 255, c[1] / 255, c[2] / 255)
  const glowMaps = new Map<string, T.CanvasTexture>()
  function getSurface(key: string): Surface {
    const cached = surfaceCache.get(key)
    if (cached) return cached
    let done!: () => void
    const data: Surface = {
        texture: renderer ? new T.Texture() : null,
        pixels: null,
        ready: new Promise((resolve) => {
          done = resolve
        }),
      },
      image = new Image()

    surfaceCache.set(key, data)
    const density = key.startsWith('density-')
    if (data.texture) {
      data.texture.wrapS = density ? T.ClampToEdgeWrapping : T.RepeatWrapping
      if (!key.startsWith('density-') && !['photosphere', 'giant-cells'].includes(key))
        data.texture.colorSpace = T.SRGBColorSpace
      data.texture.anisotropy = Math.min(4, renderer!.capabilities.getMaxAnisotropy())
    }
    image.onload = () => {
      if (disposed) return
      if (data.texture) {
        data.texture.image = image
        data.texture.needsUpdate = true
      }
      if (!renderer || key.startsWith('density-')) {
        const c = document.createElement('canvas')
        c.width = key.startsWith('density-') ? 280 : 768
        c.height = key.startsWith('density-') ? 210 : 384
        const k = c.getContext('2d')!
        k.drawImage(image, 0, 0, c.width, c.height)
        data.pixels = k.getImageData(0, 0, c.width, c.height)
      }
      done()
      requestDraw()
    }
    image.src = surfaceSources[key]
    return data
  }
  function glowMap(color: string): T.CanvasTexture {
    if (glowMaps.has(color)) return glowMaps.get(color)!
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const k = c.getContext('2d')!,
      g = k.createRadialGradient(128, 128, 0, 128, 128, 128)
    for (const [r, alpha] of [
      [0, 'dc'],
      [0.14, 'b4'],
      [0.26, '6e'],
      [0.42, '30'],
      [0.62, '10'],
      [0.82, '04'],
      [1, '00'],
    ] as const)
      g.addColorStop(r, color + alpha)
    k.fillStyle = g
    k.fillRect(0, 0, 256, 256)
    const map = new T.CanvasTexture(c)
    map.colorSpace = T.SRGBColorSpace
    glowMaps.set(color, map)
    return map
  }
  function addSphere(
    d: DeepModel,
    key: string,
    name: string,
    radius: number,
    material: T.Material,
    surface: Surface,
    look: StarLook | null,
  ): DeepBody {
    const mesh = new T.Mesh(sphere, material)
    mesh.scale.setScalar(radius)
    d.root.add(mesh)
    const obj = {
      key,
      name,
      r: radius,
      mesh,
      pos: mesh.position,
      surface,
      look,
      tag: tag(name, key === 'main' ? 'hot' : ''),
    }
    d.bodies.push(obj)
    return obj
  }
  function addStar(d: DeepModel, key: string, name: string, r: number, style: string) {
    const look = starLooks[style],
      surface = getSurface(look.map)
    const mat = new T.ShaderMaterial({
      vertexShader: normalVertex,
      fragmentShader: starFragment,
      uniforms: {
        photo: { value: surface.texture },
        cold: { value: rgbVector(look.dark) },
        hot: { value: rgbVector(look.hot) },
      },
    })
    const body = addSphere(d, key, name, r, mat, surface, look)
    const glow = new T.Sprite(
      new T.SpriteMaterial({
        map: glowMap(look.halo),
        blending: T.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    glow.scale.setScalar(6.6)
    body.mesh.add(glow)
    return body
  }
  function addOrbit(d: DeepModel, axis: number) {
    const points = Array.from({ length: 240 }, (_, i) =>
      v3(Math.cos((tau * i) / 240) * axis, 0, Math.sin((tau * i) / 240) * axis),
    )
    const line = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(points),
      new T.LineBasicMaterial({
        color: 0xb6a990,
        transparent: true,
        opacity: 0.39,
        depthWrite: false,
      }),
    )
    d.root.add(line)
    d.orbits.push(line)
  }
  function makeFlares(body: DeepBody, seed: number) {
    const rand = seeded(seed)
    for (let f = 0; f < 9; f++) {
      const angle = tau * rand(),
        y = rand() * 1.6 - 0.8,
        radial = Math.sqrt(1 - y * y)
      const n = v3(radial * Math.cos(angle), y, radial * Math.sin(angle))
      const tangent = v3(-Math.sin(angle), 0, Math.cos(angle)),
        a = 0.06 + rand() * 0.13,
        h = 0.04 + rand() * 0.17
      for (let k = 0; k < 3; k++) {
        const points = []
        for (let i = 0; i <= 35; i++) {
          const s = i / 35,
            b = (s - 0.5) * 2 * a
          points.push(
            n
              .clone()
              .multiplyScalar(Math.cos(b))
              .addScaledVector(tangent, Math.sin(b))
              .multiplyScalar(1.002 + (h + k * 0.007) * Math.sin(Math.PI * s) ** 0.75),
          )
        }
        const line = new T.Line(
          new T.BufferGeometry().setFromPoints(points),
          new T.LineBasicMaterial({
            color: 0xffa363,
            transparent: true,
            opacity: 0.32 - k * 0.06,
            blending: T.AdditiveBlending,
            depthWrite: false,
          }),
        )
        body.mesh.add(line)
      }
    }
  }
  function makeStarSystem(d: DeepModel) {
    const key = d.entry.id
    const styles: Record<string, string> = {
      sirius: 'blue',
      betelgeuse: 'giant',
      vega: 'white',
      proxima: 'red',
    }
    const style = styles[key]
    const primary = addStar(
      d,
      'main',
      key === 'sirius' ? '天狼星 A' : d.entry.title,
      key === 'betelgeuse' ? 3.45 : 2.45,
      style,
    )
    if (key === 'betelgeuse') {
      const g = new T.SphereGeometry(1, 96, 64),
        v = g.attributes.position
      for (let i = 0; i < v.count; i++) {
        const x = v.getX(i),
          y = v.getY(i),
          z = v.getZ(i),
          r =
            1 +
            0.013 * Math.sin(4 * x + 2 * z) * Math.cos(4 * y - 2 * x) +
            0.009 * Math.sin(6 * z + 2 * y)
        v.setXYZ(i, x * r, y * r, z * r)
      }
      g.computeVertexNormals()
      primary.mesh.geometry = g
    }
    if (key === 'sirius') {
      addStar(d, 'companion', '天狼星 B', 0.54, 'white')
      addOrbit(d, 3.75)
      addOrbit(d, 8.4)
      d.view = 'system'
    } else if (key === 'vega') {
      primary.mesh.scale.y *= 0.84
      const dust = pointData(),
        rand = seeded(22857)
      for (let i = 0; i < 12400; i++) {
        const a = tau * rand(),
          r = 4.5 + 7.9 * Math.sqrt(rand())
        const fall = Math.sin((Math.PI * (r - 4.5)) / 7.9) ** 0.6
        addLight(
          dust,
          r * Math.cos(a),
          (rand() + rand() - 1) * (0.15 + 0.015 * r),
          r * Math.sin(a),
          [197, 180 + 28 * rand(), 170 + 30 * rand()],
          0.18 + 0.33 * rand(),
          (0.08 + 0.12 * rand()) * fall,
        )
      }
      createLightField(d, dust)
      d.landmarks.push(['尘埃盘', v3(-8.1, 0, 3.2), tag('尘埃盘')])
      d.view = 'system'
    } else if (key === 'proxima') makeFlares(primary, 822)
    else {
      const dust = pointData(),
        rand = seeded(472),
        phase = 0.48
      for (let i = 0; i < 1800; i++) {
        const t = rand(),
          a = phase + t * 0.9 + rand() * 0.45,
          r = 3.45 + t * 1.55
        addLight(
          dust,
          Math.cos(a) * r,
          (t * 0.7 + rand() * 0.38) * r,
          Math.sin(a) * r * 0.56,
          [246, 129, 73],
          0.1 + 0.55 * rand(),
          0.018 + 0.026 * (1 - t),
        )
      }
      createLightField(d, dust)
    }
  }
  const exoAtmoSpecs: Record<string, AtmosphereSpec> = {
    'proxima-centauri-b': {
      scale: 1.052,
      dayColor: 0xe69f84,
      sunsetColor: 0xff6e3a,
      falloff: 4.6,
      intensity: 0.72,
      sunsetStrength: 0.65,
    },
    'trappist-1-e': {
      scale: 1.055,
      dayColor: 0x86c8de,
      sunsetColor: 0xff8c52,
      falloff: 4.5,
      intensity: 0.78,
      sunsetStrength: 0.62,
    },
    '51-pegasi-b': {
      scale: 1.062,
      dayColor: 0xf2b788,
      sunsetColor: 0xff642c,
      falloff: 4.0,
      intensity: 0.76,
      sunsetStrength: 0.58,
    },
    '55-cancri-e': {
      scale: 1.048,
      dayColor: 0xf08546,
      sunsetColor: 0xff3b18,
      falloff: 4.8,
      intensity: 0.72,
      sunsetStrength: 0.75,
    },
    'kepler-452-b': {
      scale: 1.058,
      dayColor: 0x62b4f2,
      sunsetColor: 0xff8240,
      falloff: 4.4,
      intensity: 0.86,
      sunsetStrength: 0.72,
    },
    'hd-209458-b': {
      scale: 1.068,
      dayColor: 0x6cb8eb,
      sunsetColor: 0x9ed8ff,
      falloff: 3.8,
      intensity: 0.84,
      sunsetStrength: 0.35,
    },
  }
  let exoCloudTex: T.CanvasTexture | null = null
  function getExoCloudTexture() {
    if (exoCloudTex) return exoCloudTex
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 256
    const k = c.getContext('2d')!
    const img = k.createImageData(512, 256)
    const rand = seeded(99317)
    const waves = Array.from({ length: 14 }, () => ({
      fx: 1 + Math.floor(rand() * 5),
      fy: 1 + Math.floor(rand() * 4),
      p: rand() * tau,
      w: 0.25 + rand() * 0.75,
    }))
    for (let y = 0; y < 256; y++) {
      const lat = (y / 255 - 0.5) * Math.PI
      const cy = Math.cos(lat)
      const sy = Math.sin(lat)
      for (let x = 0; x < 512; x++) {
        const lon = (x / 512) * tau
        const nx = Math.cos(lon) * cy
        const nz = Math.sin(lon) * cy
        let v = 0
        for (const w of waves) {
          v +=
            w.w *
            Math.sin(w.fx * nx * 2.4 + w.fy * sy * 3.1 + w.fx * nz * 1.9 + w.p) *
            Math.cos(w.fy * nz * 2.7 - w.fx * sy * 2.2 + w.p * 0.7)
        }
        v = v / 6.5 + 0.16 * Math.sin(sy * 12 + lon * 2) + 0.1 * Math.cos(sy * 21 - lon * 3)
        const alpha = clamp((v - 0.12) * 1.65, 0, 1)
        const idx = (y * 512 + x) * 4
        const val = Math.round(alpha * alpha * 255)
        img.data[idx] = val
        img.data[idx + 1] = val
        img.data[idx + 2] = val
        img.data[idx + 3] = 255
      }
    }
    k.putImageData(img, 0, 0)
    exoCloudTex = new T.CanvasTexture(c)
    exoCloudTex.wrapS = T.RepeatWrapping
    exoCloudTex.colorSpace = T.NoColorSpace
    return exoCloudTex
  }
  function makePlanetSystem(d: DeepModel) {
    const id = d.entry.id
    const def = planetarySystems[id]
    const host = addStar(d, 'host', def.host, 2.45, def.star)
    d.scene.add(new T.AmbientLight(0xc7d4fa, 0.22), new T.PointLight(0xfff0d7, 2.9, 0, 0))
    const surface = getSurface(id),
      gas = ['51-pegasi-b', 'hd-209458-b'].includes(id),
      lava = id === '55-cancri-e',
      habitable = ['proxima-centauri-b', 'trappist-1-e', 'kepler-452-b'].includes(id)
    const mat = new T.MeshPhongMaterial({
      map: surface.texture,
      bumpMap: surface.texture,
      bumpScale: gas ? 0.008 : lava ? 0.058 : 0.044,
      shininess: gas ? 10 : habitable ? 34 : 8,
      specular: gas ? 0x161412 : habitable ? 0x3b4954 : 0x181412,
    })
    if (lava) {
      mat.emissive.set(0xffffff)
      mat.emissiveMap = getSurface('lava-emission').texture
      mat.emissiveIntensity = 1.48
    }
    const rimCol = new T.Color(def.rim)
    const sunsetCol = new T.Color(exoAtmoSpecs[id]?.sunsetColor ?? 0xff7b42)
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uExoRim: { value: rimCol },
        uExoSunset: { value: sunsetCol },
        uExoGas: { value: gas ? 1 : 0 },
        uExoHot: { value: id === '51-pegasi-b' ? 0.22 : id === 'hd-209458-b' ? 0.14 : lava ? 0.18 : 0 },
        uExoHabitable: { value: habitable ? 1 : 0 },
      })
      shader.fragmentShader =
        `
        uniform vec3 uExoRim;
        uniform vec3 uExoSunset;
        uniform float uExoGas;
        uniform float uExoHot;
        uniform float uExoHabitable;
      ` +
        shader.fragmentShader
          .replace(
            '#include <lights_fragment_end>',
            `
            #include <lights_fragment_end>
            reflectedLight.indirectDiffuse *= 0.24;
            #if NUM_POINT_LIGHTS > 0
              vec3 _eSun = normalize(pointLights[0].position + vViewPosition);
              vec3 _eView = normalize(vViewPosition);
              float _eDot = dot(nonPerturbedNormal, _eSun);
              float _eMu = max(0.0, dot(nonPerturbedNormal, _eView));
              if (uExoGas > 0.5) {
                float _wrap = smoothstep(-0.28, 0.36, _eDot) * (1.0 - smoothstep(0.0, 0.5, _eDot));
                reflectedLight.directDiffuse += diffuseColor.rgb * pointLights[0].color * (_wrap * 0.12);
                reflectedLight.directDiffuse *= mix(1.0, pow(max(0.06, _eMu * max(0.06, _eDot)), 0.24) * 1.14, 0.7);
              }
              if (uExoHabitable > 0.5) {
                reflectedLight.directSpecular *= (0.45 + 1.25 * pow(1.0 - _eMu, 3.0));
              }
            #endif
            `,
          )
          .replace(
            '#include <opaque_fragment>',
            `
            #if NUM_POINT_LIGHTS > 0
              float _eLimb = pow(1.0 - _eMu, uExoGas > 0.5 ? 2.6 : 3.0);
              outgoingLight += uExoRim * _eLimb * smoothstep(-0.24, 0.55, _eDot) * (uExoGas > 0.5 ? 0.52 : 0.48);
              float _eTw = exp(-pow((_eDot - 0.03) / 0.22, 2.0));
              outgoingLight += uExoSunset * _eTw * (0.22 + 0.78 * _eLimb) * 0.24;
              if (uExoHot > 0.001) {
                float _hotDay = pow(max(0.0, _eDot), 2.4);
                outgoingLight += vec3(1.0, 0.36, 0.1) * _hotDay * uExoHot;
              }
            #endif
            #include <opaque_fragment>
            `,
          )
    }
    mat.customProgramCacheKey = () => 'exoplanet-surface-v2'

    const planet = addSphere(d, 'main', d.entry.title, def.radius, mat, surface, null)
    const exoSphere = new T.SphereGeometry(1, 128, 84)
    planet.mesh.geometry = exoSphere
    if (gas) planet.mesh.scale.y *= 0.945

    if (habitable && renderer) {
      const cloudMat = new T.MeshLambertMaterial({
        color: id === 'proxima-centauri-b' ? 0xf7dfd0 : 0xf4f9ff,
        alphaMap: getExoCloudTexture(),
        transparent: true,
        opacity: id === 'kepler-452-b' ? 0.52 : 0.42,
        depthWrite: false,
      })
      const clouds = new T.Mesh(exoSphere, cloudMat)
      clouds.scale.setScalar(1.01)
      planet.mesh.add(clouds)
      planet.mesh.userData.clouds = clouds
    }

    const spec = exoAtmoSpecs[id]
    if (spec && renderer) {
      const rim = createAtmosphereMesh(spec, 1, 1, exoSphere, host.pos)
      planet.mesh.add(rim)
    }

    if (id === 'hd-209458-b') {
      const tailPivot = new T.Group()
      d.root.add(tailPivot)
      const tailData = pointData()
      const rand = seeded(209458)
      for (let i = 0; i < 1400; i++) {
        const u = rand() ** 0.75
        const dist = def.radius * (0.95 + u * 5.8)
        const spread = def.radius * (0.48 + u * 1.45)
        const a = rand() * tau
        const radOff = Math.sqrt(rand()) * spread
        const curveZ = -u * u * def.radius * 1.4
        addLight(
          tailData,
          dist,
          Math.sin(a) * radOff * 0.88,
          Math.cos(a) * radOff + curveZ,
          [135 + 55 * (1 - u), 192 + 45 * (1 - u), 255],
          0.14 + rand() * (0.28 + u * 0.45),
          (0.035 + rand() * 0.065) * (1 - u) ** 1.35,
        )
      }
      const tailCloud = createLightField(d, tailData)
      d.root.remove(tailCloud)
      tailPivot.add(tailCloud)
      planet.mesh.userData.tailPivot = tailPivot
    }

    addOrbit(d, def.axis)
  }
  function dispose() {
    disposed = true
    for (const surface of surfaceCache.values()) surface.texture?.dispose()
    for (const map of glowMaps.values()) map.dispose()
    exoCloudTex?.dispose()
    exoCloudTex = null
    surfaceCache.clear()
    glowMaps.clear()
  }
  return { makeGalaxy, makePlanetSystem, makeStarSystem, getSurface, glowMap, dispose }
}
