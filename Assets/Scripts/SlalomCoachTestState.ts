/**
 * SlalomCoachTestState - read-only window onto the running Lens, for LEAF tests and debugging.
 *
 * Owns: the latest snapshot, refreshed every frame by SlalomCoachMain.
 * Find it with SlalomCoachTestState.instance or on the SceneObject "SlalomCoachTestState".
 * Must not: drive behaviour. Nothing in the Lens reads from this.
 */

export interface SlalomCoachSnapshot {
  setupState: "choosing" | "ghost" | "placed" // "choosing" is no longer emitted: the ghost shows from launch
  /** Deprecated, kept so older tests still compile. Now the spacing as text, for example "1.0 m". */
  selectedSize: string
  sliderValueM: number
  sliderText: string
  ghostSpacingCm: number
  spacingMinM: number
  spacingMaxM: number
  panelPosition: {x: number; y: number; z: number} | null
  panelFacing: {x: number; y: number; z: number} | null
  panelDistanceFromEyeCm: number
  panelBelowEyeCm: number
  panelLeftOfViewCm: number
  panelFollowing: boolean
  panelHasFollowBehavior: boolean
  highlightedPoleThicknessCm: number
  otherPoleThicknessCm: number
  finishBandWidthCm: number
  finishBandDepthCm: number
  setupPanelVisible: boolean
  ghostVisible: boolean
  ghostPadPosition: {x: number; y: number; z: number} | null
  drillVisible: boolean
  floorY: number
  spacingCm: number
  measuredSpacingCm: number[]
  conePositions: {x: number; y: number; z: number}[]
  coneSides: number[]
  coneStates: string[]
  padCentre: {x: number; y: number; z: number} | null
  drillForward: {x: number; y: number; z: number} | null
  drillRight: {x: number; y: number; z: number} | null
  finishStationCm: number
  runPhase: string
  highlightedIndex: number
  clearedCount: number
  coneCount: number
  stripPosition: {x: number; y: number; z: number} | null
  stripCountText: string
  stepHintVisible: boolean
  celebrating: boolean
  finishHeadline: string
  finishDetail: string
  shardCount: number
  missPulsed: boolean
  celebrated: boolean
  cueText: string
  cueCount: number
  cueAlpha: number
  cueDisplayedText: string
  cueWorldPosition: {x: number; y: number; z: number} | null
  pathGlow: number
  distanceToPathCm: number
  arrowVisible: boolean
  arrowTarget: "none" | "pole" | "pad"
  arrowAngleDeg: number
  stanceCardVisible: boolean
  finishCardVisible: boolean
  finishScoreText: string
  skaterStationCm: number
  skaterLateralCm: number
  cameraPosition: {x: number; y: number; z: number}
}

@component
export class SlalomCoachTestState extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachTestState - readable state for tests</span>')
  @ui.separator
  @ui.group_start("Debug")
  @input
  @hint("Print each change of run phase, cone result and cue to the Logger")
  logChanges: boolean = false
  @ui.group_end

  static instance: SlalomCoachTestState | null = null

  private snapshot: SlalomCoachSnapshot | null = null

  onAwake(): void {
    SlalomCoachTestState.instance = this
  }

  publish(snapshot: SlalomCoachSnapshot): void {
    this.snapshot = snapshot
  }

  getSnapshot(): SlalomCoachSnapshot | null {
    return this.snapshot
  }

  log(message: string): void {
    if (this.logChanges) {
      print(`[SlalomCoach] ${message}`)
    }
  }
}
