import type * as T from 'three'
import type { Orbit } from './math'

export type Belt = 'main' | 'trojan' | 'centaur' | 'outer' | 'scattered'
export type OrbitMode = 'smart' | 'all' | 'off'
export type OrbitPath = T.Line<T.BufferGeometry, T.LineBasicMaterial>
export interface MoonRecord {
  name: string
  a: number
  inc: number
  period: number | null
  node: number
  e: number
  w: number
  frame: string
  num?: string
  year?: number | null
  des?: string
  estimate?: boolean
}

export interface Moon extends MoonRecord {}
export class Moon {
  constructor(
    record: MoonRecord,
    public parent: World,
    public index: number,
  ) {
    Object.assign(this, record)
  }
  numberName = ''
  label = ''
  discovered = ''
  otherNames: string[] = []
  searchNames: string[] = []
  pos!: T.Vector3
  world!: T.Vector3
  phase!: number
  featured!: boolean
  r!: number
  orbit!: Orbit
  omega!: number
  mesh?: T.Mesh
  atmosphere?: T.Mesh
  plume?: T.Mesh
  instance?: number
  aspect?: [number, number, number]
  spinAxis?: T.Vector3
  spinRate?: number
  spinPhase?: number
  quat?: T.Quaternion
  detailHidden?: boolean
  tag?: HTMLSpanElement
  path?: OrbitPath
}

export interface WorldDefinition {
  id: string
  name: string
  a: number
  r: number
  days: number
  phase: number
  e: number
  inc: number
  node: number
  region?: Belt
  peri?: number
  au?: number
  periAU?: number
  apoAU?: number
  kind?: string
  code?: string
  discovered?: string
  summary?: string
  source?: string
  prominent?: boolean
}

export interface World extends WorldDefinition {}
export class World {
  constructor(def: WorldDefinition, records: MoonRecord[]) {
    Object.assign(this, def)
    this.moons = records.map((record, i) => new Moon(record, this, i))
  }
  moons: Moon[]
  extent!: number
  pos!: T.Vector3
  orbit!: Orbit
  path!: OrbitPath
  anchor!: T.Group
  axis!: T.Group
  mesh!: T.Mesh
  tag!: HTMLSpanElement
  moonTracks!: T.Group
  rings?: T.Mesh
  minorRings?: T.Mesh
  coma?: T.Mesh
  clouds?: T.Mesh
  haze?: T.Mesh
  atmosphere?: T.Mesh
  instances?: T.InstancedMesh
  allMoonPaths?: OrbitPath
}
export const deepGroups = ['河外星系', '恒星', '系外行星'] as const
export type Group = '太阳系' | (typeof deepGroups)[number]
export interface ProbePhoto {
  id: string
  url: string
  title: string
  description: string
  probe: string
  date: string
  credit: string
  source: string
}
export interface ArchiveEntry {
  id: string
  title: string
  code: string
  group: Group
  body: string
  facts: string[][]
  source: string
  discovered?: string
  photo?: string
  caption?: string
  credit?: string
  imageSource?: string
  probePhotos?: ProbePhoto[]
  alt?: string
  object?: World
  moon?: Moon
  keys?: string[]
  featured?: boolean
}
export interface Note {
  name: string
  p?: T.Vector3
  body: string
  source: string
}
export interface ScreenPoint {
  x: number
  y: number
  z: number
  scale: number
}
export interface Label {
  el: HTMLElement
  q: ScreenPoint
  r: number
  left?: boolean
}
export interface StageElements {
  canvas: HTMLCanvasElement
  stage: HTMLElement
  tags: HTMLElement
  pins: HTMLElement
}
export interface SurfaceStatus {
  name: string
  region: string
  cloud: boolean
  descending: boolean
  altitude: number
  distance: number
  bearing: number
  veil: number
}
export interface SceneUI {
  landing: SurfaceStatus | null
  title: string
  galaxy: boolean
  planet: World | null
  moon: Moon | null
  region: Belt | null
  deepEntry: ArchiveEntry | null
  playing: boolean
  speed: number
  orbitMode: OrbitMode
  showNames: boolean
  tracksDisabled: boolean
  dockOpen: boolean
  drawerOpen: boolean
  notesOpen: boolean
  notes: Note[]
  noteIndex: number
  group: Group
  presets: string[][]
  preset: string
  deepClass: string
  search: string
}
