/** Small 3D vector helpers. The cube sits at the origin with every piece at integer coordinates in -1..1. */
export type Vec3 = readonly [number, number, number]

/** A rotation as a 3×3 matrix, row by row. */
export type Mat3 = readonly [Vec3, Vec3, Vec3]

export const IDENTITY: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

export const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]]

export const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k]

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const equals = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

export const transform = (m: Mat3, v: Vec3): Vec3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)]

/** A quarter turn of v about the unit axis a, clockwise when looking at the origin from the tip of a. */
export const quarterTurn = (v: Vec3, a: Vec3): Vec3 => add(scale(a, dot(a, v)), cross(a, v), -1)

/** The rotation that applies m first and then f. */
export function thenApply(m: Mat3, f: (v: Vec3) => Vec3): Mat3 {
  const columns = [0, 1, 2].map(j => f([m[0][j], m[1][j], m[2][j]]))
  const row = (r: number): Vec3 => [columns[0][r], columns[1][r], columns[2][r]]
  return [row(0), row(1), row(2)]
}
