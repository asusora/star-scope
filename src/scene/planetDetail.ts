import * as T from 'three'
import { createMapSynthesizer } from './mapSynthesizer'
import { detailSources } from '../data/assets'
import {
  buildDetailedBodyGeometry,
  extractTexturePixels,
  getBodyDetailSpec,
  isProceduralDetailBody,
  type SynthesizedMaps,
} from './bodyDetail'
import { cloudBand, cloudProfile, planetMaterial } from './planetSurfaces'
import type { Moon, World } from './types'
import type { TextureUpload } from './textureUploads'

export type PlanetBody = Pick<
  World,
  'id' | 'pos' | 'r' | 'mesh' | 'clouds' | 'haze' | 'atmosphere' | 'rings'
> & {
  parentId?: string
  semiMajorKm?: number
  minorMoon?: Moon
}

export type SurfacePixels = Partial<
  Record<'surface' | 'clouds' | 'night' | 'water' | 'ring' | 'normal' | 'emission', ImageData>
>
type Channel = keyof SurfacePixels

interface CachedProceduralDetail {
  key: string
  geometry: T.BufferGeometry | null
  maps: SynthesizedMaps
}

export function createPlanetDetail(
  renderer: T.WebGLRenderer | null,
  scene: T.Scene,
  requestDraw: () => void,
  loadTexture: TextureUpload | null,
) {
  const synthesis = createMapSynthesizer()
  const closeGeometry = renderer ? new T.SphereGeometry(1, 160, 108) : null
  let bandBody = ''
  const proceduralCache = new Map<string, CachedProceduralDetail>()
  const maxCacheEntries = 5

  interface PhotoSet {
    controller: AbortController
    textures: Map<Channel, T.Texture>
    geometry?: T.BufferGeometry
    apply?: (channel: Channel, texture: T.Texture) => void
    failed?: boolean
  }
  const photos = new Map<string, PhotoSet>()
  function disposePhotos(set: PhotoSet) {
    set.controller.abort()
    for (const texture of set.textures.values()) texture.dispose()
    set.geometry?.dispose()
  }

  let active: PlanetBody | null = null
  let release: () => void = () => {}
  let pixels: SurfacePixels = {}

  // Dedicated high-detail proxy mesh used when focusing or approaching any minor instanced moon.
  let minorProxy: T.Mesh | null = null
  let activeMinorMoon: Moon | null = null
  let activeMinorScale = 1

  function putCache(key: string, entry: CachedProceduralDetail) {
    if (proceduralCache.has(key)) {
      proceduralCache.delete(key)
    }
    proceduralCache.set(key, entry)
    while (proceduralCache.size > maxCacheEntries) {
      const oldestKey = proceduralCache.keys().next().value
      if (!oldestKey) break
      const oldest = proceduralCache.get(oldestKey)!
      proceduralCache.delete(oldestKey)
      oldest.maps.dispose()
      oldest.geometry?.dispose()
    }
  }

  function touchCache(key: string): CachedProceduralDetail | null {
    const hit = proceduralCache.get(key)
    if (!hit) return null
    proceduralCache.delete(key)
    proceduralCache.set(key, hit)
    return hit
  }

  function syncProxy() {
    if (!minorProxy || !activeMinorMoon) return
    minorProxy.position.copy(activeMinorMoon.world)
    if (activeMinorMoon.quat) {
      minorProxy.quaternion.copy(activeMinorMoon.quat)
    }
    minorProxy.scale.setScalar(activeMinorScale)
  }

  function select(body: PlanetBody | null) {
    if (active === body) return
    release()
    pixels = {}
    active = body
    if (!body) return
    const moonRelief = !!body.parentId && isProceduralDetailBody(body.id) && body.id !== 'Titan'

    // Case 1: Minor instanced moon — spawn / attach dedicated high-detail sculpted proxy mesh.
    if (body.minorMoon) {
      const moon = body.minorMoon
      const cacheKey = `minor:${body.parentId ?? ''}:${body.id}`
      const spec = getBodyDetailSpec(body.id, body.parentId, body.semiMajorKm)
      const cached = touchCache(cacheKey)
      const mobile = matchMedia('(max-width:700px)').matches
      const mapW = renderer ? (mobile ? 640 : 1024) : 512
      const mapH = mapW >> 1
      const aniso = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1

      let cancelSynth: (() => void) | null = null
      let proxyMat: T.MeshPhongMaterial | null = null
      let tempGeo: T.BufferGeometry | null = null

      if (renderer) {
        const geo =
          cached?.geometry ?? buildDetailedBodyGeometry(body.id, 'close', body.parentId, body.semiMajorKm)
        if (!cached) tempGeo = geo
        proxyMat = planetMaterial(body.id, cached?.maps.albedo ?? null)
        if (cached) {
          proxyMat.normalMap = cached.maps.normal
          proxyMat.bumpMap = null
          proxyMat.normalScale.set(1.05, 1.05)
          if (cached.maps.specular && spec.baseGloss > 0.1) {
            proxyMat.specularMap = cached.maps.specular
            proxyMat.specular.setHex(0x3a4652)
          }
          proxyMat.needsUpdate = true
        } else {
          // Immediate matte rock color while async high-res maps synthesize (~40ms)
          proxyMat.color.setRGB(...spec.baseColor)
        }
        minorProxy = new T.Mesh(geo, proxyMat)
        minorProxy.visible = true
        activeMinorMoon = moon
        activeMinorScale = moon.r
        moon.detailHidden = true
        syncProxy()
        scene.add(minorProxy)
        requestDraw()
      }

      if (cached) {
        if (!renderer && cached.maps.albedoPixels) {
          pixels.surface = cached.maps.albedoPixels
          if (moonRelief) pixels.normal = cached.maps.normalPixels
          requestDraw()
        }
      } else {
        cancelSynth = synthesis.run(spec, mapW, mapH, {
          closeRelief: moonRelief,
          includeSpecular: spec.baseGloss > 0.1,
          maxAnisotropy: aniso,
          keepPixels: !renderer,
          budgetMs: 7,
          onDone: (maps) => {
            cancelSynth = null
            if (active !== body) {
              maps.dispose()
              tempGeo?.dispose()
              return
            }
            const storedGeo = tempGeo
            tempGeo = null
            putCache(cacheKey, { key: cacheKey, geometry: storedGeo, maps })
            if (renderer && proxyMat) {
              proxyMat.color.setHex(0xffffff)
              proxyMat.map = maps.albedo
              proxyMat.bumpMap = null
              proxyMat.normalMap = maps.normal
              proxyMat.normalScale.set(1.05, 1.05)
              if (maps.specular && spec.baseGloss > 0.1) {
                proxyMat.specularMap = maps.specular
                proxyMat.specular.setHex(0x3a4652)
              }
              proxyMat.needsUpdate = true
            } else if (!renderer && maps.albedoPixels) {
              pixels.surface = maps.albedoPixels
              if (moonRelief) pixels.normal = maps.normalPixels
            }
            requestDraw()
          },
        })
      }

      release = () => {
        cancelSynth?.()
        cancelSynth = null
        moon.detailHidden = false
        activeMinorMoon = null
        if (minorProxy) {
          scene.remove(minorProxy)
          minorProxy = null
        }
        if (proxyMat) {
          proxyMat.dispose()
          proxyMat = null
        }
        if (tempGeo) {
          tempGeo.dispose()
          tempGeo = null
        }
        release = () => {}
      }
      return
    }

    const mesh = body.mesh
    const surface = mesh.material as T.MeshPhongMaterial
    const clouds = body.clouds?.material as T.MeshLambertMaterial | undefined
    const ring = body.rings?.material as T.MeshBasicMaterial | undefined
    const geometry = mesh.geometry
    const base = surface.map
    const baseBump = surface.bumpMap
    const baseNormal = surface.normalMap
    const baseSpecMap = surface.specularMap
    const baseEmissiveMap = surface.emissiveMap
    const baseColorHex = surface.color.getHex()
    const baseSpecularHex = surface.specular.getHex()
    const baseNormalScaleX = surface.normalScale.x
    const baseNormalScaleY = surface.normalScale.y
    const cloudMask = clouds?.alphaMap ?? null
    const ringMap = ring?.map ?? null
    const earthCloudMap = surface.userData.earthCloudMap as
      | { value: T.Texture | null }
      | undefined
    const cloudGeometry = body.clouds?.geometry
    const hazeGeometry = body.haze?.geometry
    const atmoGeometry = body.atmosphere?.geometry
    const id = body.id
    const wind = cloudProfile(id)
    if (wind && closeGeometry && bandBody !== id) {
      const { widthSegments, heightSegments } = closeGeometry.parameters
      const uv = closeGeometry.getAttribute('uv')
      const band = (closeGeometry.getAttribute('jetBand') as T.BufferAttribute | undefined) ??
        new T.BufferAttribute(new Float32Array(uv.count), 1)
      for (let row = 0; row <= heightSegments; row++) {
        const start = row * (widthSegments + 1)
        band.array.fill(cloudBand(id, uv.getY(start)), start, start + widthSegments + 1)
      }
      band.needsUpdate = true
      closeGeometry.setAttribute('jetBand', band)
      bandBody = id
    }

    function restoreSurface() {
      // The overview worker may have finished while the close-up owned this material.
      const mid = surface.userData.midMaps as SynthesizedMaps | undefined
      surface.color.setHex(mid ? 0xffffff : baseColorHex)
      surface.map = mid ? mid.albedo : base
      surface.bumpMap = mid ? null : baseBump
      surface.normalMap = mid ? mid.normal : baseNormal
      surface.specularMap = mid ? mid.specular : baseSpecMap
      surface.emissiveMap = mid ? mid.emissive : baseEmissiveMap
      if (mid && mid.normal !== baseNormal) {
        const scale = id === 'Titan' ? 0.25 : 0.92
        surface.normalScale.set(scale, scale)
      } else {
        surface.normalScale.set(baseNormalScaleX, baseNormalScaleY)
      }
      surface.specular.setHex(baseSpecularHex)
      surface.userData.detailActive = false
      surface.userData.photoCloudDetail = false
      surface.needsUpdate = true
    }

    const hasStaticDetail = !!detailSources[body.id]

    // Case 2: Major planets & Earth's Moon — load high-resolution photographic detail maps.
    if (hasStaticDetail) {
      const pending = new Set<HTMLImageElement>()
      const mappedMoon = !!body.parentId && id !== 'Moon'
      let loadedNormal: T.Texture | null = null
      let loadedEmission: T.Texture | null = null
      if (closeGeometry) {
        surface.userData.detailActive = true
        // Keep the silhouette of sculpted moons, including Iapetus's equatorial ridge.
        mesh.geometry = mappedMoon && getBodyDetailSpec(id).customShape ? geometry : closeGeometry
        if (body.clouds) body.clouds.geometry = closeGeometry
        if (body.haze) body.haze.geometry = closeGeometry
        if (body.atmosphere) body.atmosphere.geometry = closeGeometry
      }
      function apply(channel: Channel, texture: T.Texture) {
        switch (channel) {
          case 'surface':
            surface.map = texture
            if (wind || mappedMoon || id === 'Pluto') {
              surface.color.setHex(0xffffff)
              surface.userData.photoCloudDetail = !!wind
              surface.bumpMap = null
              surface.normalMap = loadedNormal
              surface.specularMap = null
              surface.emissiveMap = loadedEmission
            } else if (baseBump && baseBump === base && !surface.normalMap) {
              surface.bumpMap = texture
            }
            break
          case 'night':
            surface.emissiveMap = texture
            break
          case 'emission':
            loadedEmission = surface.emissiveMap = texture
            break
          case 'water':
            surface.specularMap = texture
            surface.specular.setHex(0x788492)
            break
          case 'normal':
            loadedNormal = texture
            surface.normalMap = texture
            surface.bumpMap = null
            break
          case 'clouds':
            if (clouds) {
              clouds.alphaMap = texture
              clouds.needsUpdate = true
            }
            if (earthCloudMap) earthCloudMap.value = texture
            surface.userData.photoCloudDetail = true
            break
          case 'ring':
            if (ring) {
              ring.map = texture
              if (ring.userData.closeOpticalDepth) ring.userData.closeOpticalDepth.value = 1
            }
            break
        }
        surface.needsUpdate = true
        requestDraw()
      }
      const maxWidth = renderer
        ? Math.min(renderer.capabilities.maxTextureSize, matchMedia('(max-width:700px)').matches ? 2048 : 4096)
        : 1024
      const photoKey = body.id + ':' + maxWidth
      let set = photos.get(photoKey)
      if (set?.failed) {
        disposePhotos(set)
        photos.delete(photoKey)
        set = undefined
      }
      if (set) {
        photos.delete(photoKey)
        photos.set(photoKey, set)
        set.apply = apply
        for (const [channel, texture] of set.textures) apply(channel, texture)
      } else {
        if (loadTexture) {
          // Keep the current and last photographic body across zoom threshold crossings.
          if (photos.size >= 2) {
            const oldest = photos.keys().next().value!
            disposePhotos(photos.get(oldest)!)
            photos.delete(oldest)
          }
          set = { controller: new AbortController(), textures: new Map(), apply }
          photos.set(photoKey, set)
        }
        const load = (key: string, channel: Channel, srgb: boolean) => {
          const url = detailSources[key]
          if (!url) return
          if (renderer && loadTexture && set) {
            const entry = set
            loadTexture(url, entry.controller.signal, {
              maxWidth,
              colorSpace: srgb ? T.SRGBColorSpace : T.NoColorSpace,
              anisotropy: Math.min(4, renderer.capabilities.getMaxAnisotropy()),
              wrapS: channel === 'ring' ? T.ClampToEdgeWrapping : T.RepeatWrapping,
            }, (texture) => {
              entry.textures.get(channel)?.dispose()
              entry.textures.set(channel, texture)
              entry.apply?.(channel, texture)
            }, () => { entry.failed = true })
          } else {
            const image = new Image()
            pending.add(image)
            image.onload = () => {
              pending.delete(image)
              if (active !== body) return
              const canvas = document.createElement('canvas')
              canvas.width = Math.min(maxWidth, image.width)
              canvas.height = Math.max(1, Math.round(image.height * canvas.width / image.width))
              const ctx = canvas.getContext('2d')!
              ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
              pixels[channel] = ctx.getImageData(0, 0, canvas.width, canvas.height)
              requestDraw()
            }
            image.onerror = () => pending.delete(image)
            image.src = url
          }
        }
        load(body.id, 'surface', true)
        if (id !== 'Earth' || renderer) load(id + 'Normal', 'normal', false)
        if (id === 'Io') load('IoEmission', 'emission', true)
        if (body.id === 'Earth') {
          load('EarthNight', 'night', true)
          load('EarthWater', 'water', false)
          load('EarthClouds', 'clouds', false)
        }
        if (body.id === 'Saturn' && ring) load('SaturnRing', 'ring', true)
      }
      if (renderer && set && mappedMoon && getBodyDetailSpec(id).customShape) {
        set.geometry ??= buildDetailedBodyGeometry(id, 'close', body.parentId, body.semiMajorKm)
        mesh.geometry = set.geometry
      }
      release = () => {
        for (const image of pending) {
          image.onload = null
          image.onerror = null
          image.removeAttribute('src')
        }
        if (renderer) {
          mesh.geometry = geometry
          restoreSurface()
          if (body.id === 'Earth') {
            if (clouds) {
              clouds.alphaMap = cloudMask
              clouds.needsUpdate = true
            }
            if (earthCloudMap) earthCloudMap.value = cloudMask
            if (body.clouds && cloudGeometry) body.clouds.geometry = cloudGeometry
          }
          if (body.haze && hazeGeometry) body.haze.geometry = hazeGeometry
          if (body.atmosphere && atmoGeometry) body.atmosphere.geometry = atmoGeometry
          if (ring) {
            ring.map = ringMap
            if (ring.userData.closeOpticalDepth) ring.userData.closeOpticalDepth.value = 0
          }
          surface.needsUpdate = true
          if (set) set.apply = undefined
        }
        release = () => {}
      }
      return
    }

    // Case 3: Dwarf planets, asteroids, and all featured moons — high-res sculpted geometry + procedural albedo/normal/spec/emissive maps!
    const cacheKey = `body:${body.parentId ?? ''}:${body.id}`
    const spec = getBodyDetailSpec(body.id, body.parentId, body.semiMajorKm)
    const cached = touchCache(cacheKey)
    const mobile = matchMedia('(max-width:700px)').matches
    const mapW = renderer ? (mobile ? 768 : 1280) : 512
    const mapH = mapW >> 1
    const aniso = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1

    surface.userData.detailActive = true
    let cancelSynth: (() => void) | null = null
    let tempGeo: T.BufferGeometry | null = null

    function applyProceduralMaps(maps: SynthesizedMaps) {
      if (renderer) {
        surface.color.setHex(0xffffff)
        surface.map = maps.albedo
        surface.bumpMap = null
        surface.normalMap = wind ? null : maps.normal
        surface.userData.photoCloudDetail = !!wind
        const nScale = spec.titanBands ? 0.3 : spec.customShape ? 1.08 : 0.96
        surface.normalScale.set(nScale, nScale)
        if (maps.specular && (spec.baseGloss > 0.12 || (spec.iceGlossBoost ?? 0) > 0.2)) {
          surface.specularMap = maps.specular
          surface.specular.setHex(spec.baseGloss > 0.35 ? 0x526474 : 0x34424e)
        }
        if (maps.emissive) {
          surface.emissiveMap = maps.emissive
        }
        surface.needsUpdate = true
      } else if (maps.albedoPixels) {
        pixels.surface = maps.albedoPixels
        if (moonRelief) pixels.normal = maps.normalPixels
        pixels.emission = maps.emissivePixels
      }
      requestDraw()
    }

    if (renderer) {
      if (spec.customShape) {
        const highGeo =
          cached?.geometry ?? buildDetailedBodyGeometry(body.id, 'close', body.parentId, body.semiMajorKm)
        if (!cached) tempGeo = highGeo
        mesh.geometry = highGeo
      } else if (closeGeometry) {
        mesh.geometry = closeGeometry
        if (body.atmosphere) body.atmosphere.geometry = closeGeometry
      }
      requestDraw()
    }

    if (cached) {
      applyProceduralMaps(cached.maps)
    } else {
      const basePixels = spec.baseImageMix ? extractTexturePixels(base, 512) : null
      cancelSynth = synthesis.run(spec, mapW, mapH, {
        closeRelief: moonRelief,
        basePixels,
        includeSpecular: spec.baseGloss > 0.12 || (spec.iceGlossBoost ?? 0) > 0.2,
        maxAnisotropy: aniso,
        keepPixels: !renderer,
        budgetMs: 7,
        onDone: (maps) => {
          cancelSynth = null
          if (active !== body) {
            maps.dispose()
            tempGeo?.dispose()
            return
          }
          const storedGeo = tempGeo
          tempGeo = null
          putCache(cacheKey, { key: cacheKey, geometry: storedGeo, maps })
          applyProceduralMaps(maps)
        },
      })
    }

    release = () => {
      cancelSynth?.()
      cancelSynth = null
      surface.userData.detailActive = false
      if (renderer) {
        mesh.geometry = geometry
        if (body.atmosphere && atmoGeometry) body.atmosphere.geometry = atmoGeometry
        restoreSurface()
      }
      if (tempGeo) {
        tempGeo.dispose()
        tempGeo = null
      }
      release = () => {}
    }
  }

  return {
    select,
    update(clock: number) {
      if (active) {
        const wind = cloudProfile(active.id)
        if (wind) {
          const material = active.mesh.material as T.MeshPhongMaterial
          material.userData.cloudDrift.value = (clock * wind.rate) % 1
        }
      }
      syncProxy()
    },
    pixelsFor: (id: string) => (active?.id === id ? pixels : null),
    dispose() {
      select(null)
      synthesis.dispose()
      for (const entry of proceduralCache.values()) {
        entry.maps.dispose()
        entry.geometry?.dispose()
      }
      proceduralCache.clear()
      for (const set of photos.values()) disposePhotos(set)
      photos.clear()
      closeGeometry?.dispose()
    },
  }
}
