/**
 * SlalomCoachMain - orchestrator for the Slalom Coach drill.
 *
 * Owns: the setup state, the drill's placement in the world, the floor height and when each
 * surface shows. Run state lives in SlalomCoachRunLogic. Geometry lives in DrillLayout.
 * Expects: every @input wired by the scene (see References below).
 * Must not: draw UI itself. Panels are passive views driven through their public methods.
 * All position logic reads the camera's world position every frame, so a test can move the
 * camera through the drill.
 */

import {DrillLayout} from "./SlalomCoachDrillLayout"
import {SlalomCoachDrillView} from "./SlalomCoachDrillView"
import {SlalomCoachEdgeArrow} from "./SlalomCoachEdgeArrow"
import {SlalomCoachCueUI} from "./SlalomCoachCueUI"
import {SlalomCoachFinishCardUI} from "./SlalomCoachFinishCardUI"
import {CueId, RunEvent, SlalomCoachRunLogic} from "./SlalomCoachRunLogic"
import {SlalomCoachSetupPanelUI} from "./SlalomCoachSetupPanelUI"
import {SlalomCoachStanceCardUI} from "./SlalomCoachStanceCardUI"
import {SlalomCoachSnapshot, SlalomCoachTestState} from "./SlalomCoachTestState"
import {SlalomCoachVirtualFloor} from "./SlalomCoachVirtualFloor"

const CONE_COUNT = 6
const LAZY_FOLLOW_ANGLE_DEG = 35
const LAZY_FOLLOW_DISTANCE_MARGIN_CM = 30
const LAZY_FOLLOW_SPEED = 4

interface Vec3Json {
  x: number
  y: number
  z: number
}

function toJson(v: vec3): Vec3Json {
  return {x: v.x, y: v.y, z: v.z}
}

@component
export class SlalomCoachMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachMain - runs the drill flow</span>')
  @ui.separator

  @ui.group_start("References")
  @input
  @hint("The Camera Object. Its world position stands for the skater")
  cameraObject: SceneObject

  @input
  @hint("The placed drill")
  drill: SlalomCoachDrillView

  @input
  @hint("The faint ghost drill shown before placing")
  ghost: SlalomCoachDrillView

  @input
  @hint("Stand-in floor for the preview")
  floor: SlalomCoachVirtualFloor

  @input
  @hint("Setup panel")
  setupPanel: SlalomCoachSetupPanelUI

  @input
  @hint("Stance card")
  stanceCard: SlalomCoachStanceCardUI

  @input
  @hint("Cue text")
  cue: SlalomCoachCueUI

  @input
  @hint("Finish card")
  finishCard: SlalomCoachFinishCardUI

  @input
  @hint("Edge arrow under the camera")
  edgeArrow: SlalomCoachEdgeArrow

  @input
  @hint("Readable state for tests")
  testState: SlalomCoachTestState
  @ui.group_end

  @ui.separator
  @ui.group_start("Drill layout")
  @input
  @hint("Cone spacing at launch, in metres. The setup slider changes it afterwards")
  @widget(new SliderWidget(0.8, 1.5, 0.1))
  defaultSpacingM: number = 1.0

  @input
  @hint("Start pad width and depth, in cm")
  @widget(new SliderWidget(50, 200, 5))
  padSizeCm: number = 100

  @input
  @hint("Distance from the pad centre to cone 1, in cm")
  @widget(new SliderWidget(80, 300, 5))
  padToFirstConeCm: number = 150

  @input
  @hint("Distance from cone 6 to the finish line, in cm")
  @widget(new SliderWidget(50, 300, 5))
  finishPastLastConeCm: number = 100

  @input
  @hint("How far the path swings to each side of the cone line, in cm")
  @widget(new SliderWidget(20, 100, 5))
  pathSwingCm: number = 50
  @ui.group_end

  @ui.separator
  @ui.group_start("Run rules")
  @input
  @hint("How far past the cone's centre line counts as being on its correct side, in cm")
  @widget(new SliderWidget(0, 40, 1))
  sideClearanceCm: number = 8

  @input
  @hint("Distance from the path line that counts as drifting, in cm")
  @widget(new SliderWidget(50, 400, 10))
  driftDistanceCm: number = 150

  @input
  @hint("Seconds off the line before the Back to line cue")
  @widget(new SliderWidget(0.5, 6, 0.1))
  driftHoldSec: number = 2

  @input
  @hint("Seconds the path line stays bright after drifting away")
  @widget(new SliderWidget(0.2, 3, 0.1))
  driftPulseSec: number = 0.8

  @input
  @hint("Beyond this distance from the drill, the arrow points to the start pad, in cm")
  @widget(new SliderWidget(200, 1500, 50))
  farFromDrillCm: number = 500

  @input
  @hint("Keep the arrow quiet while skating forward along the drill, when the next pole is simply just ahead or below the narrow view. Off shows it whenever the target is outside the view's width")
  quietArrowWhileSkating: boolean = true
  @ui.group_end

  @ui.separator
  @ui.group_start("Cue wording and placement")
  @input
  @hint("Cue on leaving the start pad")
  entryCue: string = "Eyes up"

  @input
  @hint("Cue on reaching cone 2")
  middleCue: string = "Bend knees"

  @input
  @hint("Cue on reaching cone 5")
  exitCue: string = "Arms forward"

  @input
  @hint("Cue after staying off the path line")
  backToLineCue: string = "Back to line"

  @input
  @hint("How far ahead of the skater along the drill the cue appears, in cm")
  @widget(new SliderWidget(100, 400, 10))
  cueAheadCm: number = 250

  @input
  @hint("Cue height above the floor, in cm")
  @widget(new SliderWidget(60, 200, 5))
  cueHeightCm: number = 120

  @input
  @hint("Sideways offset from the path line, in cm")
  @widget(new SliderWidget(0, 120, 5))
  cueSideOffsetCm: number = 40
  @ui.group_end

  @ui.separator
  @ui.group_start("Surface placement")
  @input
  @hint("Estimated eye height, used to find the floor. The Lens does not sense the real ground")
  @widget(new SliderWidget(120, 200, 1))
  eyeHeightCm: number = 160

  @input
  @hint("Distance from the skater to the ghost's start pad, in cm")
  @widget(new SliderWidget(100, 400, 10))
  ghostAheadCm: number = 200

  @input
  @hint("Finish card distance, in cm")
  @widget(new SliderWidget(40, 110, 5))
  finishCardDistanceCm: number = 70

  @input
  @hint("How far below eye level the finish card floats, in cm")
  @widget(new SliderWidget(0, 40, 1))
  finishCardDropCm: number = 10

  @input
  @hint("Stance card distance from the pad centre along the drill, in cm")
  @widget(new SliderWidget(50, 200, 5))
  stanceCardAheadCm: number = 100

  @input
  @hint("Stance card centre height above the floor, in cm")
  @widget(new SliderWidget(80, 180, 5))
  stanceCardHeightCm: number = 147
  @ui.group_end

  private camera: Camera
  private cameraTransform: Transform
  private initialised = false
  private floorY = 0

  private setupState: "ghost" | "placed" = "ghost"
  private spacingM = 1.0
  private layouts: Record<number, DrillLayout> = {}
  private layout: DrillLayout | null = null
  private logic: SlalomCoachRunLogic | null = null

  private drillOrigin = vec3.zero()
  private drillForward = new vec3(0, 0, -1)
  private drillRight = new vec3(1, 0, 0)
  private drillYaw = 0
  private lastHeading = new vec3(0, 0, -1)

  private pathGlowTimer = 0
  private appliedHighlight = -2
  private cardFollowing = false
  private arrowTarget: "none" | "pole" | "pad" = "none"
  private lastPhase = ""

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  /** Same action as dragging the spacing slider. Metres, snapped to 0.1 m steps between 0.8 and 1.5. */
  setSpacing(m: number): void {
    if (this.setupState === "placed") {
      return
    }
    const snapped = Math.min(1.5, Math.max(0.8, Math.round(m * 10) / 10))
    this.spacingM = snapped
    this.layout = this.layoutFor(snapped)
    this.setupPanel.setSpacing(snapped)
    this.ghost.build(this.layout)
    this.ghost.setVisible(true)
    this.testState.log(`spacing ${snapped} m`)
  }

  /** Same action as pinching "Place drill". */
  placeDrill(): void {
    if (this.setupState !== "ghost" || !this.layout) {
      return
    }
    const ghostTransform = this.ghost.getSceneObject().getTransform()
    this.drillOrigin = ghostTransform.getWorldPosition()
    this.setDrillBasis(this.lastHeading)

    this.drill.build(this.layout)
    const drillTransform = this.drill.getSceneObject().getTransform()
    drillTransform.setWorldPosition(this.drillOrigin)
    drillTransform.setWorldRotation(quat.angleAxis(this.drillYaw, vec3.up()))
    this.drill.setVisible(true)
    this.drill.clearConeColours()
    this.drill.setPathGlow(0)

    this.ghost.setVisible(false)
    this.setupPanel.setVisible(false)
    this.placeStanceCard()

    this.logic = new SlalomCoachRunLogic(this.layout, {
      sideClearanceCm: this.sideClearanceCm,
      driftDistanceCm: this.driftDistanceCm,
      driftHoldSec: this.driftHoldSec,
      padExitMarginCm: 5,
    })
    this.appliedHighlight = -2
    this.setupState = "placed"
    this.testState.log("placed drill")
  }

  /** Same action as pinching "Again". */
  again(): void {
    if (!this.logic || !this.layout) {
      return
    }
    this.logic.resetToIdle()
    this.applyRunReset()
    this.testState.log("again")
  }

  /** Same action as pinching "Move drill". Brings back the setup panel and the ghost. */
  moveDrill(): void {
    this.logic = null
    this.drill.setVisible(false)
    this.cue.clear()
    this.finishCard.setVisible(false)
    this.stanceCard.setVisible(false)
    this.edgeArrow.hide()
    this.arrowTarget = "none"
    this.setupPanel.setVisible(true)
    this.setupState = "ghost"
    this.layout = this.layoutFor(this.spacingM)
    this.ghost.build(this.layout)
    this.ghost.setVisible(true)
    this.testState.log("move drill")
  }

  private start(): void {
    this.camera = this.cameraObject.getComponent("Component.Camera")
    this.cameraTransform = this.cameraObject.getTransform()

    this.setupPanel.onSpacingChanged.add((m) => this.setSpacing(m))
    this.setupPanel.onPlaceDrill.add(() => this.placeDrill())
    this.finishCard.onAgain.add(() => this.again())
    this.finishCard.onMoveDrill.add(() => this.moveDrill())

    this.drill.setVisible(false)
    this.stanceCard.setVisible(false)
    this.finishCard.setVisible(false)
    // The ghost shows from launch, at the slider's value.
    this.setupState = "ghost"
    this.spacingM = Math.min(1.5, Math.max(0.8, Math.round(this.defaultSpacingM * 10) / 10))
    this.layout = this.layoutFor(this.spacingM)
    this.setupPanel.setSpacing(this.spacingM)
    this.ghost.build(this.layout)
    this.ghost.setVisible(true)

    this.createEvent("LateUpdateEvent").bind(() => this.tick(getDeltaTime()))
  }

  private tick(dt: number): void {
    const eye = this.cameraTransform.getWorldPosition()
    const heading = this.currentHeading()

    if (!this.initialised) {
      this.initialised = true
      this.floorY = eye.y - this.eyeHeightCm
      this.floor.setFloorHeight(this.floorY)
      this.edgeArrow.placeForView(this.camera.fov)
    }

    if (this.setupState === "placed" && this.logic && this.layout) {
      this.tickRun(eye, heading, dt)
    } else {
      this.tickSetup(eye, heading)
    }
    this.publishSnapshot(eye)
  }

  private tickSetup(eye: vec3, heading: vec3): void {
    if (this.setupState === "ghost") {
      const origin = new vec3(eye.x + heading.x * this.ghostAheadCm, this.floorY, eye.z + heading.z * this.ghostAheadCm)
      const transform = this.ghost.getSceneObject().getTransform()
      transform.setWorldPosition(origin)
      transform.setWorldRotation(quat.angleAxis(Math.atan2(-heading.x, -heading.z), vec3.up()))
    }
  }

  private tickRun(eye: vec3, heading: vec3, dt: number): void {
    const toEye = eye.sub(this.drillOrigin)
    const s = toEye.x * this.drillForward.x + toEye.z * this.drillForward.z
    const t = toEye.x * this.drillRight.x + toEye.z * this.drillRight.z

    for (const event of this.logic.update(s, t, dt)) {
      this.handleRunEvent(event, s, t, eye, heading)
    }

    this.stanceCard.setVisible(this.logic.onPad)

    if (this.logic.highlightedIndex !== this.appliedHighlight) {
      this.appliedHighlight = this.logic.highlightedIndex
      this.drill.setHighlightedPole(this.appliedHighlight)
    }

    if (this.pathGlowTimer > 0) {
      this.pathGlowTimer = Math.max(0, this.pathGlowTimer - dt)
      this.drill.setPathGlow(this.pathGlowLevel())
    }

    if (this.logic.phase !== this.lastPhase) {
      this.lastPhase = this.logic.phase
      this.testState.log(`phase ${this.lastPhase}`)
    }

    if (this.finishCard.isVisible()) {
      this.cardFollowing = this.lazyFollow(this.finishCard.getSceneObject(), eye, heading, this.finishCardDistanceCm, this.finishCardDropCm, this.cardFollowing, dt)
    }

    this.updateEdgeArrow(s, t, eye, heading)
  }

  private handleRunEvent(event: RunEvent, s: number, t: number, eye: vec3, heading: vec3): void {
    switch (event.type) {
      case "reset":
        this.applyRunReset()
        break
      case "coneResult":
        if (!event.cleared) {
          this.drill.setConeMissed(event.index, true)
        }
        this.testState.log(`cone ${event.index + 1} ${event.cleared ? "cleared" : "missed"}`)
        break
      case "cue":
        this.showCue(event.cue, s, t, eye, heading)
        break
      case "driftPulse":
        this.pathGlowTimer = this.driftPulseSec
        this.drill.setPathGlow(1)
        this.testState.log("drift pulse")
        break
      case "finished": {
        this.finishCard.setScore(event.cleared, event.total)
        const transform = this.finishCard.getSceneObject().getTransform()
        transform.setWorldPosition(this.panelTarget(eye, heading, this.finishCardDistanceCm, this.finishCardDropCm))
        transform.setWorldRotation(this.faceCamera(transform.getWorldPosition(), eye))
        this.cardFollowing = false
        this.finishCard.setVisible(true)
        this.testState.log(`finished ${event.cleared}/${event.total}`)
        break
      }
    }
  }

  private applyRunReset(): void {
    this.drill.clearConeColours()
    this.drill.setPathGlow(0)
    this.pathGlowTimer = 0
    this.cue.clear()
    this.finishCard.setVisible(false)
    this.appliedHighlight = -2
  }

  private showCue(cue: CueId, s: number, t: number, eye: vec3, heading: vec3): void {
    const ahead = heading.x * this.drillForward.x + heading.z * this.drillForward.z >= 0 ? 1 : -1
    const station = Math.min(this.layout.finishS + 100, Math.max(-this.layout.padHalfCm, s + ahead * this.cueAheadCm))
    const pathT = this.layout.pathLateralAt(station)
    // Beside the line, on whichever side is closer to the skater, so it fits the narrow view.
    const towardsMiddle = pathT + (pathT > 0 ? -1 : 1) * this.cueSideOffsetCm
    const awayFromMiddle = pathT + (pathT > 0 ? 1 : -1) * this.cueSideOffsetCm
    const lateral = Math.abs(awayFromMiddle - t) < Math.abs(towardsMiddle - t) ? awayFromMiddle : towardsMiddle
    const position = this.drillPoint(station, lateral, this.cueHeightCm)

    const toEye = new vec3(eye.x - position.x, 0, eye.z - position.z)
    const rotation = toEye.length > 0.001 ? quat.lookAt(toEye.normalize(), vec3.up()) : quat.quatIdentity()
    const text = this.cueString(cue)
    this.cue.showCue(text, position, rotation)
    this.testState.log(`cue ${text}`)
  }

  private cueString(cue: CueId): string {
    switch (cue) {
      case "entry":
        return this.entryCue
      case "middle":
        return this.middleCue
      case "exit":
        return this.exitCue
      case "backToLine":
        return this.backToLineCue
    }
  }

  private updateEdgeArrow(s: number, t: number, eye: vec3, heading: vec3): void {
    const highlighted = this.logic.highlightedIndex
    const farAway = this.layout.distanceToDrill(s, t) > this.farFromDrillCm
    let target: "none" | "pole" | "pad" = "none"
    if (this.logic.phase !== "Finished" || highlighted >= 0) {
      target = farAway ? "pad" : highlighted >= 0 ? "pole" : "none"
    }
    if (target === "none") {
      this.edgeArrow.hide()
      this.arrowTarget = "none"
      return
    }

    const base = target === "pad" ? this.drillOrigin : this.drill.getPoleWorldPosition(highlighted)
    const height = target === "pad" ? 0 : this.drill.poleHeightCm

    if (this.isFacing(base, eye, heading) || (target === "pole" && this.isSkatingTowards(highlighted, s, t, heading))) {
      this.edgeArrow.hide()
      this.arrowTarget = "none"
      return
    }

    const toLocal = this.cameraTransform.getInvertedWorldTransform()
    const local = toLocal.multiplyPoint(new vec3(base.x, base.y + height / 2, base.z))
    // Turning is what fixes this, so the arrow mostly reads left or right.
    let dirX = local.x
    let dirY = local.y * 0.35
    if (local.z > 0) {
      // Behind the head: point straight sideways, which says which way to turn.
      dirX = local.x >= 0 ? 1 : -1
      dirY = 0
    }
    this.edgeArrow.showPointing(dirX, dirY)
    this.arrowTarget = target
  }

  /**
   * In view means within the view's width. Height is ignored on purpose: the view is so narrow
   * (about 37 degrees tall) that a pole within about 1.8 m sits below it even when facing it
   * squarely, and the arrow has to clear once the wearer faces the pole again.
   */
  private isFacing(target: vec3, eye: vec3, heading: vec3): boolean {
    const toTarget = new vec3(target.x - eye.x, 0, target.z - eye.z)
    const length = toTarget.length
    if (length < 0.001) {
      return true
    }
    const cos = (toTarget.x * heading.x + toTarget.z * heading.z) / length
    const angle = Math.acos(Math.min(1, Math.max(-1, cos)))
    const halfWidth = Math.atan(Math.tan(this.camera.fov / 2) * this.camera.aspect)
    return angle <= halfWidth
  }

  /** True on a normal weave: facing up the drill, in the lane, with the next pole still ahead. */
  private isSkatingTowards(index: number, s: number, t: number, heading: vec3): boolean {
    if (!this.quietArrowWhileSkating) {
      return false
    }
    const facingUpDrill = heading.x * this.drillForward.x + heading.z * this.drillForward.z >= 0.5
    return facingUpDrill && s < this.layout.coneS[index] && Math.abs(t) <= this.driftDistanceCm
  }

  private placeStanceCard(): void {
    const transform = this.stanceCard.getSceneObject().getTransform()
    transform.setWorldPosition(this.drillPoint(this.stanceCardAheadCm, 0, this.stanceCardHeightCm))
    // Facing back along the drill, towards the pad.
    transform.setWorldRotation(quat.lookAt(this.drillForward.uniformScale(-1), vec3.up()))
  }

  private drillPoint(s: number, t: number, heightAboveFloor: number): vec3 {
    return new vec3(
      this.drillOrigin.x + this.drillForward.x * s + this.drillRight.x * t,
      this.floorY + heightAboveFloor,
      this.drillOrigin.z + this.drillForward.z * s + this.drillRight.z * t
    )
  }

  private setDrillBasis(heading: vec3): void {
    this.drillForward = heading
    this.drillYaw = Math.atan2(-heading.x, -heading.z)
    this.drillRight = new vec3(-heading.z, 0, heading.x)
  }

  private layoutFor(spacingM: number): DrillLayout {
    const key = Math.round(spacingM * 10)
    if (!this.layouts[key]) {
      this.layouts[key] = new DrillLayout({
        coneCount: CONE_COUNT,
        spacingCm: key * 10,
        padSizeCm: this.padSizeCm,
        padToFirstConeCm: this.padToFirstConeCm,
        finishPastLastConeCm: this.finishPastLastConeCm,
        pathSwingCm: this.pathSwingCm,
      })
    }
    return this.layouts[key]
  }

  /** The way the wearer faces, flattened onto the floor. Holds its last value when looking straight down. */
  private currentHeading(): vec3 {
    const look = this.cameraTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const flat = new vec3(look.x, 0, look.z)
    if (flat.length > 0.15) {
      this.lastHeading = flat.normalize()
    }
    return this.lastHeading
  }

  private panelTarget(eye: vec3, heading: vec3, distance: number, drop: number): vec3 {
    return new vec3(eye.x + heading.x * distance, eye.y - drop, eye.z + heading.z * distance)
  }

  private faceCamera(position: vec3, eye: vec3): quat {
    return quat.lookAt(eye.sub(position).normalize(), vec3.up())
  }

  /**
   * Panels stay put in the world, and only drift back in front of the wearer once they have
   * turned or moved well away. This keeps pinch targets reachable without head-locking them.
   */
  private lazyFollow(object: SceneObject, eye: vec3, heading: vec3, distance: number, drop: number, following: boolean, dt: number): boolean {
    const transform = object.getTransform()
    const current = transform.getWorldPosition()
    const target = this.panelTarget(eye, heading, distance, drop)
    const offset = new vec3(current.x - eye.x, 0, current.z - eye.z)
    const offsetLength = offset.length
    const cos = offsetLength > 0.001 ? (offset.x * heading.x + offset.z * heading.z) / offsetLength : 1
    const angleDeg = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
    let moving = following
    if (angleDeg > LAZY_FOLLOW_ANGLE_DEG || Math.abs(offsetLength - distance) > LAZY_FOLLOW_DISTANCE_MARGIN_CM) {
      moving = true
    }
    if (moving) {
      const next = vec3.lerp(current, target, Math.min(1, dt * LAZY_FOLLOW_SPEED))
      transform.setWorldPosition(next)
      if (next.distance(target) < 2) {
        moving = false
      }
    }
    transform.setWorldRotation(this.faceCamera(transform.getWorldPosition(), eye))
    return moving
  }

  private pathGlowLevel(): number {
    return this.driftPulseSec > 0 ? this.pathGlowTimer / this.driftPulseSec : 0
  }

  private publishSnapshot(eye: vec3): void {
    const layout = this.layout
    const placed = this.setupState === "placed" && !!this.logic && !!layout
    const panelTransform = this.setupPanel.getSceneObject().getTransform()
    const panelPos = this.setupPanel.isVisible() ? panelTransform.getWorldPosition() : null
    const panelFacing = panelTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, 1))
    const toEye = eye.sub(this.drillOrigin)
    const conePositions: Vec3Json[] = []
    const measured: number[] = []
    if (placed) {
      for (let i = 0; i < layout.coneS.length; i++) {
        const position = this.drill.getConeWorldPosition(i)
        conePositions.push(toJson(position))
        if (i > 0) {
          measured.push(position.distance(this.drill.getConeWorldPosition(i - 1)))
        }
      }
    }
    const snapshot: SlalomCoachSnapshot = {
      setupState: this.setupState,
      selectedSize: `${this.spacingM.toFixed(1)} m`,
      sliderValueM: this.setupPanel.getSpacing(),
      sliderText: this.setupPanel.getValueText(),
      ghostSpacingCm: this.ghost.isVisible() && layout ? layout.config.spacingCm : 0,
      spacingMinM: 0.8,
      spacingMaxM: 1.5,
      panelPosition: panelPos ? toJson(panelPos) : null,
      panelFacing: panelPos ? toJson(panelFacing) : null,
      panelDistanceFromEyeCm: panelPos ? panelPos.distance(eye) : 0,
      panelBelowEyeCm: panelPos ? eye.y - panelPos.y : 0,
      panelLeftOfViewCm: panelPos ? -panelPos.sub(eye).dot(this.cameraTransform.right) : 0,
      panelFollowing: this.setupPanel.isFollowing(),
      panelHasFollowBehavior: this.setupPanel.hasFollowBehavior(),
      highlightedPoleThicknessCm: this.drill.getHighlightPoleThicknessCm(),
      otherPoleThicknessCm: this.drill.getPoleThicknessCm(),
      finishBandWidthCm: this.padSizeCm,
      finishBandDepthCm: this.drill.getFinishBandDepthCm(),
      setupPanelVisible: this.setupPanel.isVisible(),
      ghostVisible: this.ghost.isVisible(),
      ghostPadPosition: this.ghost.isVisible() ? toJson(this.ghost.getSceneObject().getTransform().getWorldPosition()) : null,
      drillVisible: this.drill.isVisible(),
      floorY: this.floorY,
      spacingCm: layout ? layout.config.spacingCm : 0,
      measuredSpacingCm: measured,
      conePositions,
      coneSides: layout ? layout.coneSide.slice() : [],
      coneStates: placed ? this.logic.coneStates.slice() : [],
      padCentre: placed ? toJson(this.drillOrigin) : null,
      drillForward: placed ? toJson(this.drillForward) : null,
      drillRight: placed ? toJson(this.drillRight) : null,
      finishStationCm: layout ? layout.finishS : 0,
      runPhase: placed ? this.logic.phase : "",
      highlightedIndex: placed ? this.logic.highlightedIndex : -1,
      clearedCount: placed ? this.logic.clearedCount : 0,
      coneCount: CONE_COUNT,
      cueText: this.cue.getCueText(),
      cueCount: this.cue.getCueCount(),
      cueAlpha: this.cue.getAlpha(),
      cueDisplayedText: this.cue.getDisplayedText(),
      cueWorldPosition: this.cue.getCueCount() > 0 ? toJson(this.cue.getWorldPosition()) : null,
      pathGlow: this.pathGlowLevel(),
      distanceToPathCm: placed ? this.logic.distanceToPath : 0,
      arrowVisible: this.edgeArrow.isVisible(),
      arrowTarget: this.arrowTarget,
      arrowAngleDeg: this.edgeArrow.getAngleDeg(),
      stanceCardVisible: this.stanceCard.isVisible(),
      finishCardVisible: this.finishCard.isVisible(),
      finishScoreText: this.finishCard.getScoreText(),
      skaterStationCm: placed ? toEye.x * this.drillForward.x + toEye.z * this.drillForward.z : 0,
      skaterLateralCm: placed ? toEye.x * this.drillRight.x + toEye.z * this.drillRight.z : 0,
      cameraPosition: toJson(eye),
    }
    this.testState.publish(snapshot)
  }
}
