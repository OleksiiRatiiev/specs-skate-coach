/**
 * SlalomCoachDrillLayout - pure geometry for one drill size.
 *
 * Owns: cone stations, correct sides, the path curve and distance-to-path maths.
 * Coordinates: drill space, origin at the start pad centre, on the floor.
 *   s = cm along the drill (towards cone 1 and the finish).
 *   t = cm sideways, positive to the skater's right.
 * Must not: touch the scene. This is plain logic so it stays easy to reason about.
 */

export interface DrillLayoutConfig {
  coneCount: number
  spacingCm: number
  padSizeCm: number
  padToFirstConeCm: number
  finishPastLastConeCm: number
  pathSwingCm: number
}

export interface PathSample {
  s: number
  t: number
}

const PATH_SAMPLE_STEP_CM = 10

export class DrillLayout {
  readonly config: DrillLayoutConfig
  readonly coneS: number[] = []
  /** -1 = the skater must pass on the left of the cone, +1 = on the right. */
  readonly coneSide: number[] = []
  readonly padHalfCm: number
  readonly pathStartS: number
  readonly finishS: number
  readonly pathSamples: PathSample[] = []

  private readonly knots: PathSample[] = []

  constructor(config: DrillLayoutConfig) {
    this.config = config
    this.padHalfCm = config.padSizeCm / 2
    this.pathStartS = this.padHalfCm

    for (let i = 0; i < config.coneCount; i++) {
      this.coneS.push(config.padToFirstConeCm + i * config.spacingCm)
      this.coneSide.push(i % 2 === 0 ? -1 : 1)
    }
    this.finishS = this.coneS[this.coneS.length - 1] + config.finishPastLastConeCm

    this.knots.push({s: this.pathStartS, t: 0})
    for (let i = 0; i < config.coneCount; i++) {
      this.knots.push({s: this.coneS[i], t: this.coneSide[i] * config.pathSwingCm})
    }
    this.knots.push({s: this.finishS, t: 0})

    for (let s = this.pathStartS; s < this.finishS; s += PATH_SAMPLE_STEP_CM) {
      this.pathSamples.push({s, t: this.pathLateralAt(s)})
    }
    this.pathSamples.push({s: this.finishS, t: 0})
  }

  /** Sideways offset of the path line at station s. Eased so the line weaves smoothly. */
  pathLateralAt(s: number): number {
    if (s <= this.knots[0].s || s >= this.knots[this.knots.length - 1].s) {
      return 0
    }
    for (let i = 0; i < this.knots.length - 1; i++) {
      const a = this.knots[i]
      const b = this.knots[i + 1]
      if (s <= b.s) {
        const u = (s - a.s) / (b.s - a.s)
        const eased = u * u * (3 - 2 * u)
        return a.t + (b.t - a.t) * eased
      }
    }
    return 0
  }

  /** Shortest floor distance from a drill-space point to the path line, in cm. */
  distanceToPath(s: number, t: number): number {
    let best = Number.MAX_VALUE
    for (let i = 0; i < this.pathSamples.length - 1; i++) {
      const a = this.pathSamples[i]
      const b = this.pathSamples[i + 1]
      const ds = b.s - a.s
      const dt = b.t - a.t
      const lengthSq = ds * ds + dt * dt
      const u = lengthSq > 0 ? Math.min(1, Math.max(0, ((s - a.s) * ds + (t - a.t) * dt) / lengthSq)) : 0
      const px = a.s + ds * u - s
      const py = a.t + dt * u - t
      const d = px * px + py * py
      if (d < best) {
        best = d
      }
    }
    return Math.sqrt(best)
  }

  /** Shortest floor distance to the drill's footprint (pad to finish line), in cm. */
  distanceToDrill(s: number, t: number): number {
    const halfWidth = Math.max(this.padHalfCm, this.config.pathSwingCm)
    const ds = s < -this.padHalfCm ? -this.padHalfCm - s : s > this.finishS ? s - this.finishS : 0
    const dt = Math.max(0, Math.abs(t) - halfWidth)
    return Math.sqrt(ds * ds + dt * dt)
  }

  isOnPad(s: number, t: number, marginCm: number): boolean {
    const half = this.padHalfCm + marginCm
    return Math.abs(s) <= half && Math.abs(t) <= half
  }
}
