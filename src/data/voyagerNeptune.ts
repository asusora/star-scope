import type { Moon } from '../scene/types'
import { clamp, tau, v3 } from '../scene/math'
import type { Vector3 } from 'three'

// JPL Horizons geometric vectors, J2000 ecliptic, Neptune center (500@899).
// Hours from 1989-08-25 00:00, then x/y/z in km. The atlas uses (x, z, −y).
const encounters = [
  [-12, -440037, 928487, -6222],
  [-6, -274210, 595755, 11127],
  [0, -104683, 254828, 28197],
  [2, -45470, 134588, 33148],
  [3, -14131, 69212, 34248],
  [3.5, 2356, 32289, 32612],
  [3 + 56 / 60, 15412, -4883, 24373],
  [4, 16821, -10761, 21848],
  [4.5, 21224, -48414, -2951],
  [5, 21496, -78344, -28674],
  [6, 19993, -130888, -77516],
  [8, 15584, -227180, -170105],
  [9 + 23 / 60, 12320, -291267, -232347],
  [12, 6045, -410074, -348176],
  [18, -8416, -677261, -609317],
  [24, -22849, -941305, -867654],
]
const yearHours = 365.25 * 24
const midnight = 2000 + (Date.UTC(1989, 7, 25) - Date.UTC(2000, 0, 1, 12)) / (yearHours * 3600000)
export const neptuneEncounter = midnight + (3 + 56 / 60) / yearHours
export const tritonEncounter = midnight + (9 + 23 / 60) / yearHours

// Triton's nearly circular retrograde orbit, phased to its Horizons state at the flyby.
const tritonRadial = v3(6308, -248483, 253178).normalize()
const tritonTangent = v3(-3.9956, 1.2463, 1.3224)
tritonTangent.addScaledVector(tritonRadial, -tritonRadial.dot(tritonTangent)).normalize()
export function epochTritonPosition(moon: Moon, year: number, out: Vector3) {
  const phase = (year - tritonEncounter) * 365.25 * tau / moon.period!
  return out.copy(tritonRadial).multiplyScalar(moon.orbit.a * Math.cos(phase))
    .addScaledVector(tritonTangent, moon.orbit.a * Math.sin(phase))
}

export function createNeptunePass(triton: Moon, planetAt: (year: number) => Vector3,
  mappedAt: (year: number) => Vector3) {
  const nearRadius = triton.parent.r * 1.65
  const farRadius = triton.orbit.a + 1.8
  const samples = encounters.map(([hour, x, y, z]) => {
    const year = midnight + hour / yearHours
    const vector = v3(x, z, -y)
    // Use the same magnified planet and satellite scales as the scene, preserving direction.
    const t = Math.log(vector.length() / 29200) / Math.log(triton.a / 29200)
    const pos = vector.setLength(nearRadius + (farRadius - nearRadius) * t).add(planetAt(year))
    return { year, pos, delta: pos.clone().sub(mappedAt(year)) }
  })
  const first = samples[0], last = samples[samples.length - 1]
  return {
    years: samples.map(s => s.year),
    apply(year: number, out: Vector3) {
      if (year < first.year || year > last.year) {
        const edge = year < first.year ? first : last
        const dt = (year - edge.year) / 0.35
        out.addScaledVector(edge.delta, Math.exp(-0.5 * dt * dt))
        return
      }
      const i = samples.findIndex(s => s.year >= year)
      const a = samples[Math.max(0, i - 1)], b = samples[i]
      const t = a === b ? 0 : clamp((year - a.year) / (b.year - a.year), 0, 1)
      out.lerpVectors(a.pos, b.pos, t)
    },
  }
}
