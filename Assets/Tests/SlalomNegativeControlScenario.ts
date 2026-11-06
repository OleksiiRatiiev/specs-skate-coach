/**
 * Negative control. THIS SCENARIO MUST FAIL. It misses cone 3 on purpose and still asserts a clean
 * 6/6, using the same harness and checks as the real scenarios. If it ever passes, the suite cannot
 * be trusted. It is not part of any done criterion.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {Checks, frames, Pincher, placeWithPinches, SkaterRig, snap, stepOntoPad, waitForLens, weaveWithMiss} from "./SlalomLeafHarness"

@component
export class SlalomNegativeControlScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("negative_control")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(3)
    const pincher = new Pincher(config)
    const placed = await placeWithPinches(pincher, config)
    await stepOntoPad(rig)
    await rig.walk(0, placed.finish + 10, 200, weaveWithMiss(placed.stations, placed.sides, placed.finish, 2))
    await frames(3)
    const state = snap()
    c.ok("deliberately wrong: expects 6/6 after missing cone 3", state.finishScoreText === "6/6", `score='${state.finishScoreText}'`)
    c.ok("deliberately wrong: expects no amber cones", placed.parts.amberCones().length === 0, `amber=[${placed.parts.amberCones()}]`)
    c.finish()
  }
}
