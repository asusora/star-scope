import type * as T from 'three'
import { clamp } from '../math'
import type { SurfaceStatus } from '../types'
import { createTerrain, type Landscape } from './landscape'
import { walkable } from './ground'
import { createLandscapeView } from './view'

export function createExcursion(
  site: Landscape,
  renderer: T.WebGLRenderer | null,
  ctx: CanvasRenderingContext2D | null,
  reduced: boolean,
  requestDraw: () => void,
) {
  const terrain = createTerrain(site),
    cloud = site.kind === 'cloud',
    eye = cloud ? 23 : 1.7
  const view = createLandscapeView(site, terrain, renderer, ctx, requestDraw)
  const pose = { x: 0, z: 0, y: 0, heading: 0, pitch: -0.045 }
  const status: SurfaceStatus = {
    name: site.name,
    region: site.region,
    cloud,
    descending: !reduced,
    altitude: Math.round(eye),
    distance: 0,
    bearing: 0,
    veil: 0,
  }
  const orbitDuration = 0.9,
    duration = 2.8
  let elapsed = reduced ? duration : 0,
    forward = 0,
    right = 0,
    turn = 0,
    tilt = 0
  function drive(f: number, r: number, h: number, v: number) {
    forward = f
    right = r
    turn = h
    tilt = v
    requestDraw()
  }
  function look(dx: number, dy: number) {
    pose.heading += dx * 0.004
    pose.pitch = clamp(pose.pitch - dy * 0.0034, -1.25, 1.32)
    requestDraw()
  }
  function draw(
    delta: number,
    width: number,
    height: number,
    orbit: (t: number) => void,
    animate: boolean,
  ) {
    const dt = Math.min(0.08, delta)
    if (elapsed < duration || animate || forward || right || turn || tilt) elapsed += dt
    const descent = Math.min(1, Math.max(0, (elapsed - orbitDuration) / (duration - orbitDuration)))
    const altitude = eye + (cloud ? 220 : 135) * (1 - descent) ** 2.65
    status.descending = elapsed < duration
    status.veil =
      Math.round(
        100 *
          (elapsed < orbitDuration
            ? clamp((elapsed - orbitDuration + 0.22) / 0.22, 0, 1)
            : clamp(1 - (elapsed - orbitDuration) / 0.35, 0, 1)),
      ) / 100
    if (elapsed < orbitDuration) orbit(elapsed / orbitDuration)
    else {
      if (!status.descending) {
        pose.heading += turn * dt * 1.35
        pose.pitch = clamp(pose.pitch + tilt * dt, -1.25, 1.32)
        const speed = ((cloud ? 28 : 4.4) * dt) / Math.max(1, Math.hypot(forward, right))
        const sine = Math.sin(pose.heading),
          cos = Math.cos(pose.heading)
        const x = pose.x + (sine * forward + cos * right) * speed,
          z = pose.z + (-cos * forward + sine * right) * speed
        const canWalk = (nx: number, nz: number) =>
          cloud || (view.walkableAt ? view.walkableAt(nx, nz) : walkable(nx, nz, site.seed))
        if (canWalk(x, pose.z)) pose.x = x
        if (canWalk(pose.x, z)) pose.z = z
      }
      pose.y = terrain.height(pose.x, pose.z) + altitude
      view.draw({ ...pose, pitch: pose.pitch - 0.48 * (1 - descent) ** 2 }, width, height, elapsed)
    }
    status.altitude = Math.round(altitude * 10) / 10
    status.distance = Math.round(Math.hypot(pose.x, pose.z))
    status.bearing = ((Math.round((pose.heading * 180) / Math.PI) % 360) + 360) % 360
    return (
      status.descending || !!(forward || right || turn || tilt) || (cloud && animate && !reduced)
    )
  }
  return { status, look, drive, draw, dispose: view.dispose }
}
