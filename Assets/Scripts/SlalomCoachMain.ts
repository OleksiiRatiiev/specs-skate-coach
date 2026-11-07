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
import {CueId, RunEvent, SlalomCoachRunLogic, cueConeIndexes} from "./SlalomCoachRunLogic"
import {AMBER, CYAN, NeonButton, addNeonText} from "./SlalomCoachNeon"
import {COUNT_DEFAULT, COUNT_MAX, COUNT_MIN, SlalomCoachSetupPanelUI} from "./SlalomCoachSetupPanelUI"
import {SlalomCoachShards} from "./SlalomCoachShards"
import {SlalomCoachStanceCardUI} from "./SlalomCoachStanceCardUI"
import {SlalomCoachSnapshot, SlalomCoachTestState} from "./SlalomCoachTestState"
import {SlalomCoachVirtualFloor} from "./SlalomCoachVirtualFloor"

const STRIP_HEIGHT_CM = 125
const STRIP_TILT_BACK_RAD = (15 * Math.PI) / 180
// The strip's left edge stays at least this far off the drill line, so it can't cover the cones.
const STRIP_PATH_CLEAR_RAD = (9 * Math.PI) / 180
// Never further ahead of the wearer than this, in cm.
const STRIP_MAX_DEPTH_CM = 340
const STRIP_WIDTH_CM = 30
const STRIP_VIEW_MARGIN = 0.9
const STRIP_SCALE = 1.0
const CHANGE_BUTTON_W = 17
const CHANGE_BUTTON_H = 4.6
const STEP_HINT_HEIGHT_CM = 110
const STEP_HINT_TEXT = "STEP ONTO THE PAD"
const WAVE_STEP_SEC = 0.2
// How far ahead of the wearer the clean-run neon rain is centred, in cm.
const SHARD_RAIN_AHEAD_CM = 140
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
  @hint("Cue above cone ceil(N/2)+1")
  middleCue: string = "Bend knees"

  @input
  @hint("Cue above the last cone")
  exitCue: string = "Arms forward"

  @input
  @hint("Cue after staying off the path line")
  backToLineCue: string = "Back to line"

  @input
  @hint("Back to line cue: how far ahead of the skater along the drill it appears, in cm")
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

  @input
  @hint("Cone cues (Bend knees, Arms forward): height above the floor, in cm")
  @widget(new SliderWidget(80, 200, 5))
  coneCueHeightCm: number = 130

  @input
  @hint("Cone cues: sideways distance from the path line, in cm")
  @widget(new SliderWidget(0, 120, 5))
  coneCueSideCm: number = 50
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
  finishCardDistanceCm: number = 80

  @input
  @hint("How far below eye level the finish card floats, in cm")
  @widget(new SliderWidget(0, 40, 1))
  finishCardDropCm: number = 15

  @input
  @hint("Stance card distance to the left of the pad centre, in cm")
  @widget(new SliderWidget(40, 150, 5))
  stanceCardLeftCm: number = 70

  @input
  @hint("Stance card centre height above the floor, in cm")
  @widget(new SliderWidget(80, 180, 5))
  stanceCardFloorHeightCm: number = 120
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
  private coneCount = COUNT_DEFAULT
  private shards: SlalomCoachShards | null = null
  private stepHint: Text | null = null
  private celebrated = false
  private missPulsed = false
  private anchoredCue: "" | "middle" | "exit" = ""
  private changeButton: NeonButton | null = null
  private changeButtonWanted = false
  private frames = 0

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
    this.rebuildGhost()
    this.setupPanel.setSpacing(snapped)
    this.testState.log(`spacing ${snapped} m`)
  }

  /** Same action as pressing the cone count stepper. 4 to 12 cones. */
  setCount(n: number): void {
    if (this.setupState === "placed") {
      return
    }
    this.coneCount = Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(n)))
    this.rebuildGhost()
    this.setupPanel.setCount(this.coneCount)
    this.testState.log(`cones ${this.coneCount}`)
  }

  private rebuildGhost(): void {
    this.layout = this.layoutFor(this.coneCount, this.spacingM)
    this.ghost.build(this.layout)
    this.ghost.setVisible(true)
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
    this.placeChangeButton()
    this.celebrated = false
    this.missPulsed = false
    this.drill.clearEffects()

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
    this.hideStepHint()
    this.testState.log("again")
  }

  /** Same action as pinching "Change drill". Brings back the setup panel and the ghost. */
  changeDrill(): void {
    this.logic = null
    this.drill.clearEffects()
    this.shards?.stop()
    this.hideStepHint()
    this.drill.setVisible(false)
    this.cue.clear()
    this.anchoredCue = ""
    this.finishCard.setVisible(false)
    this.stanceCard.setVisible(false)
    this.setChangeButtonVisible(false)
    this.edgeArrow.hide()
    this.arrowTarget = "none"
    this.setupPanel.setVisible(true)
    this.setupState = "ghost"
    this.setupPanel.setCount(this.coneCount)
    this.setupPanel.setSpacing(this.spacingM)
    this.rebuildGhost()
    this.testState.log("change drill")
  }

  private start(): void {
    this.camera = this.cameraObject.getComponent("Component.Camera")
    this.cameraTransform = this.cameraObject.getTransform()

    this.setupPanel.onSpacingChanged.add((m) => this.setSpacing(m))
    this.setupPanel.onCountChanged.add((n) => this.setCount(n))
    this.setupPanel.onPlaceDrill.add(() => this.placeDrill())
    this.finishCard.onAgain.add(() => this.again())
    this.finishCard.onChangeDrill.add(() => this.changeDrill())
    this.setupPanel.getSceneObject().getTransform().setLocalScale(new vec3(STRIP_SCALE, STRIP_SCALE, STRIP_SCALE))
    this.buildChangeButton()

    this.drill.setVisible(false)
    this.stanceCard.setVisible(false)
    this.finishCard.setVisible(false)
    // The ghost shows from launch, at the slider's value.
    this.setupState = "ghost"
    this.spacingM = Math.min(1.5, Math.max(0.8, Math.round(this.defaultSpacingM * 10) / 10))
    this.coneCount = COUNT_DEFAULT
    this.setupPanel.setCount(this.coneCount)
    this.setupPanel.setSpacing(this.spacingM)
    this.rebuildGhost()

    this.shards = new SlalomCoachShards()
    const hint = addNeonText(this.getSceneObject(), STEP_HINT_TEXT, "Bold", 6, CYAN, {glow: true, spacing: 0.1, name: "StepOntoPadHint", position: vec3.zero()})
    hint.getSceneObject().enabled = false
    this.stepHint = hint

    this.createEvent("LateUpdateEvent").bind(() => this.tick(getDeltaTime()))
  }

  /** Small neon CHANGE DRILL button on the pad's near edge, tilted like the strip. */
  private buildChangeButton(): void {
    const root = global.scene.createSceneObject("ChangeDrillPadRoot")
    root.setParent(this.getSceneObject())
    this.changeButton = new NeonButton(root, "PadChangeDrillButton", "CHANGE DRILL", CHANGE_BUTTON_W, CHANGE_BUTTON_H, vec3.zero(), {
      style: "cyan",
      weight: "SemiBold",
      capCm: 1.25,
      spacing: 0.1,
    })
    this.changeButton.onPress.add(() => this.changeDrill())
  }

  /** Shown whenever a run isn't in progress once the drill is placed. UI Kit needs a frame or two enabled to start. */
  private setChangeButtonVisible(visible: boolean): void {
    this.changeButtonWanted = visible
    this.applyChangeButtonVisibility()
  }

  private applyChangeButtonVisibility(): void {
    if (this.changeButton && this.frames >= 3) {
      this.changeButton.object.getParent().enabled = this.changeButtonWanted
    }
  }

  private tick(dt: number): void {
    this.frames++
    this.applyChangeButtonVisibility()
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
      const yawRotation = quat.angleAxis(Math.atan2(-heading.x, -heading.z), vec3.up())
      transform.setWorldRotation(yawRotation)
      // The setup strip stands right of the pad, level with its near edge, 110 cm up, tilted back 15 degrees towards the wearer.
      const strip = this.setupPanel.getSceneObject().getTransform()
      const place = this.stripPlacement()
      const nearEdge = place.s
      const lateral = place.t
      const right = new vec3(-heading.z, 0, heading.x)
      strip.setWorldPosition(new vec3(origin.x + heading.x * nearEdge + right.x * lateral, origin.y + STRIP_HEIGHT_CM, origin.z + heading.z * nearEdge + right.z * lateral))
      strip.setWorldRotation(yawRotation.multiply(quat.angleAxis(-STRIP_TILT_BACK_RAD, vec3.right())))
    }
  }

  private hideStepHint(): void {
    if (this.stepHint) {
      this.stepHint.getSceneObject().enabled = false
    }
  }

  /** "STEP ONTO THE PAD" floats above the pad from placing until the skater stands on it. */
  private updateStepHint(eye: vec3): void {
    if (!this.stepHint) {
      return
    }
    const show = this.logic.phase === "Idle"
    const object = this.stepHint.getSceneObject()
    object.enabled = show
    if (show) {
      const transform = object.getTransform()
      const position = this.drillPoint(0, 0, STEP_HINT_HEIGHT_CM)
      transform.setWorldPosition(position)
      const toEye = new vec3(eye.x - position.x, 0, eye.z - position.z)
      if (toEye.length > 0.001) {
        transform.setWorldRotation(quat.lookAt(toEye.normalize(), vec3.up()))
      }
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
    this.setChangeButtonVisible(this.logic.phase !== "Running" && this.logic.phase !== "Finished")
    this.updateAnchoredCue(eye)
    this.updateStepHint(eye)
    this.drill.tickEffects(dt)
    this.shards?.tick(dt)

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
        const states = this.logic.coneStates.slice()
        this.finishCard.setResult(states)
        const transform = this.finishCard.getSceneObject().getTransform()
        transform.setWorldPosition(this.panelTarget(eye, heading, this.finishCardDistanceCm, this.finishCardDropCm))
        transform.setWorldRotation(this.faceCamera(transform.getWorldPosition(), eye))
        this.cardFollowing = false
        this.finishCard.setVisible(true)
        if (event.cleared === event.total) {
          // Clean run only: magenta frame, glitching headline, a wave of flashing poles, neon shards.
          this.celebrated = true
          this.finishCard.setCelebrating(true)
          this.drill.playWave(new vec3(1, 0.239, 0.941), new vec3(1, 1, 1), WAVE_STEP_SEC)
          // Neon rain just in front of the wearer and the card, where the narrow view can actually see it.
          const flat = new vec3(heading.x, 0, heading.z).normalize()
          const side = new vec3(-flat.z, 0, flat.x)
          const rainCentre = new vec3(eye.x + flat.x * SHARD_RAIN_AHEAD_CM, eye.y, eye.z + flat.z * SHARD_RAIN_AHEAD_CM)
          this.shards?.rain(rainCentre, side, flat, this.floorY)
        } else {
          this.missPulsed = true
          const missed: number[] = []
          states.forEach((state, i) => state === "missed" && missed.push(i))
          this.drill.pulseMissed(missed)
        }
        this.testState.log(`finished ${event.cleared}/${event.total}`)
        break
      }
    }
  }

  private applyRunReset(): void {
    this.drill.clearConeColours()
    this.drill.clearEffects()
    this.shards?.stop()
    this.celebrated = false
    this.missPulsed = false
    this.drill.setPathGlow(0)
    this.pathGlowTimer = 0
    this.cue.clear()
    this.anchoredCue = ""
    this.finishCard.setVisible(false)
    this.appliedHighlight = -2
  }

  /**
   * "Bend knees" floats above cone ceil(N/2)+1 and "Arms forward" above cone N. Each is visible from
   * the moment the skater has passed the cone two before it until its own cone is passed. A newer cue
   * replaces an older one.
   */
  private updateAnchoredCue(eye: vec3): void {
    const passed = this.logic.nextConeIndex
    const cones = cueConeIndexes(this.layout.coneS.length)
    let want: "" | "middle" | "exit" = ""
    if (this.logic.phase === "Running") {
      if (passed >= cones.exit - 1 && passed <= cones.exit) {
        want = "exit"
      } else if (passed >= cones.middle - 1 && passed <= cones.middle) {
        want = "middle"
      }
    }
    if (want === this.anchoredCue) {
      return
    }
    const previousText = this.anchoredCue === "exit" ? this.exitCue : this.middleCue
    this.anchoredCue = want
    if (want === "") {
      if (this.cue.getCueText() === previousText) {
        this.cue.hide()
      }
      return
    }
    const index = want === "exit" ? cones.exit : cones.middle
    const station = this.layout.coneS[index]
    const pathT = this.layout.pathLateralAt(station)
    const lateral = pathT - (pathT >= 0 ? 1 : -1) * this.coneCueSideCm
    const position = this.drillPoint(station, lateral, this.coneCueHeightCm)
    const toEye = new vec3(eye.x - position.x, 0, eye.z - position.z)
    const rotation = toEye.length > 0.001 ? quat.lookAt(toEye.normalize(), vec3.up()) : quat.quatIdentity()
    const text = want === "exit" ? this.exitCue : this.middleCue
    this.cue.showCue(text, position, rotation, true)
    this.testState.log(`cue ${text}`)
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

  /**
   * Where the setup strip and the CHANGE DRILL button sit, relative to the drill (s along it from the pad centre,
   * t to the right). The strip's right edge stays just inside the view and its left edge at least STRIP_PATH_CLEAR_RAD
   * off the drill line, so it never covers the cones; when that can't fit at the pad, it moves a little further ahead.
   */
  private stripPlacement(): {s: number; t: number} {
    const half = Math.atan(Math.tan(this.camera.fov / 2) * this.camera.aspect) * STRIP_VIEW_MARGIN
    const edge = Math.tan(half)
    const clear = Math.tan(STRIP_PATH_CLEAR_RAD)
    const needed = edge > clear ? STRIP_WIDTH_CM / (edge - clear) : STRIP_MAX_DEPTH_CM
    const depth = Math.min(STRIP_MAX_DEPTH_CM, Math.max(this.ghostAheadCm, needed))
    return {s: depth - this.ghostAheadCm, t: depth * edge - STRIP_WIDTH_CM / 2}
  }

  /** Right of the pad, level with its near edge, same height and tilt as the strip. */
  private placeChangeButton(): void {
    if (!this.changeButton) {
      return
    }
    const transform = this.changeButton.object.getParent().getTransform()
    const place = this.stripPlacement()
    transform.setWorldPosition(this.drillPoint(place.s, place.t, STRIP_HEIGHT_CM))
    const yaw = quat.angleAxis(this.drillYaw, vec3.up())
    transform.setWorldRotation(yaw.multiply(quat.angleAxis(-STRIP_TILT_BACK_RAD, vec3.right())))
  }

  private placeStanceCard(): void {
    const transform = this.stanceCard.getSceneObject().getTransform()
    transform.setWorldPosition(this.drillPoint(0, -this.stanceCardLeftCm, this.stanceCardFloorHeightCm))
    // To the left of the pad, facing across to its centre.
    transform.setWorldRotation(quat.lookAt(this.drillRight, vec3.up()))
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

  private layoutFor(coneCount: number, spacingM: number): DrillLayout {
    const key = coneCount * 1000 + Math.round(spacingM * 10)
    if (!this.layouts[key]) {
      this.layouts[key] = new DrillLayout({
        coneCount,
        spacingCm: Math.round(spacingM * 10) * 10,
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
      coneCount: this.coneCount,
      stripPosition: this.setupPanel.isVisible() ? toJson(this.setupPanel.getSceneObject().getTransform().getWorldPosition()) : null,
      stripCountText: this.setupPanel.getCountText(),
      stepHintVisible: !!this.stepHint && this.stepHint.getSceneObject().enabled,
      celebrating: this.finishCard.isCelebrating(),
      finishHeadline: this.finishCard.getHeadlineText(),
      finishDetail: this.finishCard.getDetailText(),
      shardCount: this.shards ? this.shards.getVisibleCount() : 0,
      missPulsed: this.missPulsed,
      celebrated: this.celebrated,
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
