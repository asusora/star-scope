// JPL SBDB heliocentric osculating elements, ecliptic J2000.
// a is in AU, i/ascending node/argument of perihelion are in degrees.
// Epoch is JD TDB. startDeg is an illustrative eccentric anomaly for the opening view.
export const comets = [
  { id: '1P', zh: '哈雷', startDeg: 30, en: 'Halley', epoch: 2439875.5, a: 17.928635, e: 0.967936,
    i: 162.19053, node: 59.09895, peri: 112.24143, color: 0x7adbc9 },
  { id: '2P', zh: '恩克', startDeg: 228, en: 'Encke', epoch: 2460654.5, a: 2.218283, e: 0.847024,
    i: 11.34077, node: 334.01348, peri: 187.28205, color: 0xe7b778 },
  { id: 'C/1995 O1', zh: '海尔–波普', startDeg: 334, en: 'Hale–Bopp', epoch: 2459837.5, a: 177.433384, e: 0.994981,
    i: 89.28759, node: 282.73342, peri: 130.41467, color: 0xa6abef },
  { id: 'C/2014 UN271', zh: '伯纳迪内利–伯恩斯坦', startDeg: 358.75, en: 'Bernardinelli–Bernstein', epoch: 2459635.5,
    a: 21286.0, e: 0.999486, i: 95.44, node: 190.01, peri: 326.28, color: 0x74c6ff },
] as const

export type Comet = (typeof comets)[number]
