import * as T from 'three'
import {
  HELIOSPHERE_NOSE_LAT_DEG,
  HELIOSPHERE_NOSE_LON_DEG,
  VOYAGER_END_YEAR,
  VOYAGER_START_YEAR,
  createVoyagerEphemeris,
  milestoneShort,
  missionMilestones,
  missionStart,
  missionName,
  type VoyagerMilestone,
  type VoyagerSample,
} from '../data/voyager'
import type { Label, ScreenPoint, World, VoyagerId, VoyagerMode } from './types'
import { clamp, rad, tau, v3 } from './math'
import { pick, type Locale } from '../i18n'

const CURVE_SAMPLES = 460
const TUBE_RADIAL = 6
const PULSE_COUNT = 16

function buildVoyagerSpacecraft(): T.Group {
  const craft = new T.Group()

  // 1. High-Gain Parabolic Dish Antenna (3.7m diameter, boresight along +Z toward Earth)
  const dishPoints: T.Vector2[] = []
  for (let i = 0; i <= 18; i++) {
    const t = i / 18
    const r = 0.04 + t * 0.92
    const z = 0.06 + t * t * 0.28
    dishPoints.push(new T.Vector2(r, z))
  }
  const dishGeo = new T.LatheGeometry(dishPoints, 40)
  dishGeo.rotateX(Math.PI / 2)
  const dishMat = new T.MeshPhongMaterial({
    color: 0xeaf2fc,
    emissive: 0x263448,
    specular: 0x8fb8dc,
    shininess: 36,
    side: T.DoubleSide,
  })
  const dish = new T.Mesh(dishGeo, dishMat)
  craft.add(dish)

  // Rim collar around dish edge
  const rimGeo = new T.TorusGeometry(0.955, 0.024, 10, 44)
  const rimMat = new T.MeshPhongMaterial({
    color: 0xc8d8eb,
    emissive: 0x1c2c40,
    shininess: 48,
  })
  const rim = new T.Mesh(rimGeo, rimMat)
  rim.position.z = 0.34
  craft.add(rim)

  // Subreflector + 3 tripod feed struts
  const subGeo = new T.CylinderGeometry(0.11, 0.14, 0.055, 18)
  subGeo.rotateX(Math.PI / 2)
  const metalMat = new T.MeshPhongMaterial({
    color: 0xaabccc,
    emissive: 0x1a2634,
    specular: 0xd0e6ff,
    shininess: 60,
  })
  const sub = new T.Mesh(subGeo, metalMat)
  sub.position.z = 0.56
  craft.add(sub)

  const strutMat = new T.MeshPhongMaterial({ color: 0xcad9e8, emissive: 0x182534, shininess: 40 })
  for (let i = 0; i < 3; i++) {
    const a = (i * tau) / 3 + 0.3
    const p0 = v3(Math.cos(a) * 0.54, Math.sin(a) * 0.54, 0.17)
    const p1 = v3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.55)
    const dir = p1.clone().sub(p0)
    const len = dir.length()
    const strut = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, len, 6), strutMat)
    strut.position.copy(p0).addScaledVector(dir, 0.5)
    strut.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.normalize())
    craft.add(strut)
  }

  // 2. Decagonal Bus wrapped in gold Kapton foil + dark thermal louvers
  const goldMat = new T.MeshPhongMaterial({
    color: 0xe6af46,
    emissive: 0x3b2408,
    specular: 0xffe4a0,
    shininess: 72,
  })
  const darkBusMat = new T.MeshPhongMaterial({
    color: 0x263140,
    emissive: 0x0b121c,
    specular: 0x5c7592,
    shininess: 28,
  })
  const bus = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 0.34, 10), goldMat)
  bus.rotation.x = Math.PI / 2
  bus.position.z = -0.22
  craft.add(bus)

  const bayRing = new T.Mesh(new T.CylinderGeometry(0.48, 0.48, 0.14, 10), darkBusMat)
  bayRing.rotation.x = Math.PI / 2
  bayRing.position.z = -0.22
  craft.add(bayRing)

  // Voyager Golden Record mounted on the side of the bus
  const recordMat = new T.MeshPhongMaterial({
    color: 0xffd564,
    emissive: 0x5e3c09,
    specular: 0xfff4c2,
    shininess: 110,
  })
  const record = new T.Mesh(new T.CylinderGeometry(0.115, 0.115, 0.018, 24), recordMat)
  record.position.set(0, 0.47, -0.22)
  craft.add(record)

  // 3. RTG Nuclear Power Boom (3 finned dark canisters extending lower-left)
  const rtgDir = v3(-0.82, -0.46, -0.34).normalize()
  const rtgArm = new T.Mesh(new T.CylinderGeometry(0.022, 0.026, 1.35, 8), metalMat)
  rtgArm.position.copy(rtgDir).multiplyScalar(0.82).add(v3(0, 0, -0.22))
  rtgArm.quaternion.setFromUnitVectors(v3(0, 1, 0), rtgDir)
  craft.add(rtgArm)

  const rtgMat = new T.MeshPhongMaterial({
    color: 0x323b48,
    emissive: 0x2b1508,
    specular: 0x7b8ea3,
    shininess: 35,
  })
  const rtgGlowMat = new T.MeshBasicMaterial({ color: 0xffa652 })
  for (let k = 0; k < 3; k++) {
    const dist = 0.92 + k * 0.34
    const pod = new T.Mesh(new T.CylinderGeometry(0.088, 0.088, 0.26, 12), rtgMat)
    pod.position.copy(rtgDir).multiplyScalar(dist).add(v3(0, 0, -0.22))
    pod.quaternion.setFromUnitVectors(v3(0, 1, 0), rtgDir)
    craft.add(pod)
    const fin = new T.Mesh(new T.TorusGeometry(0.092, 0.012, 6, 16), rtgGlowMat)
    fin.position.copy(pod.position)
    fin.quaternion.setFromUnitVectors(v3(0, 0, 1), rtgDir)
    craft.add(fin)
  }

  // 4. Science Scan Platform Boom (extending upper-right)
  const sciDir = v3(0.88, 0.36, -0.18).normalize()
  const sciBoom = new T.Mesh(new T.CylinderGeometry(0.02, 0.024, 1.15, 8), metalMat)
  sciBoom.position.copy(sciDir).multiplyScalar(0.75).add(v3(0, 0, -0.22))
  sciBoom.quaternion.setFromUnitVectors(v3(0, 1, 0), sciDir)
  craft.add(sciBoom)

  const scanHead = new T.Mesh(new T.BoxGeometry(0.24, 0.2, 0.22), darkBusMat)
  scanHead.position.copy(sciDir).multiplyScalar(1.36).add(v3(0, 0, -0.22))
  craft.add(scanHead)

  const lensMat = new T.MeshPhongMaterial({
    color: 0x52d6ff,
    emissive: 0x1c7ea8,
    shininess: 95,
  })
  const lens = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.06, 16), lensMat)
  lens.rotation.x = Math.PI / 2
  lens.position.copy(scanHead.position).add(v3(0, 0, 0.12))
  craft.add(lens)

  // 5. 13-meter Magnetometer Truss Boom (long slender rod extending far outward)
  const magDir = v3(0.54, -0.78, -0.28).normalize()
  const magLen = 3.15
  const magBoom = new T.Mesh(new T.CylinderGeometry(0.014, 0.026, magLen, 6), metalMat)
  magBoom.position.copy(magDir).multiplyScalar(0.32 + magLen * 0.5).add(v3(0, 0, -0.22))
  magBoom.quaternion.setFromUnitVectors(v3(0, 1, 0), magDir)
  craft.add(magBoom)

  for (const frac of [0.58, 0.98]) {
    const sensor = new T.Mesh(new T.SphereGeometry(0.048, 12, 10), goldMat)
    sensor.position.copy(magDir).multiplyScalar(0.32 + magLen * frac).add(v3(0, 0, -0.22))
    craft.add(sensor)
  }

  // 6. Twin 10m Plasma Wave / PRA V-Antennas
  const whipDirs = [v3(-0.35, 0.86, -0.36).normalize(), v3(0.35, 0.86, -0.36).normalize()]
  for (const wDir of whipDirs) {
    const whip = new T.Mesh(new T.CylinderGeometry(0.008, 0.012, 2.25, 6), strutMat)
    whip.position.copy(wDir).multiplyScalar(1.18).add(v3(0, 0, -0.26))
    whip.quaternion.setFromUnitVectors(v3(0, 1, 0), wDir)
    craft.add(whip)
  }

  return craft
}

function createFresnelShellMaterial(
  colorHex: number,
  edgeOpacity: number,
  power: number,
  tailFade = false,
): T.ShaderMaterial {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: {
      uColor: { value: new T.Color(colorHex) },
      uOpacity: { value: edgeOpacity },
      uPower: { value: power },
      uTailFade: { value: tailFade ? 1 : 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vLocalDir;
      void main() {
        vLocalDir = normalize(position);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPower;
      uniform float uTailFade;
      uniform float uTime;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vLocalDir;
      void main() {
        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float fresnel = pow(1.0 - clamp(ndv, 0.0, 1.0), uPower);
        // Subtle holographic meridian shimmer
        float latBand = smoothstep(0.96, 1.0, abs(sin(vLocalDir.y * 18.85)));
        float tailMask = uTailFade > 0.5 ? smoothstep(-0.98, 0.25, vLocalDir.x) : 1.0;
        float noseBoost = uTailFade > 0.5 ? (0.72 + 0.52 * smoothstep(0.1, 0.95, vLocalDir.x)) : 1.0;
        float pulse = 0.92 + 0.08 * sin(uTime * 1.1 + vLocalDir.x * 4.0);
        float alpha = (fresnel * 0.92 + 0.025 + latBand * 0.05) * uOpacity * tailMask * noseBoost * pulse;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  })
}

function createCircleLine(
  radius: number,
  color: number,
  opacity: number,
  segments = 160,
  dashed = false,
): T.Line {
  const pts: T.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * tau
    pts.push(v3(Math.cos(a) * radius, 0, -Math.sin(a) * radius))
  }
  const geo = new T.BufferGeometry().setFromPoints(pts)
  const mat = dashed
    ? new T.LineDashedMaterial({
        color,
        transparent: true,
        opacity,
        dashSize: radius * 0.032,
        gapSize: radius * 0.022,
        depthWrite: false,
      })
    : new T.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      })
  const line = new T.Line(geo, mat)
  if (dashed) line.computeLineDistances()
  return line
}

function createBeaconSpriteTexture(): T.CanvasTexture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const mid = size / 2

  // Soft cyan/gold glow core
  const radGrad = g.createRadialGradient(mid, mid, 2, mid, mid, mid)
  radGrad.addColorStop(0, 'rgba(255, 250, 232, 1.0)')
  radGrad.addColorStop(0.16, 'rgba(128, 238, 255, 0.92)')
  radGrad.addColorStop(0.4, 'rgba(70, 217, 255, 0.28)')
  radGrad.addColorStop(0.75, 'rgba(70, 217, 255, 0.05)')
  radGrad.addColorStop(1, 'rgba(70, 217, 255, 0)')
  g.fillStyle = radGrad
  g.fillRect(0, 0, size, size)

  // Crisp holographic targeting ring
  g.strokeStyle = 'rgba(130, 240, 255, 0.78)'
  g.lineWidth = 2.4
  g.beginPath()
  g.arc(mid, mid, 36, 0, tau)
  g.stroke()

  // 4 micro crosshair ticks
  g.strokeStyle = 'rgba(255, 212, 132, 0.85)'
  g.lineWidth = 2.2
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    g.beginPath()
    g.moveTo(mid + Math.cos(a) * 41, mid + Math.sin(a) * 41)
    g.lineTo(mid + Math.cos(a) * 52, mid + Math.sin(a) * 52)
    g.stroke()
  }

  const tex = new T.CanvasTexture(c)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

const turnSouth = missionMilestones('v2').find(m => m.id === 'neptune')!.year
const colorsByMission = {
  v1: [[VOYAGER_START_YEAR, 0xffc66e], [1980.87, 0xff9d4a], [1992, 0x46d9ff],
    [2012.65, 0x78b4ff], [2022, 0x9e8cff], [VOYAGER_END_YEAR, 0x88f5ff]],
  v2: [[missionStart('v2'), 0xff926e], [turnSouth, 0xffc17e], [turnSouth + 2, 0x50edbc],
    [missionMilestones('v2').find(m => m.id === 'heliopause')!.year, 0x40d8ce], [VOYAGER_END_YEAR, 0xb59bff]],
}
function makePalette(id: VoyagerId) {
  return colorsByMission[id].map(([year, hex]) => ({ year, color: new T.Color(hex) }))
}

export interface VoyagerMilestoneNode {
  milestone: VoyagerMilestone
  pos: T.Vector3
  mesh: T.Mesh
  tag: HTMLSpanElement
}

export function createVoyagerModel(
  scene: T.Scene,
  webgl: boolean,
  planets: World[],
  mapOuterAU: (au: number) => number,
  tag: (name: string, cls?: string) => HTMLSpanElement,
  id: VoyagerId,
) {
  const ephemeris = createVoyagerEphemeris(planets, mapOuterAU, id)
  const milestones = missionMilestones(id)
  const start = missionStart(id)
  const palette = makePalette(id)
  function trajectoryColor(year: number, out: T.Color) {
    let i = 1
    while (i < palette.length - 1 && palette[i].year < year) i++
    const a = palette[i - 1], b = palette[i]
    return out.lerpColors(a.color, b.color, clamp((year - a.year) / (b.year - a.year), 0, 1))
  }
  const accent = id === 'v2' ? 0x67edc2 : 0x5fdcff

  const root = new T.Group()
  root.visible = false
  scene.add(root)

  // Subgroups for clean visibility control between Full Voyager Mode vs Subtle Solar Overlay
  const fullOnlyGroup = new T.Group()
  root.add(fullOnlyGroup)

  // Include every encounter exactly; early flight receives denser sampling.
  const years = Array.from({ length: CURVE_SAMPLES }, (_, i) =>
    start + (VOYAGER_END_YEAR - start) * (i / (CURVE_SAMPLES - 1)) ** 1.38)
  const sampleYears = [...new Set([...years, ...ephemeris.encounterYears, ...milestones.map(m => m.year)])].sort((a, b) => a - b)
  const samples = sampleYears.length
  const curvePts: T.Vector3[] = []
  const shadowPts: T.Vector3[] = []
  const colorArray = new Float32Array(samples * 3)
  const tmpColor = new T.Color()

  for (const [i, year] of sampleYears.entries()) {
    const s = ephemeris.sample(year, v3())
    curvePts.push(s.pos)
    shadowPts.push(v3(s.pos.x, 0, s.pos.z))
    trajectoryColor(year, tmpColor)
    colorArray[i * 3] = tmpColor.r
    colorArray[i * 3 + 1] = tmpColor.g
    colorArray[i * 3 + 2] = tmpColor.b
  }

  // Full reference trajectory (faint upcoming path)
  const refGeo = new T.BufferGeometry().setFromPoints(curvePts)
  const refMat = new T.LineDashedMaterial({
    color: id === 'v2' ? 0x84bfb0 : 0x62b4e6,
    transparent: true,
    opacity: 0.24,
    dashSize: 5.5,
    gapSize: 4.0,
    depthWrite: false,
  })
  const fullRefLine = new T.Line(refGeo, refMat)
  fullRefLine.computeLineDistances()
  fullOnlyGroup.add(fullRefLine)

  // Active traveled trajectory core line (with vertex gradient colors & live endpoint)
  const activePositions = new Float32Array((samples + 1) * 3)
  const activeColors = new Float32Array((samples + 1) * 3)
  for (let i = 0; i < samples; i++) {
    curvePts[i].toArray(activePositions, i * 3)
    activeColors[i * 3] = colorArray[i * 3]
    activeColors[i * 3 + 1] = colorArray[i * 3 + 1]
    activeColors[i * 3 + 2] = colorArray[i * 3 + 2]
  }
  const activePosAttr = new T.BufferAttribute(activePositions, 3)
  const activeColAttr = new T.BufferAttribute(activeColors, 3)
  const activeLineGeo = new T.BufferGeometry()
  activeLineGeo.setAttribute('position', activePosAttr)
  activeLineGeo.setAttribute('color', activeColAttr)
  const activeLineMat = new T.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  })
  const activeLine = new T.Line(activeLineGeo, activeLineMat)
  activeLine.frustumCulled = false
  root.add(activeLine)

  // Luminous 3D Tube halo along traveled path (WebGL only, O(1) drawRange slicing!)
  let activeTube: T.Mesh | null = null
  let activeTubeMat: T.MeshBasicMaterial | null = null
  if (webgl) {
    const spline = new T.CatmullRomCurve3(curvePts, false, 'centripetal', 0.25)
    // Tube rings must follow sample time, not TubeGeometry’s default equal arc lengths.
    spline.getUtoTmapping = (u: number) => u
    const tubeSegs = samples - 1
    const tubeGeo = new T.TubeGeometry(spline, tubeSegs, 0.25, TUBE_RADIAL, false)
    const vCount = tubeGeo.attributes.position.count
    const tubeColors = new Float32Array(vCount * 3)
    const ringVerts = TUBE_RADIAL + 1
    for (let seg = 0; seg <= tubeSegs; seg++) {
      const yr = sampleYears[Math.min(samples - 1, seg)]
      trajectoryColor(yr, tmpColor)
      for (let r = 0; r < ringVerts; r++) {
        const idx = (seg * ringVerts + r) * 3
        if (idx + 2 < tubeColors.length) {
          tubeColors[idx] = tmpColor.r
          tubeColors[idx + 1] = tmpColor.g
          tubeColors[idx + 2] = tmpColor.b
        }
      }
    }
    tubeGeo.setAttribute('color', new T.BufferAttribute(tubeColors, 3))
    activeTubeMat = new T.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.34,
      blending: T.AdditiveBlending,
      depthWrite: false,
    })
    activeTube = new T.Mesh(tubeGeo, activeTubeMat)
    activeTube.frustumCulled = false
    root.add(activeTube)
  }

  // Ecliptic plane shadow projection + vertical altitude drop-stem (makes +35° 3D climb pop!)
  const shadowGeo = new T.BufferGeometry().setFromPoints([...shadowPts, shadowPts[samples - 1]])
  const shadowMat = new T.LineDashedMaterial({
    color: accent,
    dashSize: 3, gapSize: 2,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  })
  const eclipticShadowLine = new T.Line(shadowGeo, shadowMat)
  eclipticShadowLine.computeLineDistances()
  const shadowPositions = shadowGeo.attributes.position
  const shadowDistances = shadowGeo.attributes.lineDistance
  const staticDistances = shadowDistances.array.slice()
  eclipticShadowLine.frustumCulled = false
  fullOnlyGroup.add(eclipticShadowLine)

  const stemPositions = new Float32Array(6)
  const stemGeo = new T.BufferGeometry()
  stemGeo.setAttribute('position', new T.BufferAttribute(stemPositions, 3))
  const stemMat = new T.LineDashedMaterial({
    color: accent,
    transparent: true,
    opacity: 0.48,
    dashSize: 4.0,
    gapSize: 3.0,
    depthWrite: false,
  })
  const altitudeStem = new T.Line(stemGeo, stemMat)
  const stemDistances = new T.Float32BufferAttribute([0, 0], 1)
  stemGeo.setAttribute('lineDistance', stemDistances)
  altitudeStem.frustumCulled = false
  fullOnlyGroup.add(altitudeStem)

  const footRing = createCircleLine(3.2, accent, 0.55, 36, false)
  fullOnlyGroup.add(footRing)

  // ── 3. Earth-to-Voyager Light-Speed Radio Communication Beam + Photon Pulses ──
  const radioPositions = new Float32Array(6)
  const radioGeo = new T.BufferGeometry()
  radioGeo.setAttribute('position', new T.BufferAttribute(radioPositions, 3))
  const radioMat = new T.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.34,
    blending: T.AdditiveBlending,
    depthWrite: false,
  })
  const radioBeam = new T.Line(radioGeo, radioMat)
  radioBeam.frustumCulled = false
  fullOnlyGroup.add(radioBeam)

  const pulsePositions = new Float32Array(PULSE_COUNT * 3)
  const pulseAlphas = new Float32Array(PULSE_COUNT)
  const pulseGeo = new T.BufferGeometry()
  pulseGeo.setAttribute('position', new T.BufferAttribute(pulsePositions, 3))
  pulseGeo.setAttribute('aAlpha', new T.BufferAttribute(pulseAlphas, 1))
  const pulseMat = webgl
    ? new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        uniforms: {
          uPixelRatio: { value: 1 },
          uColor: { value: new T.Color(accent) },
        },
        vertexShader: `
          attribute float aAlpha;
          uniform float uPixelRatio;
          varying float vAlpha;
          void main() {
            vAlpha = aAlpha;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPos;
            gl_PointSize = clamp(8.5 * uPixelRatio, 5.0, 16.0);
          }
        `,
        fragmentShader: `
          varying float vAlpha;
          uniform vec3 uColor;
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float r2 = dot(p, p);
            if (r2 > 1.0) discard;
            float core = exp(-4.2 * r2);
            gl_FragColor = vec4(uColor, core * vAlpha * 0.95);
          }
        `,
      })
    : new T.PointsMaterial({
        color: 0x7ceeff,
        size: 3.5,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
  const radioPulses = new T.Points(pulseGeo, pulseMat)
  radioPulses.frustumCulled = false
  fullOnlyGroup.add(radioPulses)

  // ── 4. Procedural 3D Voyager Spacecraft + Adaptive Holographic Locator Beacon ──
  const probeAnchor = new T.Group()
  root.add(probeAnchor)

  const spacecraft = buildVoyagerSpacecraft()
  probeAnchor.add(spacecraft)

  // Subtle fill light attached to probe so close-up spacecraft details gleam naturally
  const probeLight = new T.PointLight(0xd8eeff, 0.65, 22, 1.5)
  probeLight.position.set(2.5, 3.0, 3.2)
  probeAnchor.add(probeLight)

  const beaconTex = createBeaconSpriteTexture()
  const beaconMat = new T.SpriteMaterial({
    map: beaconTex,
    color: id === 'v2' ? 0x9dffba : 0xffffff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: false,
    blending: T.AdditiveBlending,
  })
  const beaconSprite = new T.Sprite(beaconMat)
  beaconSprite.renderOrder = 10
  probeAnchor.add(beaconSprite)

  // ── 5. Historical Milestone Beacons & Labels ──
  const milestoneGeo = new T.OctahedronGeometry(1.15, 0)
  const milestoneNodes: VoyagerMilestoneNode[] = milestones.map((m) => {
    const pos = ephemeris.sample(m.year, v3()).pos
    const isOneLD = m.id === 'oneLightDay'
    const mat = new T.MeshBasicMaterial({
      color: isOneLD ? 0xffd278 : trajectoryColor(m.year, tmpColor).getHex(),
      transparent: true,
      opacity: 0.9,
    })
    const mesh = new T.Mesh(milestoneGeo, mat)
    mesh.position.copy(pos)
    fullOnlyGroup.add(mesh)
    const labelEl = tag(milestoneShort(m, 'zh'), isOneLD ? 'star' : 'voyager-ms')
    return { milestone: m, pos, mesh, tag: labelEl }
  })

  const probeTag = tag(missionName(id), 'hot voyager-probe-tag ' + id)

  // Live state
  let currentSample: VoyagerSample = ephemeris.sample(VOYAGER_END_YEAR, v3())
  let modeActive = false
  let overlayActive = false
  const earthWorld = planets.find((p) => p.id === 'Earth')!
  const probePos = currentSample.pos.clone()

  let launched = true
  let lastEndpoint = samples
  function setYear(year: number) {
    launched = year >= start
    root.visible = launched && (modeActive || overlayActive)
    if (lastEndpoint < samples) {
      curvePts[lastEndpoint].toArray(activePositions, lastEndpoint * 3)
      const shadow = shadowPts[lastEndpoint]
      shadowPositions.setXYZ(lastEndpoint, shadow.x, 0, shadow.z)
      shadowDistances.setX(lastEndpoint, staticDistances[lastEndpoint])
      activeColors.set(colorArray.subarray(lastEndpoint * 3, lastEndpoint * 3 + 3), lastEndpoint * 3)
    }
    currentSample = ephemeris.sample(year, probePos)
    probeAnchor.position.copy(probePos)

    // Find active segment count for O(1) drawRange slicing
    let count = 1
    while (count < samples && sampleYears[count] <= currentSample.year) count++
    const drawPts = Math.min(samples, count)
    lastEndpoint = drawPts
    // Place live endpoint right after the last passed sample
    activePositions[drawPts * 3] = probePos.x
    activePositions[drawPts * 3 + 1] = probePos.y
    activePositions[drawPts * 3 + 2] = probePos.z
    trajectoryColor(currentSample.year, tmpColor)
    activeColors[drawPts * 3] = tmpColor.r
    activeColors[drawPts * 3 + 1] = tmpColor.g
    activeColors[drawPts * 3 + 2] = tmpColor.b
    activePosAttr.needsUpdate = true
    activeColAttr.needsUpdate = true
    activeLineGeo.setDrawRange(0, drawPts + 1)

    if (activeTube) {
      const segs = Math.max(0, drawPts - 1)
      activeTube.geometry.setDrawRange(0, segs * TUBE_RADIAL * 6)
    }

    // Update ecliptic shadow draw range & vertical drop-stem
    const previous = shadowPts[drawPts - 1]
    shadowPositions.setXYZ(drawPts, probePos.x, 0, probePos.z)
    shadowDistances.setX(drawPts, staticDistances[drawPts - 1] + Math.hypot(probePos.x - previous.x, probePos.z - previous.z))
    shadowPositions.needsUpdate = shadowDistances.needsUpdate = true
    shadowGeo.setDrawRange(0, drawPts + 1)
    stemPositions[0] = probePos.x
    stemPositions[1] = probePos.y
    stemPositions[2] = probePos.z
    stemPositions[3] = probePos.x
    stemPositions[4] = 0
    stemPositions[5] = probePos.z
    stemGeo.attributes.position.needsUpdate = true
    stemDistances.setX(1, Math.abs(probePos.y))
    stemDistances.needsUpdate = true
    const hasElevation = Math.abs(probePos.y) > 2.2
    altitudeStem.visible = hasElevation
    footRing.visible = hasElevation
    footRing.position.set(probePos.x, 0, probePos.z)

    // Dim future milestones, brighten reached ones
    for (const node of milestoneNodes) {
      const reached = currentSample.year >= node.milestone.year - 0.05
      const mat = node.mesh.material as T.MeshBasicMaterial
      mat.opacity = reached ? 0.95 : 0.3
      node.mesh.scale.setScalar(reached ? 1.0 : 0.65)
    }
  }

  function setVisibility(voyagerMode: boolean, solarOverlay: boolean, galaxyOrDeep: boolean) {
    modeActive = voyagerMode && !galaxyOrDeep
    overlayActive = !voyagerMode && solarOverlay && !galaxyOrDeep
    root.visible = launched && (modeActive || overlayActive)
    fullOnlyGroup.visible = modeActive

    if (overlayActive) {
      // Subtle, tasteful trajectory & current 1 light-day position in normal Solar System mode
      setYear(VOYAGER_END_YEAR)
      activeLineMat.opacity = 0.42
      if (activeTubeMat) activeTubeMat.opacity = 0.14
    } else if (modeActive) {
      activeLineMat.opacity = 0.96
      if (activeTubeMat) activeTubeMat.opacity = 0.34
    }
  }

  function update(camera: T.PerspectiveCamera, ambientTime: number, pixelRatio: number) {
    if (!root.visible) return

    // Always point the High-Gain Dish Antenna back toward Earth!
    spacecraft.lookAt(earthWorld.pos)

    // Distance-adaptive scaling: close-up shows true 3D model, far-away shows glowing holographic beacon
    const camDist = camera.position.distanceTo(probePos)
    const beaconFade = clamp((camDist - 22) / 55, 0, 1)
    beaconSprite.visible = beaconFade > 0.01
    const pulse = 1 + 0.09 * Math.sin(ambientTime * 3.2)
    const beaconWorldSize = Math.max(3.2, camDist * (overlayActive ? 0.032 : 0.042)) * pulse
    beaconSprite.scale.setScalar(beaconWorldSize)
    beaconMat.opacity = beaconFade * (overlayActive ? 0.65 : 0.92)

    // Keep spacecraft clean at 1.0x up close; slightly boost mid-range visibility before beacon takes over
    const craftScale = camDist < 18 ? 1.0 : clamp(1.0 + (camDist - 18) * 0.014, 1.0, 2.6)
    spacecraft.scale.setScalar(craftScale)
    activeLine.visible = camDist > 15
    fullRefLine.visible = camDist > 18
    altitudeStem.visible = camDist > 18 && Math.abs(probePos.y) > 2.2

    // Soften tube halo in tight spacecraft close-up so the 3D craft silhouette stays razor-clean
    if (activeTube && activeTubeMat) {
      activeTube.visible = camDist > 18
      activeTubeMat.opacity = overlayActive
        ? 0.14
        : clamp((camDist - 8) / 28, 0.05, 0.34)
    }

    // Gently spin milestone diamonds, and hide any marker overlapping the spacecraft in close-up
    if (modeActive) {
      for (const node of milestoneNodes) {
        node.mesh.rotation.y = ambientTime * 0.9
        const d = camera.position.distanceTo(node.pos)
        const nearProbe = node.pos.distanceTo(probePos) < 6 && camDist < 55
        node.mesh.visible = !nearProbe && d > 20
        const s = clamp(d * 0.0044, 0.55, 2.4)
        const reached = currentSample.year >= node.milestone.year - 0.05
        node.mesh.scale.setScalar(s * (reached ? 1.0 : 0.65))
      }

      // Update Earth -> Voyager light-speed radio beam & traveling photon pulses
      radioPositions[0] = earthWorld.pos.x
      radioPositions[1] = earthWorld.pos.y
      radioPositions[2] = earthWorld.pos.z
      radioPositions[3] = probePos.x
      radioPositions[4] = probePos.y
      radioPositions[5] = probePos.z
      radioGeo.attributes.position.needsUpdate = true

      const beamDist = earthWorld.pos.distanceTo(probePos)
      const showBeam = beamDist > 5 && camDist > 14
      radioBeam.visible = showBeam
      radioPulses.visible = showBeam
      if (showBeam) {
        if (pulseMat instanceof T.ShaderMaterial) {
          pulseMat.uniforms.uPixelRatio.value = pixelRatio
        }
        // Use a common compressed communication clock (4 light-hours per second).
        const flowRate = 4 / Math.max(0.8, currentSample.lightHours)
        for (let i = 0; i < PULSE_COUNT; i++) {
          const t = ((i / PULSE_COUNT + ambientTime * flowRate) % 1 + 1) % 1
          pulsePositions[i * 3] = earthWorld.pos.x + (probePos.x - earthWorld.pos.x) * t
          pulsePositions[i * 3 + 1] = earthWorld.pos.y + (probePos.y - earthWorld.pos.y) * t
          pulsePositions[i * 3 + 2] = earthWorld.pos.z + (probePos.z - earthWorld.pos.z) * t
          pulseAlphas[i] = Math.sin(t * Math.PI)
        }
        pulseGeo.attributes.position.needsUpdate = true
        pulseGeo.attributes.aAlpha.needsUpdate = true
      }

    }
  }

  function collectLabels(
    project: (pos: T.Vector3) => ScreenPoint | null,
    width: number,
    height: number,
    markers: Label[],
    activeMilestoneId: string,
    lang: Locale,
    hideProbeLabel = false,
    emphasizeEncounters = false,
  ) {
    if (!root.visible) return

    // Probe label (hidden during tight close-up spacecraft inspection so it never clutters the dish)
    const pq = project(probePos)
    if (!hideProbeLabel && pq && pq.x > 10 && pq.x < width - 10 && pq.y > 10 && pq.y < height - 10) {
      const labelText = overlayActive && id === 'v1'
        ? pick('旅行者 1 号 · 1 光日', 'Voyager 1 · 1 Light-Day', lang) : missionName(id, lang)
      if (probeTag.textContent !== labelText) probeTag.textContent = labelText
      markers.unshift({ el: probeTag, q: pq, r: overlayActive ? 8 : 11 })
    }

    if (!modeActive) return

    // Milestone labels (prioritize active milestone & 1 Light-Day)
    for (const node of milestoneNodes) {
      const q = project(node.pos)
      if (!q || q.x < 10 || q.x > width - 10 || q.y < 10 || q.y > height - 10) continue
      // Don't double-label right on top of the probe itself
      if ((hideProbeLabel && node.pos.distanceTo(probePos) < 6) || (pq && Math.hypot(q.x - pq.x, q.y - pq.y) < 26)) continue
      const isActive = node.milestone.id === activeMilestoneId
      node.tag.classList.toggle('is-active', isActive)
      const marker = { el: node.tag, q, r: 6 }
      if (emphasizeEncounters && node.milestone.focusPlanetId) markers.unshift(marker)
      else markers.push(marker)
    }

  }

  function pickAt(
    x: number,
    y: number,
    project: (pos: T.Vector3) => ScreenPoint | null,
  ): { kind: 'probe'; id: VoyagerId } | { kind: 'milestone'; id: VoyagerId; milestone: VoyagerMilestone } | null {
    if (!root.visible) return null
    const pq = project(probePos)
    if (pq && Math.hypot(x - pq.x, y - pq.y) < 18) {
      return { kind: 'probe', id }
    }
    if (modeActive) {
      for (const node of milestoneNodes) {
        const q = project(node.pos)
        if (q && Math.hypot(x - q.x, y - q.y) < 15) {
          return { kind: 'milestone', id, milestone: node.milestone }
        }
      }
    }
    return null
  }

  function draw2D(ctx: CanvasRenderingContext2D, project: Project) {
    if (!root.visible) return
    ctx.save()

    if (modeActive && fullRefLine.visible) {
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.strokeStyle = id === 'v2' ? '#84bfb052' : '#62b4e652'
      ctx.beginPath()
      let started = false
      for (const point of curvePts) {
        const q = project(point)
        if (q && started) ctx.lineTo(q.x, q.y)
        else if (q) ctx.moveTo(q.x, q.y)
        started = !!q
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
    const drawCount = activeLineGeo.drawRange.count
    ctx.lineWidth = modeActive ? 2.2 : 1.3
    ctx.globalAlpha = modeActive ? 0.94 : 0.42
    const point = v3()
    let prev: ScreenPoint | null = null
    for (let i = 0; activeLine.visible && i < drawCount; i++) {
      const q = project(point.fromArray(activePositions, i * 3))
      if (prev && q) {
        ctx.strokeStyle = tmpColor.fromArray(activeColors, i * 3).getStyle()
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(q.x, q.y)
        ctx.stroke()
      }
      prev = q
    }
    ctx.globalAlpha = 1
    if (modeActive && activeLine.visible) {
      ctx.setLineDash([4, 3])
      ctx.lineWidth = 1
      ctx.strokeStyle = id === 'v2' ? '#67edc266' : '#5fdcff66'
      let started = false
      ctx.beginPath()
      for (let i = 0; i < drawCount; i++) {
        point.fromArray(activePositions, i * 3).y = 0
        const q = project(point)
        if (q && started) ctx.lineTo(q.x, q.y)
        else if (q) ctx.moveTo(q.x, q.y)
        started = !!q
      }
      const tip = project(probePos)
      if (started && tip) ctx.lineTo(tip.x, tip.y)
      ctx.stroke()
      // Draw Earth -> Voyager radio beam
      const eq = project(earthWorld.pos)
      const pq = project(probePos)
      if (radioBeam.visible && eq && pq) {
        ctx.strokeStyle = id === 'v2' ? '#67edc257' : '#5fdcff57'
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(eq.x, eq.y)
        ctx.lineTo(pq.x, pq.y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = id === 'v2' ? '#9bffdf' : '#b9f9ff'
        for (let i = 0; i < PULSE_COUNT && radioPulses.visible; i++) {
          const pulse = project(point.fromArray(pulsePositions, i * 3))
          if (pulse) ctx.fillRect(pulse.x, pulse.y, 2, 2)
        }
      }
    }

    if (modeActive) {
      for (const node of milestoneNodes) {
        if (!node.mesh.visible) continue
        const q = project(node.pos)
        if (!q) continue
        const mat = node.mesh.material as T.MeshBasicMaterial
        ctx.globalAlpha = mat.opacity
        ctx.fillStyle = mat.color.getStyle()
        ctx.beginPath()
        ctx.moveTo(q.x, q.y - 3)
        ctx.lineTo(q.x + 3, q.y)
        ctx.lineTo(q.x, q.y + 3)
        ctx.lineTo(q.x - 3, q.y)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  function drawProbe2D(ctx: CanvasRenderingContext2D, project: Project, q: ScreenPoint) {
    ctx.save()
    if (modeActive && q.z < 30) drawCanvasSpacecraft(ctx, project, spacecraft)
    else {
      ctx.fillStyle = id === 'v2' ? '#98ffcc' : '#8ef4ff'
      ctx.beginPath()
      ctx.arc(q.x, q.y, modeActive ? 4.5 : 3.2, 0, tau)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 206, 118, 0.85)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(q.x, q.y, modeActive ? 9 : 6.5, 0, tau)
      ctx.stroke()
    }
    ctx.restore()
  }

  function refreshLabels(lang: Locale) {
    probeTag.textContent = missionName(id, lang)
    for (const node of milestoneNodes) {
      node.tag.textContent = milestoneShort(node.milestone, lang)
    }
  }

  function dispose() {
    beaconTex.dispose()
    probeTag.remove()
    for (const n of milestoneNodes) n.tag.remove()
  }

  // Initialize the solar overlay at the common end epoch.
  setYear(VOYAGER_END_YEAR)

  return {
    root,
    ephemeris,
    probePos,
    milestoneNodes,
    getSample: () => currentSample,
    setYear,
    setVisibility,
    update,
    collectLabels,
    pickAt,
    draw2D,
    drawProbe2D,
    refreshLabels,
    dispose,
    id,
  }
}

type Project = (pos: T.Vector3) => ScreenPoint | null

// In the software renderer the close-up uses the same dish orientation and boom geometry.
function drawCanvasSpacecraft(ctx: CanvasRenderingContext2D, project: Project, craft: T.Group) {
  const faces: { pts: ScreenPoint[]; depth: number; color: string }[] = []
  const point = v3()
  const color = new T.Color()
  for (const mesh of craft.children) {
    if (!(mesh instanceof T.Mesh)) continue
    const vertices = mesh.geometry.attributes.position
    const screen = Array.from({ length: vertices.count }, (_, i) =>
      project(point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld)))
    const indices = mesh.geometry.index
    const count = indices?.count ?? vertices.count
    for (let i = 0; i < count; i += 3) {
      const a = screen[indices ? indices.getX(i) : i]
      const b = screen[indices ? indices.getX(i + 1) : i + 1]
      const c = screen[indices ? indices.getX(i + 2) : i + 2]
      if (!a || !b || !c) continue
      const shade = 0.65 + 0.35 * Math.abs((b.x - a.x) / (Math.hypot(b.x - a.x, b.y - a.y) || 1))
      faces.push({ pts: [a, b, c], depth: a.z + b.z + c.z,
        color: color.copy(mesh.material.color).multiplyScalar(shade).getStyle() })
    }
  }
  faces.sort((a, b) => b.depth - a.depth)
  ctx.lineWidth = 0.5
  ctx.setLineDash([])
  for (const { pts: [a, b, c], color } of faces) {
    ctx.fillStyle = ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

export function createVoyagerBoundaries(
  scene: T.Scene, webgl: boolean, tracks: Record<VoyagerId, ReturnType<typeof createVoyagerModel>>,
  tag: (name: string, cls?: string) => HTMLSpanElement,
) {
  const root = new T.Group()
  scene.add(root)
  const mapper = tracks.v1.ephemeris.mapper
  const noseLon = HELIOSPHERE_NOSE_LON_DEG * rad, noseLat = HELIOSPHERE_NOSE_LAT_DEG * rad
  const nose = v3(Math.cos(noseLat) * Math.cos(noseLon), Math.sin(noseLat), -Math.cos(noseLat) * Math.sin(noseLon))
  const rotation = new T.Quaternion().setFromUnitVectors(v3(1, 0, 0), nose)
  const times: { value: number }[] = []
  const rings: T.Line[] = []
  const shells: { radius: (direction: T.Vector3) => number; color: string }[] = []
  const landmarks: { pos: T.Vector3; label: HTMLSpanElement; kind: string }[] = []
  for (const kind of ['terminationShock', 'heliopause']) {
    const crossing = (id: VoyagerId) => tracks[id].milestoneNodes.find(n => n.milestone.id === kind)!.pos
    const north = crossing('v1'), south = crossing('v2')
    const northR = north.length(), southR = south.length()
    const isShock = kind === 'terminationShock'
    const color = isShock ? 0x3ec8e8 : 0x63a6ff
    // Interpolate the measured crossing radii by latitude. Stretch only the downwind tail.
    const radius = (dir: T.Vector3) => {
      const t = clamp((dir.y - south.y / southR) / (north.y / northR - south.y / southR), 0, 1)
      return (southR + (northR - southR) * t) * (1 + (isShock ? 0.14 : 0.32) * Math.max(0, -dir.dot(nose)) ** 2)
    }
    shells.push({ radius, color: new T.Color(color).getStyle() })
    if (webgl) {
      const geo = new T.SphereGeometry(1, 64, 40)
      const attr = geo.attributes.position
      const local = v3(), world = v3()
      for (let i = 0; i < attr.count; i++) {
        local.fromBufferAttribute(attr, i)
        local.multiplyScalar(radius(world.copy(local).applyQuaternion(rotation)))
        attr.setXYZ(i, local.x, local.y, local.z)
      }
      geo.computeVertexNormals()
      const mat = createFresnelShellMaterial(color, isShock ? 0.16 : 0.28, isShock ? 3 : 2.5, !isShock)
      times.push(mat.uniforms.uTime)
      const mesh = new T.Mesh(geo, mat)
      mesh.quaternion.copy(rotation)
      mesh.renderOrder = 2
      root.add(mesh)
    }
    const ring = createCircleLine(1, color, isShock ? 0.22 : 0.34, 180, isShock)
    const attr = ring.geometry.attributes.position
    const dir = v3()
    for (let i = 0; i < attr.count; i++) {
      dir.fromBufferAttribute(attr, i)
      dir.multiplyScalar(radius(dir))
      attr.setXYZ(i, dir.x, dir.y, dir.z)
    }
    if (ring.material instanceof T.LineDashedMaterial) {
      ring.material.dashSize = 6
      ring.material.gapSize = 4
      ring.computeLineDistances()
    }
    root.add(ring)
    rings.push(ring)
    landmarks.push({ pos: v3().fromBufferAttribute(attr, isShock ? 153 : 106), label: tag('', 'voyager-bound'), kind })
  }
  // 1 Light-Day Reference Sphere & Meridian Arc (~173.14 AU)
  const oneLDR = mapper.oneLightDayR
  const oneLDGroup = new T.Group()
  root.add(oneLDGroup)

  const oneLDEquator = createCircleLine(oneLDR, 0xffc86b, 0.34, 200, true)
  oneLDGroup.add(oneLDEquator)

  // Meridian arc through Voyager 1's escape azimuth (λ = 255.1°) highlighting the +35° elevation
  const escapeLon = 255.1 * rad
  const merPts: T.Vector3[] = []
  for (let i = 0; i <= 96; i++) {
    const lat = (-45 + (i / 96) * 115) * rad
    merPts.push(
      v3(
        oneLDR * Math.cos(lat) * Math.cos(escapeLon),
        oneLDR * Math.sin(lat),
        -oneLDR * Math.cos(lat) * Math.sin(escapeLon),
      ),
    )
  }
  const merLine = new T.Line(
    new T.BufferGeometry().setFromPoints(merPts),
    new T.LineBasicMaterial({ color: 0xffc86b, transparent: true, opacity: 0.36, depthWrite: false }),
  )
  oneLDGroup.add(merLine)

  // Highlighted +35° climb elevation arc from ecliptic (0°) to Voyager 1's latitude (+34.94°) at 1 Light-Day
  const elevPts: T.Vector3[] = []
  for (let i = 0; i <= 40; i++) {
    const lat = (i / 40) * 34.94 * rad
    elevPts.push(
      v3(
        oneLDR * Math.cos(lat) * Math.cos(escapeLon),
        oneLDR * Math.sin(lat),
        -oneLDR * Math.cos(lat) * Math.sin(escapeLon),
      ),
    )
  }
  const elevArc = new T.Line(
    new T.BufferGeometry().setFromPoints(elevPts),
    new T.LineBasicMaterial({ color: 0x7df0ff, transparent: true, opacity: 0.72, depthWrite: false }),
  )
  oneLDGroup.add(elevArc)

  // Target halo ring right at the 1 Light-Day milestone point
  const oneLDPos = tracks.v1.ephemeris.sample(VOYAGER_END_YEAR).pos
  const oneLDRing = createCircleLine(7.5, 0xffcf74, 0.75, 48, false)
  oneLDRing.position.copy(oneLDPos)
  oneLDRing.lookAt(0, 0, 0)
  oneLDGroup.add(oneLDRing)

  const ldLabel = tag('', 'star voyager-bound')
  const ldLandmark = v3(Math.cos(288 * rad) * oneLDR, 0, -Math.sin(288 * rad) * oneLDR)
  root.visible = false
  function refreshLabels(lang: Locale) {
    for (const { label, kind } of landmarks) label.textContent = kind === 'heliopause'
      ? pick('日球层顶', 'Heliopause', lang) : pick('终端激波', 'Termination Shock', lang)
    ldLabel.textContent = pick('1 光日 · 24 光时', '1 Light-Day · 24h', lang)
  }
  return {
    refreshLabels,
    setVisibility(visible: boolean, mode: VoyagerMode) {
      root.visible = visible
      oneLDGroup.visible = mode !== 'v2'
    },
    update(camera: T.PerspectiveCamera, time: number) {
      if (!root.visible) return
      for (const t of times) t.value = time
      oneLDRing.visible = camera.position.distanceTo(oneLDPos) > 25
      oneLDRing.lookAt(camera.position)
    },
    collectLabels(project: Project, markers: Label[]) {
      if (!root.visible) return
      for (const { pos, label } of landmarks) {
        const q = project(pos)
        if (q) markers.push({ el: label, q, r: 4 })
      }
      const q = oneLDGroup.visible && project(ldLandmark)
      if (q) markers.push({ el: ldLabel, q, r: 4 })
    },
    draw2D(ctx: CanvasRenderingContext2D, project: Project, camera: T.PerspectiveCamera) {
      if (!root.visible) return
      ctx.save()
      ctx.lineWidth = 1
      // Trace each shell's apparent limb, including in a nearly edge-on view.
      const axis = camera.position.clone().normalize()
      const u = v3().crossVectors(Math.abs(axis.y) > 0.95 ? v3(1, 0, 0) : v3(0, 1, 0), axis).normalize()
      const v = v3().crossVectors(axis, u), dir = v3()
      const distance = camera.position.length()
      for (const shell of shells) {
        const ratio = shell.radius(axis) / distance
        if (ratio >= 1) continue
        const limb = Math.sqrt(1 - ratio * ratio)
        ctx.beginPath()
        for (let i = 0; i <= 120; i++) {
          const a = tau * i / 120
          dir.copy(axis).multiplyScalar(ratio).addScaledVector(u, limb * Math.cos(a)).addScaledVector(v, limb * Math.sin(a))
          const q = project(dir.multiplyScalar(shell.radius(dir)))
          if (!q) continue
          if (i) ctx.lineTo(q.x, q.y)
          else ctx.moveTo(q.x, q.y)
        }
        ctx.closePath()
        ctx.fillStyle = ctx.strokeStyle = shell.color
        ctx.globalAlpha = 0.045
        ctx.fill()
        ctx.globalAlpha = 0.35
        ctx.stroke()
      }
      for (const ring of oneLDGroup.visible ? [...rings, oneLDEquator, elevArc] : rings) {
        const mat = ring.material as T.LineBasicMaterial
        ctx.strokeStyle = mat.color.getStyle()
        ctx.globalAlpha = mat.opacity
        ctx.setLineDash(mat instanceof T.LineDashedMaterial ? [5, 3] : [])
        ctx.beginPath()
        let started = false
        const attr = ring.geometry.attributes.position, p = v3()
        for (let i = 0; i < attr.count; i++) {
          const q = project(p.fromBufferAttribute(attr, i))
          if (q && started) ctx.lineTo(q.x, q.y)
          else if (q) ctx.moveTo(q.x, q.y)
          started = !!q
        }
        ctx.stroke()
      }
      ctx.restore()
    },
    dispose() {
      ldLabel.remove()
      for (const { label } of landmarks) label.remove()
    },
  }
}
