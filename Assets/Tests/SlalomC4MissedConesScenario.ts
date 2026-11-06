/**
 * Criterion 4, Recovery, first half. Walking straight past cones turns them amber for the rest of
 * the run, and the highlight moves on. Cone colour is read from the real material.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {Checks, CONE_COUNT, fmt, frames, Pincher, placeWithPinches, SkaterRig, snap, stepOntoPad, waitForLens} from "./SlalomLeafHarness"

@component
export class SlalomC4MissedConesScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("c4_missed")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(3)
    const pincher = new Pincher(config)
    c.info("pinch mode", pincher.mode)
    const placed = await placeWithPinches(pincher, config)
    await stepOntoPad(rig)
    c.ok("before the run: no amber cones", placed.parts.amberCones().length === 0, `amber=[${placed.parts.amberCones()}]`)

    let s = 0
    for (let i = 0; i < CONE_COUNT; i++) {
      // Up to just before this cone's line, straight along the centre line.
      const before = placed.stations[i] - 10
      await rig.walk(s, before, 120, () => 0)
      let state = snap()
      c.ok(`before cone ${i + 1}: it is pending`, state.coneStates[i] === "pending", state.coneStates[i])
      c.ok(`before cone ${i + 1}: it is highlighted`, state.highlightedIndex === i, `highlighted=${state.highlightedIndex}`)
      c.ok(`before cone ${i + 1}: not amber yet`, placed.parts.amberCones().indexOf(i) < 0)
      // Straight past it.
      const after = placed.stations[i] + 10
      await rig.walk(before, after, 120, () => 0)
      s = after
      state = snap()
      c.ok(`past cone ${i + 1}: counted as missed`, state.coneStates[i] === "missed", state.coneStates[i])
      const amber = placed.parts.amberCones()
      const expectedAmber: number[] = []
      for (let k = 0; k <= i; k++) {
        expectedAmber.push(k)
      }
      c.ok(`past cone ${i + 1}: every cone so far is amber and stays amber`, JSON.stringify(amber) === JSON.stringify(expectedAmber), `amber=[${amber}]`)
      const expectedHighlight = i + 1 < CONE_COUNT ? i + 1 : -1
      c.ok(`past cone ${i + 1}: highlight moved on`, state.highlightedIndex === expectedHighlight, `highlighted=${state.highlightedIndex}`)
      const lit = placed.parts.litHalos()
      c.ok(`past cone ${i + 1}: the thick next pole moved on too`, JSON.stringify(placed.parts.nextPoles()) === JSON.stringify(expectedHighlight >= 0 ? [expectedHighlight] : []), `next=[${placed.parts.nextPoles()}]`)
      c.ok(`past cone ${i + 1}: the lit pole moved on too`, JSON.stringify(lit) === JSON.stringify(expectedHighlight >= 0 ? [expectedHighlight] : []), `lit=[${lit}]`)
      c.ok(`past cone ${i + 1}: no finish card while moving`, !state.finishCardVisible)
    }

    await rig.walk(s, placed.finish + 10, 120, () => 0)
    await frames(3)
    const state = snap()
    c.ok("straight run finishes with 0 of 6", state.finishCardVisible && state.finishScoreText === "0/6", `visible=${state.finishCardVisible} score='${state.finishScoreText}'`)
    c.ok("cones stay amber at the finish", placed.parts.amberCones().length === 6, `amber=[${placed.parts.amberCones()}]`)
    c.info("rig", `error=${fmt(rig.trackingErrorCm())}`)
    c.finish()
  }
}
