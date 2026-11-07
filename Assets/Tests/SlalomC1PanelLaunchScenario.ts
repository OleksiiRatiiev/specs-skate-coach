/**
 * Criterion 1, part 1: what is on screen at launch. No pinch. Measures the setup strip anchored to the
 * ghost's start pad (centred on it, about 90 cm up, tilted back about 30 degrees, moving with the ghost),
 * its two stepper rows and PLACE DRILL button, text sizes and neon colours, and the ghost drill (from launch,
 * about 2 m ahead, turning with the view). Nothing in the scene is moved to make a check pass.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
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
  isUnder,
  luminance,
  SkaterRig,
  snap,
  v3,
  waitForLens,
} from "./SlalomLeafHarness"

const BUTTONS = ["ConesMinusButton", "ConesPlusButton", "SpacingMinusButton", "SpacingPlusButton", "PlaceDrillButton"]

/** Height of capital letters in cm for a Text made by the neon kit (size 100, scaled). */
function capHeightCm(text: Text): number {
  return text.getSceneObject().getTransform().getWorldScale().y * (text.size / 43.886) * 0.7
}

@component
export class SlalomC1PanelLaunchScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("c1_panel_launch")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    c.info("camera", `eye=${fmtV(rig.actualEye())} pitchDown=${fmt(rig.pitchDownDeg())} fovDeg=${fmt((rig.camera.fov * 180) / Math.PI)}`)
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)

    const state = snap()
    c.ok("launch: setup state is ghost, drill not placed", state.setupState === "ghost" && !state.drillVisible, `state=${state.setupState} drill=${state.drillVisible}`)
    c.ok("launch: strip shows", state.setupPanelVisible && findRequired("SetupPanel").isEnabledInHierarchy)

    // The old floating card is gone entirely.
    for (const old of ["SpacingSliderCell", "GrabBar", "Backing", "EasyButton", "StandardButton"]) {
      c.ok(`launch: old element ${old} is gone`, !findSceneObjectByName(old))
    }
    c.ok("launch: no follow behaviour left on the strip", !state.panelHasFollowBehavior && !state.panelFollowing)

    // Controls: UI Kit buttons, at least 6 cm, with live interactables.
    for (const name of BUTTONS) {
      const object = findRequired(name)
      const button = buttonNamed(name)
      const widthCm = button.size.x * object.getTransform().getWorldScale().x
      const heightCm = button.size.y * object.getTransform().getWorldScale().y
      c.ok(`launch: ${name} is a UI Kit Button with a live Interactable`, !!button && !!findInteractableByName(name, undefined, true))
      c.ok(`launch: ${name} is at least 6 cm`, widthCm >= 5.99 && heightCm >= 5.99, `size=${fmt(widthCm)} x ${fmt(heightCm)}`)
      c.ok(`launch: ${name} is not a toggle and is active`, button.isOn === false && button.inactive === false)
    }

    // Texts.
    const stripTexts = allTexts().filter((text) => text.getSceneObject().isEnabledInHierarchy && isUnder(text.getSceneObject(), "SetupPanel"))
    c.info("strip texts", JSON.stringify(stripTexts.map((text) => text.text)))
    for (const wanted of ["6", "1.0 m", "CONES", "CONE SPACING", "PLACE DRILL"]) {
      const count = stripTexts.filter((text) => text.text === wanted).length
      c.ok(`launch: text '${wanted}' shows once`, count === 1, `count=${count}`)
    }
    c.ok("launch: snapshot values are 6 cones and 1.0 m", state.stripCountText === "6" && state.sliderText === "1.0 m" && state.coneCount === 6 && state.sliderValueM === 1.0, `count='${state.stripCountText}' text='${state.sliderText}'`)
    for (const text of stripTexts) {
      const fill = text.textFill.color
      c.ok(`launch: text '${text.text}' is light, so it shows on the additive display`, luminance(fill) > 0.5 && fill.w > 0.5, `colour=(${fmt(fill.x)},${fmt(fill.y)},${fmt(fill.z)},${fmt(fill.w)})`)
    }
    for (const value of stripTexts.filter((text) => text.text === "6" || text.text === "1.0 m")) {
      c.between(`launch: value '${value.text}' is about 5 cm tall`, capHeightCm(value), 4.5, 5.5)
      const fill = value.textFill.color
      c.ok(`launch: value '${value.text}' is neon cyan #3FF0FF`, Math.abs(fill.x - 0.247) < 0.03 && Math.abs(fill.y - 0.941) < 0.03 && Math.abs(fill.z - 1) < 0.03, `colour=(${fmt(fill.x)},${fmt(fill.y)},${fmt(fill.z)})`)
    }

    // Anchored to the ghost's start pad: centred on it, about 90 cm up, tilted back about 30 degrees.
    const ghostPad = v3(state.ghostPadPosition)
    this.checkStrip(c, snap(), "at launch")

    // Frustum (information at the default pose, asserted when the wearer looks a little down).
    const stripCentre = v3(snap().stripPosition)
    const view = rig.viewOf(stripCentre)
    c.info("frustum", `${fmtV(stripCentre)} ${frustumOf(rig, stripCentre)} distance=${fmt(stripCentre.distance(rig.actualEye()))}`)
    if (rig.pitchDownDeg() >= 4) {
      c.ok("launch: strip centre is inside the camera view", view.inView, `screen=(${fmt(view.x)},${fmt(view.y)})`)
    }
    void ghostPad

    // Ghost: from launch, six cones at the default spacing, about 2 m ahead and turning with the view.
    const ghost = new DrillParts("GhostDrill")
    c.ok("ghost: visible from launch", state.ghostVisible && findRequired("GhostDrill").isEnabledInHierarchy)
    c.near("ghost: at the default spacing, cm", state.ghostSpacingCm, 100, 0.001)
    await this.checkGhost(c, rig, ghost, "at launch", 100)

    const before = ghost.part("StartPad").getTransform().getWorldPosition()
    rig.turnRight(60)
    await sleep(1000)
    const after = ghost.part("StartPad").getTransform().getWorldPosition()
    c.ok("ghost: turned 60 degrees, the pad moved with the view", before.distance(after) > 100, `moved=${fmt(before.distance(after))} cm`)
    await this.checkGhost(c, rig, ghost, "after turning 60 degrees right", 100)
    this.checkStrip(c, snap(), "after turning 60 degrees: the strip moved with the ghost")
    rig.turnRight(-100)
    await sleep(1000)
    await this.checkGhost(c, rig, ghost, "after turning 40 degrees left of the start", 100)
    this.checkStrip(c, snap(), "after turning back")
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }

  private checkStrip(c: Checks, state: ReturnType<typeof snap>, when: string): void {
    const ghostPad = v3(state.ghostPadPosition)
    const strip = v3(state.stripPosition)
    const facing = v3(state.panelFacing)
    c.near(`strip ${when}: centred on the pad (x), cm`, strip.x, ghostPad.x, 0.5)
    c.near(`strip ${when}: centred on the pad (z), cm`, strip.z, ghostPad.z, 0.5)
    c.near(`strip ${when}: about 90 cm above the pad, cm`, strip.y - ghostPad.y, 90, 1)
    // Facing +Z tilted back by 30 degrees: the normal points up by sin(30) = 0.5.
    c.near(`strip ${when}: tilted back about 30 degrees (normal.y)`, facing.y, 0.5, 0.05)
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
