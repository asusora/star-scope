import * as T from 'three'
import gravelUrl from '../../assets/landing/gravel.jpg'
import screeUrl from '../../assets/landing/scree.jpg'
import cloudUrl from '../../assets/landing/cloud-banks.jpg'
import wispUrl from '../../assets/landing/cloud-wisp.webp'
import { seeded } from '../math'
import { isRealisticSite, rgb, type Landscape, type Terrain } from './landscape'
import { buildPatch, type SurfaceMesh } from './ground'
import { createRealisticSurface } from './realisticSurface'
import { makeSky } from './sky'
import { createSoftwareLandscape, verticalFov, type SurfacePose } from './software'

export function createLandscapeView(
  site: Landscape,
  terrain: Terrain,
  renderer: T.WebGLRenderer | null,
  ctx: CanvasRenderingContext2D | null,
  requestDraw: () => void,
) {
  if (renderer && isRealisticSite(site)) {
    return createRealisticSurface(site, terrain, renderer, requestDraw)
  }
  const sky = makeSky(site, terrain),
    cloud = site.kind === 'cloud'
  const fog = rgb(site.palette[2])
  const haze = cloud
    ? 520
    : site.id === 'Venus'
      ? 410
      : site.kind === 'craters'
        ? 8300
        : site.kind === 'alpine'
          ? 1500
          : 1000
  const software = ctx ? createSoftwareLandscape(ctx, sky, fog, haze, cloud) : null
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(verticalFov, 1, 0.12, 5000)
  const geometry = new T.BufferGeometry()
  const landMaterial = new T.ShaderMaterial({
    uniforms: {
      strata: { value: site.kind === 'dust' || site.kind === 'lava' ? 1 : 0 },
      shadeMap: { value: null },
      tile: { value: null },
      ready: { value: 0 },
      haze: { value: haze },
      horizon: { value: new T.Vector3(...fog) },
    },
    vertexShader: `varying float elevation;attribute vec3 color;attribute vec2 shadowUv;varying vec2 sh;varying vec2 terrainUv;varying vec3 tint;varying float depth;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;depth=-p.z;tint=color;terrainUv=uv;sh=shadowUv;elevation=position.y;}`,
    fragmentShader: `varying float elevation;uniform float strata;varying vec2 sh;uniform sampler2D shadeMap;uniform sampler2D tile;uniform float ready;uniform float haze;uniform vec3 horizon;
      varying vec2 terrainUv;varying vec3 tint;varying float depth;
      void main(){float detail=texture2D(tile,terrainUv).r;
        float broad=texture2D(tile,terrainUv.yx*.081+vec2(.31,.47)).r;
        float layers=sin(elevation*2.6+terrainUv.x*.18+sin(terrainUv.y*.12)+broad*5.);
        float grain=mix(1.,(.32+detail)*(.70+.45*broad)*(1.+.047*strata*layers),ready);if(all(greaterThanEqual(sh,vec2(0.)))&&all(lessThanEqual(sh,vec2(1.))))grain*=texture2D(shadeMap,sh).r;gl_FragColor=vec4(mix(horizon,tint*grain,exp(-max(0.,depth)/haze)),1.);}`,
  })
  const ground = new T.Mesh(geometry, landMaterial)
  ground.frustumCulled = false
  scene.add(ground)
  const skyMap = new T.CanvasTexture(sky)
  skyMap.colorSpace = T.SRGBColorSpace
  const skyMaterial = new T.MeshBasicMaterial({
    map: skyMap,
    side: T.BackSide,
    depthWrite: false,
    fog: false,
  })
  const dome = new T.Mesh(new T.SphereGeometry(3500, 64, 36), skyMaterial)
  dome.renderOrder = -2
  scene.add(dome)
  let disposed = false,
    albedo: T.Texture | undefined
  const photo = new Image()
  photo.onload = () => {
    if (disposed) return
    software?.texture(photo)
    if (renderer) {
      albedo = new T.Texture(photo)
      albedo.wrapS = albedo.wrapT = T.RepeatWrapping
      albedo.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      albedo.needsUpdate = true
      landMaterial.uniforms.tile.value = albedo
      landMaterial.uniforms.ready.value = 1
    }
    requestDraw()
  }
  photo.src = cloud
    ? cloudUrl
    : site.kind === 'alpine' || site.kind === 'lava'
      ? screeUrl
      : gravelUrl
  const wisps: T.Sprite[] = [],
    wispMat = new T.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      color: site.palette[1],
      opacity: 0.43,
    })
  let wispMap: T.Texture | undefined
  const vapor = new Image()
  if (cloud) {
    vapor.onload = () => {
      if (disposed) return
      software?.setMist(vapor)
      if (renderer) {
        wispMap = new T.Texture(vapor)
        wispMap.colorSpace = T.SRGBColorSpace
        wispMap.needsUpdate = true
        wispMat.map = wispMap
        wispMat.needsUpdate = true
      }
      requestDraw()
    }
    vapor.src = wispUrl
    for (let i = 0; i < 64; i++) {
      const sprite = new T.Sprite(wispMat)
      scene.add(sprite)
      wisps.push(sprite)
    }
  }
  let cx = Infinity,
    cz = Infinity,
    mesh: SurfaceMesh,
    shadowMap: T.CanvasTexture | undefined
  function draw(pose: SurfacePose, width: number, height: number, time: number) {
    if (Math.abs(pose.x - cx) > 26 || Math.abs(pose.z - cz) > 26) {
      cx = Math.round(pose.x / 24) * 24
      cz = Math.round(pose.z / 24) * 24
      mesh = buildPatch(site, terrain, cx, cz)
      if (renderer) {
        // Dispose old GPU buffers before replacing their attributes during an excursion.
        geometry.dispose()
        shadowMap?.dispose()
        shadowMap = new T.CanvasTexture(mesh.shadows)
        shadowMap.flipY = false
        landMaterial.uniforms.shadeMap.value = shadowMap
        geometry.setAttribute('shadowUv', new T.BufferAttribute(mesh.shadowUv, 2))
        geometry.setAttribute('position', new T.BufferAttribute(mesh.position, 3))
        geometry.setAttribute('color', new T.BufferAttribute(mesh.color, 3))
        geometry.setAttribute('uv', new T.BufferAttribute(mesh.uv, 2))
        geometry.setIndex(new T.BufferAttribute(mesh.index, 1))
      }
    }
    if (cloud) {
      const tileX = Math.floor(pose.x / 120),
        tileZ = Math.floor(pose.z / 120)
      wisps.forEach((sprite, i) => {
        const gx = tileX + (i % 8) - 4,
          gz = tileZ + Math.floor(i / 8) - 4
        const rand = seeded(site.seed ^ Math.imul(gx, 17573) ^ Math.imul(gz, 95107))
        const x = (gx + 0.25 + rand() * 0.5) * 120,
          z = (gz + 0.25 + rand() * 0.5) * 120,
          span = 55 + rand() * 65
        sprite.position.set(x + Math.sin(time * 0.019 + gx) * 7, terrain.height(x, z) + 9, z)
        sprite.scale.set(span, span * 0.38, 1)
        sprite.visible = !!wispMap
      })
    }
    if (renderer) {
      if (camera.aspect !== width / height) {
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
      camera.position.set(pose.x, pose.y, pose.z)
      camera.rotation.set(pose.pitch, -pose.heading, 0, 'YXZ')
      dome.position.copy(camera.position)
      renderer.render(scene, camera)
    } else software?.draw(mesh, pose, width, height, wisps)
  }
  function dispose() {
    disposed = true
    photo.onload = vapor.onload = null
    geometry.dispose()
    landMaterial.dispose()
    albedo?.dispose()
    shadowMap?.dispose()
    skyMap.dispose()
    dome.geometry.dispose()
    skyMaterial.dispose()
    wispMat.dispose()
    wispMap?.dispose()
    scene.clear()
  }
  return { draw, dispose, walkableAt: undefined as ((x: number, z: number) => boolean) | undefined }
}
