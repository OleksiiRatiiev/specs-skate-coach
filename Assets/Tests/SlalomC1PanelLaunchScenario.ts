/**
 * Criterion 1, part 1: what is on screen at launch. No pinch. Measures the setup panel's size, distance,
 * drop and side, its texts and controls, whether the slider and Place drill button are inside the real
 * camera frustum and within the simulated arm's reach, and the ghost drill (from launch, about 2 m
 * ahead, turning with the view). Nothing in the scene is moved to make a check pass.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  allTexts,
  boundsOf,
  buttonNamed,
  Checks,
  colorOf,
  CONE_COUNT,
  DrillParts,
  findRequired,
  fmt,
  fmtV,
  frames,
  frustumOf,
  luminance,
  SkaterRig,
  snap,
  v3,
  waitForLens,
} from "./SlalomLeafHarness"

function isUnder(object: SceneObject, ancestorName: string): boolean {
  let current: SceneObject | null = object
  while (current) {
    if (current.name === ancestorName) {
      return true
    }
    current = current.hasParent() ? current.getParent() : null
  }
  return false
}

@component
export class SlalomC1PanelLaunchScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("c1_panel_launch")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    c.info("camera", `eye=${fmtV(rig.actualEye())} pitchDown=${fmt(rig.pitchDownDeg())} basePitchDown=${fmt(-rig.basePitchDeg)} fovDeg=${fmt((rig.camera.fov * 180) / Math.PI)} aspect=${fmt(rig.camera.aspect)}`)
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)

    const state = snap()
    c.ok("launch: setup state is ghost, drill not placed", state.setupState === "ghost" && !state.drillVisible, `state=${state.setupState} drill=${state.drillVisible}`)
    c.ok("launch: panel shows", state.setupPanelVisible && findRequired("SetupPanel").isEnabledInHierarchy)
    c.ok("launch: panel has the lazy follow behaviour", state.panelHasFollowBehavior)

    // The controls the brief names, and none of the old ones.
    for (const old of ["EasyButton", "StandardButton", "PlaceHereButton"]) {
      c.ok(`launch: old control ${old} is gone`, !findSceneObjectByName(old))
    }
    for (const name of ["SpacingSliderCell", "PlaceDrillButton", "SpacingValue", "GrabBar", "Backing"]) {
      c.ok(`launch: ${name} exists`, !!findSceneObjectByName(name))
    }
    const sliderObject = findRequired("SpacingSliderCell")
    const slider = sliderObject.getComponent(Slider.getTypeName()) as Slider
    const button = buttonNamed("PlaceDrillButton")
    c.ok("launch: slider is a UI Kit Slider with a live Interactable", !!slider && !!findInteractableByName("SpacingSliderCell", undefined, true))
    c.ok("launch: Place drill is a UI Kit Button with a live Interactable", !!button && !!findInteractableByName("PlaceDrillButton", undefined, true))
    c.ok("launch: Place drill is not a toggle and is active", button.isOn === false && button.inactive === false)
    c.ok("launch: slider is segmented into 8 values", slider.numberOfSegments === 8 && slider.segmented, `segments=${slider.numberOfSegments} segmented=${slider.segmented}`)
    c.near("launch: slider starts at 1.0 m (value 2/7)", slider.currentValue, 2 / 7, 0.001)

    // Texts, read from the real Text components under the panel.
    const panelTexts = allTexts().filter((text) => text.getSceneObject().isEnabledInHierarchy && isUnder(text.getSceneObject(), "SetupPanel"))
    const shown = panelTexts.map((text) => text.text)
    c.info("panel texts", JSON.stringify(shown))
    for (const wanted of ["Slalom Coach AR", "Set spacing, then place the drill", "Cone spacing: 1.0 m", "Place drill"]) {
      const count = shown.filter((text) => text === wanted).length
      c.ok(`launch: text '${wanted}' shows once`, count === 1, `count=${count}`)
    }
    c.ok("launch: the snapshot's slider text matches the Text component", state.sliderText === "Cone spacing: 1.0 m" && state.sliderValueM === 1.0, `text='${state.sliderText}' value=${state.sliderValueM}`)
    for (const text of panelTexts) {
      const fill = text.textFill.color
      c.ok(`launch: text '${text.text}' is light, so it shows on the additive display`, luminance(fill) > 0.7 && fill.w > 0.5, `colour=(${fmt(fill.x)},${fmt(fill.y)},${fmt(fill.z)},${fmt(fill.w)})`)
    }

    // Panel placement from the snapshot and from the real objects.
    const eye = rig.actualEye()
    const panelPosition = v3(state.panelPosition)
    const horizontal = new vec3(panelPosition.x - eye.x, 0, panelPosition.z - eye.z).length
    c.between("panel: about 60 cm ahead, measured along the floor", horizontal, 55, 65)
    c.between("panel: about 60 cm away in a straight line (plus or minus 10 percent)", state.panelDistanceFromEyeCm, 54, 66)
    c.between("panel: about 25 cm below eye level", state.panelBelowEyeCm, 20, 30)
    c.between("panel: slightly to the left, cm", state.panelLeftOfViewCm, 1, 15)
    c.near("snapshot distance matches the real transform", panelPosition.distance(eye), state.panelDistanceFromEyeCm, 0.5)
    const toEye = eye.sub(panelPosition).normalize()
    c.ok("panel: faces the wearer", v3(state.panelFacing).dot(toEye) > 0.9, `facingDotToEye=${fmt(v3(state.panelFacing).dot(toEye))}`)
    const backingObject = findRequired("Backing")
    const backingBounds = boundsOf(backingObject)
    const backingRect = backingObject.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    const backingScale = backingObject.getTransform().getWorldScale()
    const rectWidth = backingRect.size.x * backingScale.x
    const rectHeight = backingRect.size.y * backingScale.y
    c.info("backing", `componentSize=(${fmt(backingRect.size.x)},${fmt(backingRect.size.y)}) worldScale=${fmtV(backingScale)} widthInWorld=${fmt(rectWidth)} heightInWorld=${fmt(rectHeight)} aabbSize=${fmtV(backingBounds.size)} colour=(${fmt(backingRect.backgroundColor.x)},${fmt(backingRect.backgroundColor.y)},${fmt(backingRect.backgroundColor.z)},${fmt(backingRect.backgroundColor.w)})`)
    c.near("panel: about 30 cm wide (Backing component size times its world scale)", rectWidth, 30, 2)
    c.ok("panel: light, semi-opaque background", luminance(backingRect.backgroundColor) > 0.5 && backingRect.backgroundColor.w > 0.3 && backingRect.backgroundColor.w < 0.95, `luminance=${fmt(luminance(backingRect.backgroundColor))} alpha=${fmt(backingRect.backgroundColor.w)}`)
    for (const name of ["GrabBar"]) {
      const bar = findRequired(name)
      const rect = bar.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      c.info(name, `size=(${fmt(rect.size.x)},${fmt(rect.size.y)}) colour=(${fmt(rect.backgroundColor.x)},${fmt(rect.backgroundColor.y)},${fmt(rect.backgroundColor.z)},${fmt(rect.backgroundColor.w)})`)
    }

    // Gap between the slider and Place drill, measured on the panel's own up axis.
    const buttonObject = findRequired("PlaceDrillButton")
    const up = sliderObject.getTransform().up
    const centreDistance = Math.abs(sliderObject.getTransform().getWorldPosition().sub(buttonObject.getTransform().getWorldPosition()).dot(up))
    const sliderHalf = (slider.size.y * sliderObject.getTransform().getWorldScale().y) / 2
    const buttonHalf = (button.size.y * buttonObject.getTransform().getWorldScale().y) / 2
    const gap = centreDistance - sliderHalf - buttonHalf
    c.info("slider to button", `centreDistance=${fmt(centreDistance)} sliderHeight=${fmt(sliderHalf * 2)} buttonHeight=${fmt(buttonHalf * 2)} gap=${fmt(gap)}`)
    c.ok("panel: a clear gap of at least 3 cm between the slider and Place drill", gap >= 3, `gap=${fmt(gap)}`)
    c.near("panel: the gap is the builder's 4 cm", gap, 4, 0.2)

    // The real colliders that decide what a pinch lands on. If the slider's collider reaches down into the
    // Place drill button's collider, a pinch aimed at one can press the other (defect D1).
    const colliderRange = (name: string): {low: number; high: number; text: string} => {
      const interactable = findInteractableByName(name, undefined, true)
      const reference = findRequired(name).getTransform().getWorldPosition().dot(up)
      let low = 1e9
      let high = -1e9
      const parts: string[] = []
      for (const collider of interactable.colliders) {
        const shape: any = collider.shape
        const transform = collider.getSceneObject().getTransform()
        const centre = transform.getWorldPosition().dot(up)
        const scale = transform.getWorldScale()
        const size: vec3 = shape && shape.size ? shape.size : new vec3(0, 0, 0)
        const half = (Math.abs(size.y * scale.y) + Math.abs(size.x * scale.x) * Math.abs(transform.right.dot(up)) + Math.abs(size.z * scale.z) * Math.abs(transform.back.dot(up))) / 2
        low = Math.min(low, centre - half)
        high = Math.max(high, centre + half)
        parts.push(`${collider.getSceneObject().name}[${shape ? shape.isOfType("Box") ? "box" : "other" : "none"} size=${fmtV(size)} scale=${fmtV(scale)} enabled=${collider.enabled}]`)
      }
      return {low: low - reference, high: high - reference, text: parts.join(" ")}
    }
    const sliderRange = colliderRange("SpacingSliderCell")
    const buttonRange = colliderRange("PlaceDrillButton")
    c.info("slider colliders", `${sliderRange.text} verticalExtentAroundCentre=[${fmt(sliderRange.low)},${fmt(sliderRange.high)}]`)
    c.info("button colliders", `${buttonRange.text} verticalExtentAroundCentre=[${fmt(buttonRange.low)},${fmt(buttonRange.high)}]`)
    const sliderBottom = sliderObject.getTransform().getWorldPosition().dot(up) + sliderRange.low
    const buttonTop = buttonObject.getTransform().getWorldPosition().dot(up) + buttonRange.high
    c.ok("colliders: the slider's collider stops above the Place drill button's collider", sliderBottom > buttonTop, `sliderColliderBottom-buttonColliderTop=${fmt(sliderBottom - buttonTop)} cm (positive means a clear gap)`)

    // Frustum and reach. These are measurements of the real camera and the simulated arm, and are asserted
    // because a person who cannot see a control cannot use it.
    const controls: {name: string; object: SceneObject}[] = [
      {name: "SpacingSliderCell", object: sliderObject},
      {name: "PlaceDrillButton", object: buttonObject},
      {name: "GrabBar", object: findRequired("GrabBar")},
      {name: "SpacingValue", object: findRequired("SpacingValue")},
    ]
    for (const control of controls) {
      const point = control.object.getTransform().getWorldPosition()
      c.info(`frustum ${control.name}`, `${fmtV(point)} ${frustumOf(rig, point)}`)
    }
    for (const control of [controls[0], controls[1]]) {
      const point = control.object.getTransform().getWorldPosition()
      const view = rig.viewOf(point)
      c.ok(`frustum: ${control.name} centre is inside the camera view`, view.inView, `screen=(${fmt(view.x)},${fmt(view.y)}) cameraPitchDown=${fmt(rig.pitchDownDeg())}`)
      // The smallest extra look-down that brings the centre to 90 percent of the frame height, so the cost is known.
      let needed = 0
      for (let extra = 0; extra <= 40; extra += 1) {
        const look = rig.pitchDownDeg() + extra
        const local = point.sub(eye)
        const rad = (look * Math.PI) / 180
        const angleBelowEyeLine = Math.atan2(eye.y - point.y, new vec3(local.x, 0, local.z).length) // radians below horizontal
        const offAxis = angleBelowEyeLine - rad
        if (Math.abs(offAxis) < (rig.camera.fov / 2) * 0.9) {
          needed = extra
          break
        }
      }
      c.info(`look-down needed for ${control.name}`, `extra=${needed} deg beyond the default pitch, so total ${fmt(rig.pitchDownDeg() + needed)} deg`)
      const distance = point.distance(eye)
      c.info(`reach ${control.name}`, `distance from the eye=${fmt(distance)} cm (the earlier IK clamp was about 67.5 cm from the shoulder)`)
    }

    // Ghost: from launch, at the slider's value, about 2 m ahead and turning with the view.
    const ghost = new DrillParts("GhostDrill")
    c.ok("ghost: visible from launch", state.ghostVisible && findRequired("GhostDrill").isEnabledInHierarchy)
    c.near("ghost: at the slider's spacing, cm", state.ghostSpacingCm, 100, 0.001)
    await this.checkGhost(c, rig, ghost, "at launch", 100)

    const before = ghost.part("StartPad").getTransform().getWorldPosition()
    rig.turnRight(60)
    await sleep(1500)
    const after = ghost.part("StartPad").getTransform().getWorldPosition()
    c.ok("ghost: turned 60 degrees, the pad moved with the view", before.distance(after) > 100, `moved=${fmt(before.distance(after))} cm`)
    await this.checkGhost(c, rig, ghost, "after turning 60 degrees right", 100)
    rig.turnRight(-100)
    await sleep(1500)
    await this.checkGhost(c, rig, ghost, "after turning 40 degrees left of the start", 100)
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }

  private async checkGhost(c: Checks, rig: SkaterRig, ghost: DrillParts, when: string, spacing: number): Promise<void> {
    await frames(2)
    const state = snap()
    const eye = rig.actualEye()
    const heading = rig.heading()
    const pad = ghost.part("StartPad").getTransform().getWorldPosition()
    const flat = new vec3(pad.x - eye.x, 0, pad.z - eye.z)
    c.between(`ghost ${when}: pad about 2 m ahead, cm`, flat.length, 170, 230)
    c.near(`ghost ${when}: pad straight ahead of the view`, flat.normalize().dot(heading), 1, 0.01)
    c.near(`ghost ${when}: on the floor`, boundsOf(ghost.part("StartPad")).min.y, state.floorY, 2)
    let previous = pad
    let total = 0
    for (let i = 0; i < CONE_COUNT; i++) {
      const position = ghost.cone(i).getTransform().getWorldPosition()
      const step = position.sub(previous)
      const along = new vec3(step.x, 0, step.z).dot(heading)
      if (i === 0) {
        c.near(`ghost ${when}: cone 1 is 150 cm past the pad`, along, 150, 0.5)
      } else {
        total += along
      }
      previous = position
    }
    c.near(`ghost ${when}: mean cone spacing, cm`, total / (CONE_COUNT - 1), spacing, 0.01)
    c.between(`ghost ${when}: faint (cone alpha)`, colorOf(ghost.cone(0)).w, 0.05, 0.6)
  }
}
