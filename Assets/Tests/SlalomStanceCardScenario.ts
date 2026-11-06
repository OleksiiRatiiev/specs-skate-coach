/**
 * Stance card. Shows while the skater stands on the start pad before leaving, including after walking back
 * onto it, and hides on leaving. Floats about 1 m in front of the pad centre, faces the pad, about 40 cm
 * tall, light colours with no dark background, and says Knees bent / Arms forward / Eyes 2-3 cones ahead.
 * The words are read from the real Text components.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {forEachComponentInSubtree} from "Leaf.lspkg/Utils/common/Utils"
import {
  allTexts,
  Checks,
  findRequired,
  fmt,
  fmtV,
  frames,
  isUnder,
  luminance,
  Pincher,
  placeWithPinches,
  SkaterRig,
  snap,
  stepOntoPad,
  v3,
  waitForLens,
} from "./SlalomLeafHarness"

@component
export class SlalomStanceCardScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("stance_card")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    const pincher = new Pincher(config)
    const placed = await placeWithPinches(pincher, config)
    const card = findRequired("StanceCard")

    let state = snap()
    c.ok("placed, skater is 2 m from the pad: the stance card is hidden", !state.stanceCardVisible && !card.isEnabledInHierarchy, `visible=${state.stanceCardVisible} enabled=${card.isEnabledInHierarchy}`)

    await stepOntoPad(rig)
    state = snap()
    c.ok("standing on the pad: the stance card shows", state.stanceCardVisible && card.isEnabledInHierarchy, `visible=${state.stanceCardVisible} enabled=${card.isEnabledInHierarchy}`)

    // Where it is, from the real transform.
    const pad = v3(state.padCentre)
    const forward = v3(state.drillForward)
    const right = v3(state.drillRight)
    const position = card.getTransform().getWorldPosition()
    const eye = rig.actualEye()
    const ahead = position.sub(pad).dot(forward)
    const sideways = position.sub(pad).dot(right)
    c.info("stance card", `position=${fmtV(position)} ahead=${fmt(ahead)} sideways=${fmt(sideways)} aboveFloor=${fmt(position.y - state.floorY)} belowEye=${fmt(eye.y - position.y)}`)
    c.near("stance card: about 1 m in front of the pad centre, cm", ahead, 100, 10)
    c.near("stance card: on the centre line, cm", sideways, 0, 5)
    c.between("stance card: slightly below eye level, cm below", eye.y - position.y, 3, 30)
    const facing = card.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, 1))
    const toPad = new vec3(pad.x - position.x, 0, pad.z - position.z).normalize()
    c.ok("stance card: faces the pad", new vec3(facing.x, 0, facing.z).normalize().dot(toPad) > 0.95, `facingDotToPad=${fmt(new vec3(facing.x, 0, facing.z).normalize().dot(toPad))}`)
    c.ok("stance card: stays upright", Math.abs(facing.y) < 0.1, `facing.y=${fmt(facing.y)}`)

    // Words, colours and size, from the real components.
    const texts = allTexts().filter((text) => text.getSceneObject().isEnabledInHierarchy && isUnder(text.getSceneObject(), "StanceCard"))
    const words = texts.map((text) => text.text)
    c.info("stance card texts", JSON.stringify(words))
    for (const wanted of ["Knees bent", "Arms forward", "Eyes 2–3 cones ahead"]) {
      c.ok(`stance card says '${wanted}' once`, words.filter((word) => word === wanted).length === 1, `texts=${JSON.stringify(words)}`)
    }
    c.ok("stance card has exactly those three lines", words.length === 3, `count=${words.length}`)
    for (const text of texts) {
      const fill = text.textFill.color
      c.ok(`stance card text '${text.text}' is light`, luminance(fill) > 0.7 && fill.w > 0.5, `colour=(${fmt(fill.x)},${fmt(fill.y)},${fmt(fill.z)},${fmt(fill.w)})`)
    }
    let darkVisuals = 0
    let visualCount = 0
    let top = -1e9
    let bottom = 1e9
    forEachComponentInSubtree<any>(card, ["Component.Image", "Component.RenderMeshVisual", "Component.Text"], (component) => {
      const object: SceneObject = component.getSceneObject()
      if (!object.isEnabledInHierarchy) {
        return
      }
      visualCount++
      try {
        top = Math.max(top, component.worldAabbMax().y)
        bottom = Math.min(bottom, component.worldAabbMin().y)
      } catch (error) {
        // Not every visual reports bounds.
      }
      if (!component.textFill) {
        const colour = component.mainMaterial.mainPass.baseColor
        if (colour.w > 0.3 && luminance(colour) < 0.6) {
          darkVisuals++
          print(`[SLALOM][stance_card] dark visual ${object.name} colour=(${fmt(colour.x)},${fmt(colour.y)},${fmt(colour.z)},${fmt(colour.w)})`)
        }
      }
    })
    c.ok("stance card: no dark visual and no backing panel", darkVisuals === 0 && visualCount >= 4, `dark=${darkVisuals} visuals=${visualCount}`)
    c.between("stance card: about 40 cm tall (union of its real visuals)", top - bottom, 35, 45)

    // Fixed in the world, and the lifecycle as the skater leaves and returns.
    const startPosition = position
    let hiddenAt = -1
    let visibleOffPad = 0
    await rig.walk(0, 140, 90, () => 0, (frame) => {
      if (!frame.stanceCardVisible && hiddenAt < 0) {
        hiddenAt = frame.skaterStationCm
      }
      if (frame.stanceCardVisible && frame.skaterStationCm > 60) {
        visibleOffPad++
      }
    })
    state = snap()
    c.ok("leaving the pad: the stance card hides", !state.stanceCardVisible && !card.isEnabledInHierarchy, `visible=${state.stanceCardVisible} enabled=${card.isEnabledInHierarchy}`)
    c.between("leaving the pad: it hid at the pad's edge, station cm", hiddenAt, 45, 60)
    c.ok("leaving the pad: it never showed again once 60 cm out", visibleOffPad === 0, `frames=${visibleOffPad}`)
    c.near("the card did not move while the skater walked away, cm", card.getTransform().getWorldPosition().distance(startPosition), 0, 0.01)

    let shownAt = -1
    await rig.walk(140, 0, 90, () => 0, (frame) => {
      if (frame.stanceCardVisible && shownAt < 0) {
        shownAt = frame.skaterStationCm
      }
    })
    state = snap()
    c.ok("walking back onto the pad: the stance card shows again", state.stanceCardVisible && card.isEnabledInHierarchy, `visible=${state.stanceCardVisible}`)
    c.between("walking back: it showed at the pad's edge, station cm", shownAt, 45, 60)
    c.near("the card is where it was", card.getTransform().getWorldPosition().distance(startPosition), 0, 0.01)

    // After a whole run.
    await rig.walk(0, placed.finish + 10, 300, placed.weave)
    await frames(3)
    c.ok("after finishing: the stance card is hidden and the finish card shows", !snap().stanceCardVisible && snap().finishCardVisible, `stance=${snap().stanceCardVisible} finish=${snap().finishCardVisible}`)
    await rig.walk(placed.finish + 10, 0, 300, () => 0)
    await frames(3)
    state = snap()
    c.ok("walking back onto the pad after a run: the stance card shows and the finish card hides", state.stanceCardVisible && !state.finishCardVisible, `stance=${state.stanceCardVisible} finish=${state.finishCardVisible}`)
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }
}
