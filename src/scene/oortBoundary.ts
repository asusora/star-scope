import * as T from 'three'
import { PROXIMA_DEC_DEG, PROXIMA_DISTANCE_LY, PROXIMA_RA_DEG } from '../data/solar'
import { pick, type Locale } from '../i18n'
import { clamp, skyDirection, tau, v3 } from './math'
import type { Label, ScreenPoint } from './types'

export interface OuterOortLayout {
  inner: number
  outer: number
  thousandR: number
  tenThousandR: number
  lightYearR: number
  coreOuterR: number
}

interface ScaleRingEntry {
  kind: 'au1k' | 'au10k' | 'ly1' | 'hill'
  radius: number
  color: number
  baseOpacity: number
  dashed: boolean
  line: T.Line
  meridian?: T.Line
  labelPos: T.Vector3
  label: HTMLSpanElement
}

function createRing(
  radius: number,
  color: number,
  opacity: number,
  segments: number,
  dashed: boolean,
  plane: 'ecliptic' | 'meridian' = 'ecliptic',
): T.Line {
  const pts: number[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * tau
    if (plane === 'ecliptic') {
      pts.push(Math.cos(a) * radius, 0, -Math.sin(a) * radius)
    } else {
      pts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0)
    }
  }
  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3))
  const mat = dashed
    ? new T.LineDashedMaterial({
        color,
        transparent: true,
        opacity,
        dashSize: Math.max(8, radius * 0.022),
        gapSize: Math.max(6, radius * 0.016),
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
  line.renderOrder = 1
  return line
}

function createHillShellMaterial(color: number) {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.FrontSide,
    blending: T.AdditiveBlending,
    uniforms: {
      uColor: { value: new T.Color(color) },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vLocalDir;
      void main() {
        vLocalDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vLocalDir;
      void main() {
        float ndv = abs(dot(normalize(vNormalView), normalize(vViewDir)));
        float fresnel = pow(1.0 - ndv, 3.2);
        // Subtle celestial latitude-longitude shimmer suggesting Galactic tidal limit
        float bands = 0.88 + 0.12 * sin(vLocalDir.y * 18.0 - uTime * 0.28);
        float alpha = (0.04 + 0.96 * fresnel) * uOpacity * bands;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  })
}

function createBeaconTexture(): T.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
  g.addColorStop(0, 'rgba(255, 240, 214, 1)')
  g.addColorStop(0.24, 'rgba(255, 190, 128, 0.82)')
  g.addColorStop(0.6, 'rgba(255, 146, 92, 0.22)')
  g.addColorStop(1, 'rgba(255, 146, 92, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = 'rgba(255, 244, 224, 0.9)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(32, 16)
  ctx.lineTo(32, 48)
  ctx.moveTo(16, 32)
  ctx.lineTo(48, 32)
  ctx.stroke()
  const tex = new T.CanvasTexture(c)
  tex.colorSpace = T.SRGBColorSpace
  return tex
}

export function createOortBoundaries(
  scene: T.Scene,
  webgl: boolean,
  band: OuterOortLayout,
  tag: (name: string, cls?: string) => HTMLSpanElement,
  pins: HTMLElement,
  onOpenProxima: () => void,
) {
  const root = new T.Group()
  root.visible = false
  scene.add(root)

  const disposables: { dispose(): void }[] = []

  const specs: {
    kind: ScaleRingEntry['kind']
    radius: number
    color: number
    opacity: number
    dashed: boolean
    meridianOpacity?: number
    labelAngle: number
  }[] = [
    {
      kind: 'au1k',
      radius: band.thousandR,
      color: 0x7694cc,
      opacity: 0.24,
      dashed: true,
      labelAngle: -0.38,
    },
    {
      kind: 'au10k',
      radius: band.tenThousandR,
      color: 0x6ea8e0,
      opacity: 0.30,
      dashed: true,
      labelAngle: 2.65,
    },
    {
      kind: 'ly1',
      radius: band.lightYearR,
      color: 0x68d8f8,
      opacity: 0.48,
      dashed: false,
      meridianOpacity: 0.16,
      labelAngle: -0.95,
    },
    {
      kind: 'hill',
      radius: band.outer,
      color: 0x9abaff,
      opacity: 0.42,
      dashed: true,
      meridianOpacity: 0.14,
      labelAngle: 3.55,
    },
  ]

  const rings: ScaleRingEntry[] = specs.map((spec) => {
    const line = createRing(spec.radius, spec.color, 0, 192, spec.dashed, 'ecliptic')
    root.add(line)
    disposables.push(line.geometry, line.material as T.Material)

    let meridian: T.Line | undefined
    if (spec.meridianOpacity) {
      meridian = createRing(spec.radius, spec.color, 0, 160, spec.dashed, 'meridian')
      meridian.rotation.y = spec.kind === 'ly1' ? 0.55 : -0.68
      root.add(meridian)
      disposables.push(meridian.geometry, meridian.material as T.Material)
    }

    const labelPos = v3(
      Math.cos(spec.labelAngle) * spec.radius,
      0,
      -Math.sin(spec.labelAngle) * spec.radius,
    )
    const label = tag('', spec.kind === 'ly1' ? 'oort-bound ly' : 'oort-bound')

    return {
      kind: spec.kind,
      radius: spec.radius,
      color: spec.color,
      baseOpacity: spec.opacity,
      dashed: spec.dashed,
      line,
      meridian,
      labelPos,
      label,
    }
  })

  // Delicate translucent 3D Fresnel sphere at the ~150,000 AU Solar Hill Sphere boundary
  let hillShellMat: T.ShaderMaterial | null = null
  if (webgl) {
    const shellGeo = new T.SphereGeometry(band.outer, 64, 40)
    hillShellMat = createHillShellMaterial(0x63a6f4)
    const shellMesh = new T.Mesh(shellGeo, hillShellMat)
    shellMesh.renderOrder = 0
    root.add(shellMesh)
    disposables.push(shellGeo, hillShellMat)
  }

  // Real J2000 ICRS direction vector toward Proxima Centauri (4.246 ly / ~268,770 AU)
  const proximaDir = skyDirection(PROXIMA_RA_DEG, PROXIMA_DEC_DEG).normalize()
  const proximaStart = proximaDir.clone().multiplyScalar(band.outer * 0.94)
  const proximaTip = proximaDir.clone().multiplyScalar(band.outer + 150)

  const rayGeo = new T.BufferGeometry().setFromPoints([proximaStart, proximaTip])
  const rayMat = new T.LineDashedMaterial({
    color: 0xffbc86,
    transparent: true,
    opacity: 0,
    dashSize: 14,
    gapSize: 9,
    depthWrite: false,
  })
  const proximaRay = new T.Line(rayGeo, rayMat)
  proximaRay.computeLineDistances()
  proximaRay.renderOrder = 2
  root.add(proximaRay)
  disposables.push(rayGeo, rayMat)

  let proximaSprite: T.Sprite | null = null
  if (webgl) {
    const tex = createBeaconTexture()
    const mat = new T.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
    })
    proximaSprite = new T.Sprite(mat)
    proximaSprite.position.copy(proximaTip)
    proximaSprite.scale.setScalar(26)
    proximaSprite.renderOrder = 3
    root.add(proximaSprite)
    disposables.push(tex, mat)
  }

  const proximaBtn = document.createElement('button')
  proximaBtn.type = 'button'
  proximaBtn.className = 'tag oort-proxima'
  proximaBtn.hidden = true
  proximaBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    onOpenProxima()
  })
  pins.append(proximaBtn)

  let currentFade = 0
  const labelWorldTmp = v3()

  function refreshLabels(lang: Locale) {
    for (const r of rings) {
      if (r.kind === 'au1k') {
        r.label.textContent = pick('1,000 AU · 内奥尔特云', '1,000 AU · Inner Oort', lang)
      } else if (r.kind === 'au10k') {
        r.label.textContent = pick('10,000 AU · 希尔斯云', '10,000 AU · Hills Cloud', lang)
      } else if (r.kind === 'ly1') {
        r.label.textContent = pick('1 光年 · 63,241 AU', '1 Light-Year · 63,241 AU', lang)
      } else {
        r.label.textContent = pick(
          '太阳希尔球 · ~150,000 AU',
          'Solar Hill Sphere · ~150,000 AU',
          lang,
        )
      }
    }
    const ly = PROXIMA_DISTANCE_LY.toFixed(2)
    proximaBtn.textContent = pick(
      `→ 比邻星方向 · ${ly} 光年`,
      `→ Proxima Centauri · ${ly} ly`,
      lang,
    )
    proximaBtn.title = pick(
      '点击前往比邻星三维视图（距太阳约 268,770 AU）',
      'Open Proxima Centauri 3D view (~268,770 AU from the Sun)',
      lang,
    )
  }

  function update(
    targetFade: number,
    ambientTime: number,
    deltaSec: number,
    reduceMotion: boolean,
    project: (pos: T.Vector3) => ScreenPoint | null,
    placeText: (el: HTMLElement, x: number, y: number) => void,
    markers: Label[] | null,
    showNames: boolean,
    width: number,
    height: number,
  ) {
    const goal = clamp(targetFade, 0, 1)
    if (reduceMotion) {
      currentFade = goal
    } else {
      const k = 1 - Math.exp(-deltaSec * 7.5)
      currentFade += (goal - currentFade) * k
      if (Math.abs(currentFade - goal) < 0.002) currentFade = goal
    }

    const active = currentFade > 0.006
    root.visible = active
    if (!active) {
      proximaBtn.hidden = true
      return
    }

    for (const r of rings) {
      const mat = r.line.material as T.LineBasicMaterial | T.LineDashedMaterial
      mat.opacity = r.baseOpacity * currentFade
      if (r.meridian) {
        const mMat = r.meridian.material as T.LineBasicMaterial | T.LineDashedMaterial
        mMat.opacity = (r.kind === 'ly1' ? 0.16 : 0.14) * currentFade
      }
    }

    if (hillShellMat) {
      hillShellMat.uniforms.uOpacity.value = 0.22 * currentFade
      hillShellMat.uniforms.uTime.value = ambientTime
    }

    rayMat.opacity = 0.68 * currentFade
    if (proximaSprite) {
      const pulse = 1 + 0.08 * Math.sin(ambientTime * 2.4)
      proximaSprite.material.opacity = 0.92 * currentFade
      const tipQ = project(proximaTip)
      if (tipQ) {
        proximaSprite.scale.setScalar((20 * pulse) / Math.max(0.05, tipQ.scale))
      }
    }

    const showLabels = showNames && currentFade > 0.24
    if (showLabels && markers) {
      for (const r of rings) {
        const q = project(labelWorldTmp.copy(r.labelPos))
        if (q) {
          markers.push({ el: r.label, q, r: 4 })
        }
      }
    }

    const pq = showLabels ? project(proximaTip) : null
    const pVisible =
      !!pq && pq.x >= 16 && pq.x <= width - 16 && pq.y >= 16 && pq.y <= height - 16
    if (proximaBtn.hidden === pVisible) proximaBtn.hidden = !pVisible
    if (pVisible && pq) {
      proximaBtn.style.opacity = String(clamp((currentFade - 0.12) / 0.55, 0, 1))
      placeText(proximaBtn, Math.min(width - 180, pq.x + 12), Math.max(18, pq.y - 11))
    }
  }

  function draw2D(ctx: CanvasRenderingContext2D, project: (pos: T.Vector3) => ScreenPoint | null) {
    if (currentFade <= 0.01) return
    ctx.save()
    const pt = v3()
    for (const r of rings) {
      ctx.strokeStyle = '#' + new T.Color(r.color).getHexString()
      ctx.globalAlpha = r.baseOpacity * currentFade * 0.95
      ctx.lineWidth = r.kind === 'ly1' ? 1.35 : 1
      ctx.setLineDash(r.dashed ? [6, 5] : [])
      ctx.beginPath()
      let down = false
      const steps = 128
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * tau
        pt.set(Math.cos(a) * r.radius, 0, -Math.sin(a) * r.radius)
        const q = project(pt)
        if (!q) {
          down = false
          continue
        }
        if (down) ctx.lineTo(q.x, q.y)
        else ctx.moveTo(q.x, q.y)
        down = true
      }
      ctx.stroke()
    }

    const q0 = project(proximaStart)
    const q1 = project(proximaTip)
    if (q0 && q1) {
      ctx.strokeStyle = '#ffbc86'
      ctx.globalAlpha = 0.72 * currentFade
      ctx.lineWidth = 1.4
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(q0.x, q0.y)
      ctx.lineTo(q1.x, q1.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ffe8ce'
      ctx.beginPath()
      ctx.arc(q1.x, q1.y, 3.2, 0, tau)
      ctx.fill()
    }
    ctx.restore()
  }

  function dispose() {
    for (const d of disposables) d.dispose()
    proximaBtn.remove()
    scene.remove(root)
  }

  return {
    root,
    refreshLabels,
    update,
    draw2D,
    dispose,
    get fade() {
      return currentFade
    },
  }
}
