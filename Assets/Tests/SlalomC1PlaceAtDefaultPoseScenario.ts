/**
 * Criterion 1, reachability check. At the pose given by lookDownDeg (0 is the default preview pose), try a real
 * Place drill pinch with a short timeout and no retry. The test passes only if the pinch completes
 * and the drill is placed. It exists to find out whether a wearer who does not tilt their head can
 * press the button at all, which the brief's "Place drill" step requires.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {Checks, eventCount, fmt, frames, frustumOf, Pincher, SkaterRig, snap, v3, waitForLens} from "./SlalomLeafHarness"
import {findRequired} from "./SlalomLeafHarness"

@component
export class SlalomC1PlaceAtDefaultPoseScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("c1_place_default_pose")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    const pincher = new Pincher(config)
    pincher.timeoutMs = parseFloat((config && config.get("timeoutMs")) || "15000")
    pincher.retryAllowed = false
    const button = findRequired("PlaceDrillButton").getTransform().getWorldPosition()
    c.info("pose", `pitchDown=${fmt(rig.pitchDownDeg())} ${frustumOf(rig, button)}`)
    let completed = false
    let message = ""
    try {
      await pincher.pinch("PlaceDrillButton")
      completed = true
    } catch (error) {
      message = String(error)
    }
    const state = snap()
    c.info("after the attempt", `completed=${completed} setupState=${state.setupState} triggerStarts=${eventCount("PlaceDrillButton", "triggerStart")} hoverEnters=${eventCount("PlaceDrillButton", "hoverEnter")} message='${message}'`)
    c.ok("a real Place drill pinch completes at the default pose", completed, message)
    c.ok("the drill is placed by it", state.setupState === "placed", `state=${state.setupState}`)
    c.ok("panel and ghost are hidden by it", !state.setupPanelVisible && !state.ghostVisible)
    if (completed && state.setupState === "placed") {
      const drillRoot = findRequired("Drill")
      c.ok("placed: the drill shows, the panel and ghost are switched off in the scene", state.drillVisible && drillRoot.isEnabledInHierarchy && !findRequired("SetupPanel").isEnabledInHierarchy && !findRequired("GhostDrill").isEnabledInHierarchy, "")
      c.near("placed: the drill is at the Lens's spacing, cm", state.spacingCm, 100, 0.001)
      c.near("placed: it points the way the wearer faced", v3(state.drillForward).dot(rig.heading()), 1, 0.01)
      const cone = findRequired("Cone_1", drillRoot).getTransform()
      const fixedCone = cone.getWorldPosition()
      const fixedPad = findRequired("StartPad", drillRoot).getTransform().getWorldPosition()
      rig.turnRight(90)
      await frames(10)
      rig.setDrillPosition(100, 200)
      await frames(10)
      c.near("placed: cone 1 did not move when the skater turned and walked away, cm", cone.getWorldPosition().distance(fixedCone), 0, 0.01)
      c.near("placed: the pad did not move either, cm", findRequired("StartPad", drillRoot).getTransform().getWorldPosition().distance(fixedPad), 0, 0.01)
      c.near("placed: the drill sits on the floor", fixedPad.y, state.floorY, 2)
    }
    c.ok("the slider was not pressed on the way", eventCount("SpacingSliderCell", "triggerStart") === 0, `sliderTriggerStarts=${eventCount("SpacingSliderCell", "triggerStart")}`)
    c.ok("the slider value is unchanged by the pinch", state.sliderValueM === 1.0, `slider=${state.sliderValueM}`)
    v3(button)
    c.finish()
  }
}
