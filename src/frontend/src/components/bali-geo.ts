// Simplified coastlines (lat, lon) for the pixel map. Tune points by eye
// against a real map; the projection is linear over the bbox below.

export const MAP_W = 390
export const MAP_H = 300

const LAT_N = -8.05
const LAT_S = -8.90
const LON_W = 114.40
const LON_E = 116.12

export function project(lat: number, lon: number): { x: number, y: number } {
  const x = ((lon - LON_W) / (LON_E - LON_W)) * MAP_W
  const y = ((LAT_N - lat) / (LAT_N - LAT_S)) * MAP_H
  return { x: Math.round(x), y: Math.round(y) }
}

export type Poly = Array<[number, number]>

export const BALI: Poly = [
  [-8.17, 114.44], [-8.10, 114.50], [-8.09, 114.62], [-8.10, 114.80], [-8.11, 114.95],
  [-8.10, 115.09], [-8.12, 115.22], [-8.14, 115.34], [-8.22, 115.48], [-8.29, 115.62],
  [-8.40, 115.71], [-8.47, 115.62], [-8.52, 115.53], [-8.56, 115.46], [-8.62, 115.36],
  [-8.68, 115.29], [-8.72, 115.25], [-8.78, 115.24], [-8.82, 115.19], [-8.85, 115.12],
  [-8.83, 115.07], [-8.78, 115.10], [-8.74, 115.15], [-8.70, 115.16], [-8.65, 115.13],
  [-8.60, 115.07], [-8.53, 114.95], [-8.45, 114.80], [-8.37, 114.63], [-8.28, 114.52],
]

export const PENIDA: Poly = [
  [-8.67, 115.45], [-8.66, 115.55], [-8.70, 115.62], [-8.77, 115.61], [-8.80, 115.52], [-8.76, 115.46],
]

export const LEMBONGAN: Poly = [
  [-8.665, 115.43], [-8.665, 115.47], [-8.69, 115.47], [-8.69, 115.43],
]

export const GILI: Poly = [
  [-8.34, 116.02], [-8.34, 116.06], [-8.37, 116.06], [-8.37, 116.02],
]

export function toPath(poly: Poly): string {
  return `${poly.map(([lat, lon], i) => {
    const { x, y } = project(lat, lon)
    return `${i === 0 ? 'M' : 'L'}${x} ${y}`
  }).join(' ')} Z`
}
