import type * as T from 'three'
import type { ArchiveEntry, OrbitPath } from './types'
import type { Orbit } from './math'

export interface GalaxyForm {
  seed: number
  pitch: number
  roll: number
  height: number
  bulge: number
  depth: number
  type: number
}
export interface PlanetSystem {
  host: string
  star: string
  days: number
  axis: number
  radius: number
  rim: string
}
export interface StarLook {
  dark: number[]
  hot: number[]
  halo: string
  map: string
}
export interface LightSamples {
  pos: number[]
  color: number[]
  diameter: number[]
  alpha: number[]
}
export interface Surface {
  texture: T.Texture | null
  pixels: ImageData | null
  ready: Promise<void>
}
export type LightField = T.Points<T.BufferGeometry, T.ShaderMaterial>
export interface DeepBody {
  key: string
  name: string
  r: number
  mesh: T.Mesh
  pos: T.Vector3
  surface: Surface
  look: StarLook | null
  tag: HTMLSpanElement
  raster?: HTMLCanvasElement
  brush?: CanvasRenderingContext2D
  rasterData?: ImageData
}
export interface DeepModel {
  entry: ArchiveEntry
  form?: GalaxyForm
  system?: PlanetSystem
  planetOrbits?: { body: DeepBody; orbit: Orbit; meanAtEpoch: number; radiansPerSecond: number }[]
  view: string
  start: number
  origin: T.Vector3
  scene: T.Scene
  root: T.Group
  fields: LightField[]
  bodies: DeepBody[]
  orbits: OrbitPath[]
  landmarks: [string, T.Vector3, HTMLSpanElement][]
  background: T.Points
  volume?: T.Mesh<T.BufferGeometry, T.ShaderMaterial>
  sky?: T.Mesh<T.BufferGeometry, T.ShaderMaterial>
  voxels?: {
    nx: number
    ny: number
    nz: number
    values: Float32Array
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    image?: ImageData
  }
}
