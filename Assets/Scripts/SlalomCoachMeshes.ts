/**
 * SlalomCoachMeshes - code-authored geometry for the drill, floor and edge arrow.
 *
 * Owns: vertex and index generation. Sizes are in cm, so nodes stay at unit scale.
 * Must not: create SceneObjects or materials.
 */

import {PathSample} from "./SlalomCoachDrillLayout"

class MeshAccumulator {
  private vertices: number[] = []
  private indices: number[] = []
  private count = 0

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number = 0, v: number = 0): number {
    this.vertices.push(x, y, z, nx, ny, nz, u, v)
    return this.count++
  }

  tri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c)
  }

  build(): RenderMesh {
    const builder = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3, normalized: true},
      {name: "texture0", components: 2},
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    builder.appendVerticesInterleaved(this.vertices)
    builder.appendIndices(this.indices)
    builder.updateMesh()
    return builder.getMesh()
  }
}

/** Upward-facing quad, counter-clockwise seen from above. */
function addFlatQuad(m: MeshAccumulator, x0: number, x1: number, z0: number, z1: number, y: number): void {
  const a = m.vertex(x0, y, z0, 0, 1, 0, 0, 0)
  const b = m.vertex(x0, y, z1, 0, 1, 0, 0, 1)
  const c = m.vertex(x1, y, z1, 0, 1, 0, 1, 1)
  const d = m.vertex(x1, y, z0, 0, 1, 0, 1, 0)
  m.tri(a, b, c)
  m.tri(a, c, d)
}

/** Round frustum standing on y = 0, with a top cap. Covers both the cone and the pole. */
export function buildFrustumMesh(radiusBottom: number, radiusTop: number, height: number, segments: number): RenderMesh {
  const m = new MeshAccumulator()
  const slope = (radiusBottom - radiusTop) / height
  const normalLength = Math.sqrt(1 + slope * slope)
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2
    const a1 = ((i + 1) / segments) * Math.PI * 2
    const c0 = Math.cos(a0)
    const s0 = Math.sin(a0)
    const c1 = Math.cos(a1)
    const s1 = Math.sin(a1)
    const ny = slope / normalLength
    const nr = 1 / normalLength
    const bottom0 = m.vertex(c0 * radiusBottom, 0, s0 * radiusBottom, c0 * nr, ny, s0 * nr)
    const bottom1 = m.vertex(c1 * radiusBottom, 0, s1 * radiusBottom, c1 * nr, ny, s1 * nr)
    const top1 = m.vertex(c1 * radiusTop, height, s1 * radiusTop, c1 * nr, ny, s1 * nr)
    const top0 = m.vertex(c0 * radiusTop, height, s0 * radiusTop, c0 * nr, ny, s0 * nr)
    m.tri(bottom0, top0, top1)
    m.tri(bottom0, top1, bottom1)
    if (radiusTop > 0) {
      const centre = m.vertex(0, height, 0, 0, 1, 0)
      const cap0 = m.vertex(c0 * radiusTop, height, s0 * radiusTop, 0, 1, 0)
      const cap1 = m.vertex(c1 * radiusTop, height, s1 * radiusTop, 0, 1, 0)
      m.tri(centre, cap1, cap0)
    }
  }
  return m.build()
}

/** Flat rectangle centred on the origin. */
export function buildFlatRectMesh(widthX: number, depthZ: number, y: number): RenderMesh {
  const m = new MeshAccumulator()
  addFlatQuad(m, -widthX / 2, widthX / 2, -depthZ / 2, depthZ / 2, y)
  return m.build()
}

/** Hollow square outline, used for the start pad's bright edge. */
export function buildRectOutlineMesh(size: number, thickness: number, y: number): RenderMesh {
  const m = new MeshAccumulator()
  const h = size / 2
  addFlatQuad(m, -h, h, -h, -h + thickness, y)
  addFlatQuad(m, -h, h, h - thickness, h, y)
  addFlatQuad(m, -h, -h + thickness, -h + thickness, h - thickness, y)
  addFlatQuad(m, h - thickness, h, -h + thickness, h - thickness, y)
  return m.build()
}

/** Flat ribbon along the path samples. Drill space maps to local x = t, z = -s. */
export function buildRibbonMesh(samples: PathSample[], width: number, y: number): RenderMesh {
  const m = new MeshAccumulator()
  const half = width / 2
  let previousLeft = -1
  let previousRight = -1
  for (let i = 0; i < samples.length; i++) {
    const before = samples[Math.max(0, i - 1)]
    const after = samples[Math.min(samples.length - 1, i + 1)]
    const ds = after.s - before.s
    const dt = after.t - before.t
    const length = Math.sqrt(ds * ds + dt * dt) || 1
    const sideS = -dt / length
    const sideT = ds / length
    const sample = samples[i]
    const left = m.vertex(sample.t - sideT * half, y, -(sample.s - sideS * half), 0, 1, 0, 0, 0)
    const right = m.vertex(sample.t + sideT * half, y, -(sample.s + sideS * half), 0, 1, 0, 1, 0)
    if (i > 0) {
      m.tri(previousLeft, previousRight, right)
      m.tri(previousLeft, right, left)
    }
    previousLeft = left
    previousRight = right
  }
  return m.build()
}

/** Large floor sheet plus grid lines, so walking across it reads as movement. */
export function buildFloorMesh(sizeCm: number): RenderMesh {
  return buildFlatRectMesh(sizeCm, sizeCm, 0)
}

export function buildFloorGridMesh(sizeCm: number, stepCm: number, lineWidthCm: number, y: number): RenderMesh {
  const m = new MeshAccumulator()
  const half = sizeCm / 2
  const lines = Math.floor(half / stepCm)
  for (let i = -lines; i <= lines; i++) {
    const p = i * stepCm
    addFlatQuad(m, p - lineWidthCm / 2, p + lineWidthCm / 2, -half, half, y)
    addFlatQuad(m, -half, half, p - lineWidthCm / 2, p + lineWidthCm / 2, y)
  }
  return m.build()
}

/** Flat arrow in the local XY plane, facing +Z and pointing along +Y, centred on the origin. */
export function buildArrowMesh(width: number, height: number): RenderMesh {
  const m = new MeshAccumulator()
  const halfW = width / 2
  const halfH = height / 2
  const shoulderY = halfH - height * 0.5
  const stemHalf = width * 0.18
  const tip = m.vertex(0, halfH, 0, 0, 0, 1)
  const headLeft = m.vertex(-halfW, shoulderY, 0, 0, 0, 1)
  const headRight = m.vertex(halfW, shoulderY, 0, 0, 0, 1)
  m.tri(tip, headLeft, headRight)
  const stemTopLeft = m.vertex(-stemHalf, shoulderY, 0, 0, 0, 1)
  const stemTopRight = m.vertex(stemHalf, shoulderY, 0, 0, 0, 1)
  const stemBottomLeft = m.vertex(-stemHalf, -halfH, 0, 0, 0, 1)
  const stemBottomRight = m.vertex(stemHalf, -halfH, 0, 0, 0, 1)
  m.tri(stemTopLeft, stemBottomLeft, stemBottomRight)
  m.tri(stemTopLeft, stemBottomRight, stemTopRight)
  return m.build()
}
