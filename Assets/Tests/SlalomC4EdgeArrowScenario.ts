/**
 * Criterion 4, Recovery, second half. Turning so the highlighted pole leaves the view shows the
 * edge arrow pointing at it, and facing it again removes the arrow. Whether the pole is in view is
 * measured with the real camera projection, not the Lens's own rule.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Checks, findRequired, fmt, frames, Pincher, placeWithPinches, SkaterRig, snap, stepOntoPad, waitForLens} from "./SlalomLeafHarness"

@component
export class SlalomC4EdgeArrowScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const hold = parseFloat((config && config.get("holdMs")) || "0")
    const c = new Checks("c4_arrow")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(3)
    const pincher = new Pincher(config)
    c.info("pinch mode", pincher.mode)
    const placed = await placeWithPinches(pincher, config)
    await stepOntoPad(rig)
    const arrowVisual = findRequired("ArrowVisual")

    const settle = async (): Promise<void> => {
      await frames(4)
      if (hold > 0) {
        await sleep(hold)
      }
    }
    const report = (when: string, index: number): void => {
      const state = snap()
      const pole = placed.parts.visiblePole(index)
      const screen = rig.viewOf(arrowVisual.getTransform().getWorldPosition())
      c.info(when, `arrow=${state.arrowVisible} target=${state.arrowTarget} angle=${fmt(state.arrowAngleDeg)} poleInView=${rig.poleInView(pole)} arrowScreen=(${fmt(screen.x)},${fmt(screen.y)}) yawDeg=${fmt((rig.yaw * 180) / Math.PI)} s=${fmt(state.skaterStationCm)}`)
    }

    // Off the pad, cone 1 next, facing up the drill, 2.7 m back so the 1 m pole fits the view's height.
    await rig.walk(0, -120, 150, () => 0)
    await settle()
    report("facing up the drill, cone 1 next", 0)
    c.ok("facing the drill: pole 1 is really in view", rig.poleInView(placed.parts.visiblePole(0)))
    c.ok("facing the drill: no arrow", !snap().arrowVisible && !arrowVisual.enabled)

    // The brief's test: turn around.
    rig.faceRelativeToDrill(180)
    await settle()
    report("turned around", 0)
    c.ok("turned around: pole 1 is really out of view", !rig.poleInView(placed.parts.visiblePole(0)))
    let state = snap()
    c.ok("turned around: arrow shows", state.arrowVisible && arrowVisual.isEnabledInHierarchy)
    c.ok("turned around: arrow is for the pole", state.arrowTarget === "pole", state.arrowTarget)
    const arrowView = rig.viewOf(arrowVisual.getTransform().getWorldPosition())
    c.ok("turned around: arrow is inside the view", arrowView.inView, `screen=(${fmt(arrowView.x)},${fmt(arrowView.y)})`)
    c.ok("turned around: arrow is at the lower edge", arrowView.y > 0.75, `screenY=${fmt(arrowView.y)} (0 is the top)`)
    c.near("turned around: arrow is centred sideways", arrowView.x, 0.5, 0.05)
    c.between("turned around: arrow points sideways, to turn back", Math.abs(state.arrowAngleDeg), 60, 120)

    // Quarter turns: the pole lies to one side, so the direction can be checked.
    rig.faceRelativeToDrill(90)
    await settle()
    report("turned 90 right", 0)
    state = snap()
    c.ok("turned right: pole 1 is really out of view", !rig.poleInView(placed.parts.visiblePole(0)))
    c.ok("turned right: arrow shows", state.arrowVisible)
    c.between("turned right: the pole is to the left, so the arrow points left", state.arrowAngleDeg, 45, 135)
    this.checkArrowRotation(c, "turned right", arrowVisual, state.arrowAngleDeg)

    rig.faceRelativeToDrill(-90)
    await settle()
    report("turned 90 left", 0)
    state = snap()
    c.ok("turned left: pole 1 is really out of view", !rig.poleInView(placed.parts.visiblePole(0)))
    c.ok("turned left: arrow shows", state.arrowVisible)
    c.between("turned left: the pole is to the right, so the arrow points right", state.arrowAngleDeg, -135, -45)
    this.checkArrowRotation(c, "turned left", arrowVisual, state.arrowAngleDeg)

    // Face it again.
    rig.faceRelativeToDrill(0)
    await settle()
    report("facing again", 0)
    state = snap()
    c.ok("facing again: pole 1 is really in view", rig.poleInView(placed.parts.visiblePole(0)))
    c.ok("facing again: arrow gone", !state.arrowVisible && !arrowVisual.enabled)

    // Near case, recorded and not asserted: 60 cm before cone 1 the pole is below the narrow view
    // even when facing it squarely, so "in view" by real projection and by the Lens's width rule differ.
    await rig.walk(-120, 90, 150, () => 0)
    await settle()
    report("60 cm before cone 1, facing it", 0)
    state = snap()
    if (!rig.poleInView(placed.parts.visiblePole(0)) && !state.arrowVisible) {
      c.deviation("facing the next pole from 60 cm: pole is below the real view, arrow hidden by the width-only rule", `s=${fmt(state.skaterStationCm)}`)
    }

    // Follows the highlight.
    await rig.walk(90, placed.stations[1] + 20, 150, placed.weave)
    await settle()
    state = snap()
    c.ok("past two cones: cone 3 is next", state.highlightedIndex === 2, `highlighted=${state.highlightedIndex}`)
    rig.faceRelativeToDrill(180)
    await settle()
    report("turned around with cone 3 next", 2)
    state = snap()
    c.ok("later turn: pole 3 is really out of view", !rig.poleInView(placed.parts.visiblePole(2)))
    c.ok("later turn: arrow shows for the pole", state.arrowVisible && state.arrowTarget === "pole", `visible=${state.arrowVisible} target=${state.arrowTarget}`)
    rig.faceRelativeToDrill(0)
    await settle()
    report("facing again with cone 3 next", 2)
    c.ok("later turn: arrow gone on facing it", !snap().arrowVisible)

    // Rule from "When things show": more than 5 m from the drill, it points to the start pad.
    rig.setDrillPosition(-700, 0)
    rig.faceRelativeToDrill(180)
    await settle()
    report("7 m behind the pad, facing away", 2)
    state = snap()
    c.ok("far away, facing away: arrow points to the start pad", state.arrowVisible && state.arrowTarget === "pad", `visible=${state.arrowVisible} target=${state.arrowTarget}`)
    rig.faceRelativeToDrill(0)
    await settle()
    report("7 m behind the pad, facing it", 2)
    c.ok("far away, facing the pad: arrow gone", !snap().arrowVisible)

    // The known deviation. Recorded, not asserted, because it is a design decision to review.
    rig.setDrillPosition(placed.stations[2] - 5, 100)
    rig.faceRelativeToDrill(0)
    await settle()
    report("in the lane beside cone 3, facing up the drill", 2)
    state = snap()
    if (!rig.poleInView(placed.parts.visiblePole(2)) && !state.arrowVisible) {
      c.deviation("pole out of view with no arrow while facing up the drill in the lane", `quietArrowWhileSkating. s=${fmt(state.skaterStationCm)} t=${fmt(state.skaterLateralCm)}`)
    }
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }

  /** The arrow's mesh points along +Y, so its real rotation about the view axis should match the reported angle. */
  private checkArrowRotation(c: Checks, when: string, arrowVisual: SceneObject, reportedDeg: number): void {
    const up = arrowVisual.getTransform().getLocalRotation().multiplyVec3(vec3.up())
    const realDeg = (Math.atan2(-up.x, up.y) * 180) / Math.PI
    c.near(`${when}: arrow mesh really points that way, degrees`, realDeg, reportedDeg, 1)
  }
}
