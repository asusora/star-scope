// Agol et al. (2021), tables 2, 5 and 6. Times use BJD_TDB − 2450000.
export const trappistPaper = 'https://doi.org/10.3847/PSJ/abd022'
export const trappistCatalog = 'https://exoplanetarchive.ipac.caltech.edu/overview/TRAPPIST-1'
export const trappistEntryId = 'trappist-1-e'
export const trappistEpoch = 7257.93115525
export const trappistSecondsPerDay = 8

export interface TrappistPlanet {
  key: string
  days: number
  axisAU: number
  radiusEarth: number
  inclination: number
  transit: number
  eCosW: number
  eSinW: number
  surface: string
  tint: string
}

// Surface maps and colors are artistic choices. All orbital axes share one scale.
export const trappistPlanets: TrappistPlanet[] = [
  { key: 'b', days: 1.510826, axisAU: 0.01154, radiusEarth: 1.116, inclination: 89.728,
    transit: 7257.55044, eCosW: -0.00215, eSinW: 0.00217, surface: 'Volcanic', tint: '#efa179' },
  { key: 'c', days: 2.421937, axisAU: 0.01580, radiusEarth: 1.097, inclination: 89.778,
    transit: 7258.58728, eCosW: 0.00055, eSinW: 0.00001, surface: 'Rock', tint: '#f1c39d' },
  { key: 'd', days: 4.049219, axisAU: 0.02227, radiusEarth: 0.788, inclination: 89.896,
    transit: 7257.06768, eCosW: -0.00496, eSinW: 0.00267, surface: 'Rock', tint: '#c7bd9d' },
  { key: 'e', days: 6.101013, axisAU: 0.02925, radiusEarth: 0.920, inclination: 89.793,
    transit: 7257.82771, eCosW: 0.00433, eSinW: -0.00461, surface: trappistEntryId, tint: '#b3cbce' },
  { key: 'f', days: 9.207540, axisAU: 0.03849, radiusEarth: 1.045, inclination: 89.740,
    transit: 7257.07426, eCosW: -0.00840, eSinW: -0.00051, surface: 'Icy', tint: '#a6c7ba' },
  { key: 'g', days: 12.352446, axisAU: 0.04683, radiusEarth: 1.129, inclination: 89.742,
    transit: 7257.71462, eCosW: 0.00380, eSinW: 0.00128, surface: 'Rock', tint: '#b8cbdc' },
  { key: 'h', days: 18.772866, axisAU: 0.06189, radiusEarth: 0.755, inclination: 89.805,
    transit: 7249.60676, eCosW: -0.00365, eSinW: -0.00002, surface: 'Icy', tint: '#c9d9f2' },
]
