import { clamp, seeded, tau } from '../math'
import { landingSunDirection, rgb, type Landscape, type Terrain } from './landscape'

// Latitude-longitude panorama shared by the hardware and software renderers.
export function makeSky(site: Landscape, terrain: Terrain) {
  const canvas = document.createElement('canvas')
  canvas.width = 1536
  canvas.height = 512
  const ctx = canvas.getContext('2d')!,
    image = ctx.createImageData(canvas.width, canvas.height)
  const [, , horizonColor, zenithColor, sunColor] = site.palette
  const horizon = rgb(horizonColor),
    zenith = rgb(zenithColor),
    solar = rgb(sunColor)
  const sunDir = landingSunDirection(site)
  const isMars = site.id === 'Mars'
  const airless =
    site.kind === 'craters' || (site.kind === 'ice' && site.id !== 'Titan') || site.id === 'Io'
  const clouds = site.kind === 'alpine' || site.kind === 'cloud'
  const cos = Float32Array.from(
    { length: canvas.width },
    (_, i) => -Math.cos(((i + 0.5) * tau) / canvas.width),
  )
  const sin = Float32Array.from({ length: canvas.width }, (_, i) =>
    Math.sin(((i + 0.5) * tau) / canvas.width),
  )
  for (let row = 0; row < canvas.height; row++) {
    const lat = (0.5 - (row + 0.5) / canvas.height) * Math.PI,
      y = Math.sin(lat),
      flat = Math.cos(lat)
    const altitude = clamp(Math.max(0, y) ** 0.54, 0, 1)
    const base = horizon.map((v, k) => v + (zenith[k] - v) * altitude)
    for (let col = 0; col < canvas.width; col++) {
      const x = cos[col] * flat,
        z = sin[col] * flat,
        dot = x * sunDir[0] + y * sunDir[1] + z * sunDir[2]
      const disk = clamp((dot - (isMars ? 0.99993 : 0.99986)) * (isMars ? 22000 : 13500), 0, 1)
      const glow = airless ? 0 : Math.max(0, dot) ** 22 * 0.2 + Math.max(0, dot) ** 650 * 0.34
      const marsBlue = isMars ? Math.max(0, dot) ** 48 * 0.24 : 0
      let cover = 0,
        lit = 0
      if (clouds && y > 0.015) {
        const u = (x / (y + 0.095)) * 1.6,
          v = (z / (y + 0.095)) * 1.65
        const cloud =
          terrain.noise(u + 11, v) * 0.52 +
          terrain.noise(u * 2.7, v * 2.7) * 0.27 +
          terrain.noise(u * 7.8, v * 7.8) * 0.14 +
          terrain.noise(u * 22, v * 22) * 0.07
        cover = clamp((cloud - 0.47) * 5.8, 0, 0.93) * Math.min(1, y * 12)
        lit = 0.72 + 0.25 * terrain.noise(u - 0.07, v - 0.055)
      }
      const i = (row * canvas.width + col) * 4
      const blueTint = [0.74, 0.83, 0.96]
      for (let k = 0; k < 3; k++) {
        let air = base[k] + (solar[k] - base[k]) * Math.min(1, disk + glow)
        if (marsBlue > 0) air += (blueTint[k] - air) * marsBlue
        image.data[i + k] = 255 * clamp(air + (lit * solar[k] - air) * cover, 0, 1)
      }
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  if (airless) {
    const random = seeded(site.seed)
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = 'rgba(220,225,239,' + (0.11 + random() * 0.29) + ')'
      ctx.fillRect(
        random() * canvas.width,
        random() * canvas.height * 0.48,
        0.65 + random() * 0.85,
        0.9,
      )
    }
  }
  return canvas
}
