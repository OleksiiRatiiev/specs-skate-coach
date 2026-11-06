/**
 * SlalomCoachRunLogic - the run state machine. Single owner of run state.
 *
 * Owns: run phase, next cone, each cone's result, cleared count, drift timer.
 * Input: the skater's drill-space position each frame.
 * Output: a list of events for the orchestrator to show.
 * Must not: touch the scene, timers or UI. Plain logic, so a test can step it directly.
 */

import {DrillLayout} from "./SlalomCoachDrillLayout"

export type RunPhase = "Idle" | "OnPad" | "Running" | "Finished"
export type ConeState = "pending" | "cleared" | "missed"
export type CueId = "entry" | "middle" | "exit" | "backToLine"

export type RunEvent =
  | {type: "reset"}
  | {type: "coneResult"; index: number; cleared: boolean}
  | {type: "cue"; cue: CueId}
  | {type: "driftPulse"}
  | {type: "finished"; cleared: number; total: number}

export interface RunTuning {
  /** Minimum distance past the cone's centre line to count as on its correct side. */
  sideClearanceCm: number
  driftDistanceCm: number
  driftHoldSec: number
  /** Extra margin before leaving the pad registers, so standing on the edge doesn't flicker. */
  padExitMarginCm: number
}

/** Cones whose line starts a new cue: middle at cone 2, exit at cone 5 (0-based here). */
const MIDDLE_CUE_CONE_INDEX = 1
const EXIT_CUE_CONE_INDEX = 4

export class SlalomCoachRunLogic {
  phase: RunPhase = "Idle"
  nextConeIndex = 0
  coneStates: ConeState[] = []
  onPad = false
  distanceToPath = 0

  private hasPrevious = false
  private previousS = 0
  private previousT = 0
  private isOffPath = false
  private offPathSec = 0
  private backToLineShown = false

  constructor(
    private layout: DrillLayout,
    private tuning: RunTuning
  ) {
    this.clearRun()
  }

  get clearedCount(): number {
    return this.coneStates.filter((state) => state === "cleared").length
  }

  get coneCount(): number {
    return this.layout.coneS.length
  }

  /** The cone whose pole is highlighted, or -1 once every cone has been passed. */
  get highlightedIndex(): number {
    return this.nextConeIndex < this.coneCount ? this.nextConeIndex : -1
  }

  /** "Again": reset without being on the pad. The skater walks back to start the next run. */
  resetToIdle(): void {
    this.clearRun()
    this.phase = this.onPad ? "OnPad" : "Idle"
  }

  update(s: number, t: number, dt: number): RunEvent[] {
    const events: RunEvent[] = []
    if (!this.hasPrevious) {
      this.previousS = s
      this.previousT = t
      this.hasPrevious = true
    }

    const margin = this.onPad ? this.tuning.padExitMarginCm : 0
    const nowOnPad = this.layout.isOnPad(s, t, margin)

    if (nowOnPad && !this.onPad) {
      this.clearRun()
      this.phase = "OnPad"
      events.push({type: "reset"})
    } else if (!nowOnPad && this.onPad) {
      this.phase = "Running"
      events.push({type: "cue", cue: "entry"})
    }
    this.onPad = nowOnPad

    if (this.phase === "Idle" && this.crossedStart(s)) {
      // Skirted the pad rather than crossing it. Still a run, still gets the entry cue.
      this.phase = "Running"
      events.push({type: "cue", cue: "entry"})
    }

    this.distanceToPath = this.layout.distanceToPath(s, t)

    if (this.phase === "Running") {
      this.evaluateCones(s, t, events)
      this.evaluateDrift(dt, events)
      if (s >= this.layout.finishS) {
        this.phase = "Finished"
        events.push({type: "finished", cleared: this.clearedCount, total: this.coneCount})
      }
    }

    this.previousS = s
    this.previousT = t
    return events
  }

  private crossedStart(s: number): boolean {
    const padFront = this.layout.padHalfCm
    const firstCone = this.layout.coneS[0]
    const crossedPadFront = this.previousS <= padFront && s > padFront
    const crossedFirstCone = this.previousS < firstCone && s >= firstCone
    return crossedPadFront || crossedFirstCone
  }

  private evaluateCones(s: number, t: number, events: RunEvent[]): void {
    while (this.nextConeIndex < this.coneCount && s >= this.layout.coneS[this.nextConeIndex]) {
      const index = this.nextConeIndex
      const coneS = this.layout.coneS[index]

      // Judge the side where the skater actually crossed the line, not where this frame ended.
      let crossingT = t
      if (this.previousS < coneS && s > this.previousS) {
        const u = (coneS - this.previousS) / (s - this.previousS)
        crossingT = this.previousT + (t - this.previousT) * u
      }

      const cleared = crossingT * this.layout.coneSide[index] >= this.tuning.sideClearanceCm
      this.coneStates[index] = cleared ? "cleared" : "missed"
      this.nextConeIndex++
      events.push({type: "coneResult", index, cleared})

      if (index === MIDDLE_CUE_CONE_INDEX) {
        events.push({type: "cue", cue: "middle"})
      } else if (index === EXIT_CUE_CONE_INDEX) {
        events.push({type: "cue", cue: "exit"})
      }
    }
  }

  private evaluateDrift(dt: number, events: RunEvent[]): void {
    const off = this.distanceToPath > this.tuning.driftDistanceCm
    if (off && !this.isOffPath) {
      this.offPathSec = 0
      this.backToLineShown = false
      events.push({type: "driftPulse"})
    }
    this.isOffPath = off
    if (!off) {
      return
    }
    this.offPathSec += dt
    if (!this.backToLineShown && this.offPathSec >= this.tuning.driftHoldSec) {
      this.backToLineShown = true
      events.push({type: "cue", cue: "backToLine"})
    }
  }

  private clearRun(): void {
    this.phase = "Idle"
    this.nextConeIndex = 0
    this.coneStates = this.layout.coneS.map((): ConeState => "pending")
    this.isOffPath = false
    this.offPathSec = 0
    this.backToLineShown = false
  }
}
