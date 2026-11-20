import * as T from 'three'
const tau = 2 * Math.PI,
  rad = Math.PI / 180
const v3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z)
function seeded(seed: number) {
  let k = seed >>> 0
  return () => (k = (Math.imul(k, 1664525) + 1013904223) >>> 0) / 4294967296
}
// Two world-space basis vectors give every orbit its own plane and node.
function orbit(
  a: number,
  e: number,
  inc: number,
  node: number,
  peri: number,
  tilt: T.Quaternion | null = null,
) {
  const rot = new T.Quaternion().setFromEuler(new T.Euler(inc * rad, node * rad, 0, 'YXZ'))
  rot.multiply(new T.Quaternion().setFromAxisAngle(v3(0, 1, 0), peri * rad))
  if (tilt) rot.premultiply(tilt)
  return {
    a,
    e,
    u: v3(1, 0, 0).applyQuaternion(rot),
    v: v3(0, 0, -1).applyQuaternion(rot),
    b: a * Math.sqrt(1 - e * e),
  }
}
function orbitPoint(o: Orbit, E: number, out: T.Vector3) {
  return out
    .copy(o.u)
    .multiplyScalar(o.a * (Math.cos(E) - o.e))
    .addScaledVector(o.v, o.b * Math.sin(E))
}
function orbitalPosition(o: Orbit, M: number, out: T.Vector3) {
  M %= tau
  let E = M
  for (let i = 0; i < 3; i++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E))
  return orbitPoint(o, E, out)
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
export type Orbit = ReturnType<typeof orbit>
export { tau, rad, v3, seeded, orbit, orbitPoint, orbitalPosition, clamp }
