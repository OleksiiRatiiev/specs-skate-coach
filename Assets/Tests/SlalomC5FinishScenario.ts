/**
 * Criterion 5, Finish and restart. The card shows RUN COMPLETE, CLEAN RUN / NICE RUN, one cone icon per cone
 * (cyan cleared, amber missed), the real-numbers line, AGAIN and CHANGE DRILL. A clean run celebrates (magenta
 * frame, glitching headline, pole wave, shards); a run with misses does not, and its missed cones pulse amber. Parameter "flow":
 *   clean_again: 6/6, pinch Again, then a second clean run to prove the reset was real.
 *   miss_pad: 5/6 with one miss, walk back onto the pad, then a clean run.
 *   move_drill: finish, pinch Change drill, check the panel and ghost are back and the slider kept its value, drag
 *               the slider to movedSpacing, place again, and run the new drill.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  allTexts,
  Checks,
  DrillParts,
  findRequired,
  fmt,
  fmtV,
  frames,
  measuredConeStations,
  Pincher,
  PlacedDrill,
  placeWithPinches,
  setSpacingByDrag,
  isUnder,
  SkaterRig,
  snap,
  stepOntoPad,
  waitForLens,
  weaveProfile,
  weaveWithMiss,
} from "./SlalomLeafHarness"

@component
export class SlalomC5FinishScenario extends Scenario {
  private cardPitchDeg = 5

  async run(config?: ScenarioConfig): Promise<void> {
    this.cardPitchDeg = parseFloat((config && config.get("cardPitchDeg")) || "5")
    const flow = (config && config.get("flow")) || "clean_again"
    const c = new Checks(`c5_${flow}`)
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(3)
    const pincher = new Pincher(config)
    c.info("pinch mode", pincher.mode)
    const placed = await placeWithPinches(pincher, config)
    // The strip sits low on the floor, so setup looks down at it. Skating looks ahead.
    rig.setLookDownDeg(5)
    await stepOntoPad(rig)
    c.ok("on the pad: stance card shows", snap().stanceCardVisible)
    c.ok("on the pad: the CHANGE DRILL button shows at the pad's near edge", this.padButtonShows(), "")
    this.checkPadButton(c, snap(), "on the pad")

    if (flow === "clean_again") {
      await this.finishRun(c, rig, placed, placed.weave, "6/6", "first run")
      await pincher.pinch("AgainButton")
      await frames(3)
      this.expectReset(c, placed, "after pinching Again")
      c.ok("after pinching Again: card button is gone", !findInteractableByName("AgainButton", undefined, true))
      await rig.walk(placed.finish + 10, 0, 300, () => 0)
      await frames(3)
      this.expectReset(c, placed, "back on the pad after Again")
      c.ok("back on the pad: stance card shows", snap().stanceCardVisible)
      await this.finishRun(c, rig, placed, placed.weave, "6/6", "second run")
      await pincher.pinch("AgainButton")
      await frames(3)
      this.expectReset(c, placed, "after pinching Again a second time")
    } else if (flow === "miss_pad") {
      await this.finishRun(c, rig, placed, weaveWithMiss(placed.stations, placed.sides, placed.finish, 2), "5/6", "run with a miss at cone 3")
      c.ok("miss: only cone 3 is amber", JSON.stringify(placed.parts.amberCones()) === "[2]", `amber=[${placed.parts.amberCones()}]`)
      c.ok("miss: only cone 3 counts as missed", JSON.stringify(snap().coneStates) === JSON.stringify(["cleared", "cleared", "missed", "cleared", "cleared", "cleared"]), JSON.stringify(snap().coneStates))

      await rig.walk(placed.finish + 10, 0, 300, () => 0)
      await frames(3)
      this.expectReset(c, placed, "walking back onto the pad")
      c.ok("walking back onto the pad: stance card shows", snap().stanceCardVisible)
      c.ok("walking back onto the pad: phase is OnPad", snap().runPhase === "OnPad", snap().runPhase)
      await this.finishRun(c, rig, placed, placed.weave, "6/6", "clean run after the pad reset")
    } else {
      await this.finishRun(c, rig, placed, placed.weave, "6/6", "run before changing the drill")
      const oldCone = placed.parts.cone(0).getTransform().getWorldPosition()
      await pincher.pinch("ChangeDrillButton")
      // The wearer now looks down at the setup panel again.
      rig.setLookDownDeg(rig.setupPitchDeg)
      await frames(3)
      let state = snap()
      c.ok("Change drill: strip back", state.setupPanelVisible && findRequired("SetupPanel").isEnabledInHierarchy)
      c.ok("Change drill: ghost back", state.ghostVisible && findRequired("GhostDrill").isEnabledInHierarchy)
      c.ok("Change drill: drill hidden", !state.drillVisible && !findRequired("Drill").isEnabledInHierarchy)
      c.ok("Change drill: card hidden", !state.finishCardVisible)
      c.ok("Change drill: no cue", state.cueCount === 0, `count=${state.cueCount}`)
      c.ok("Change drill: no arrow", !state.arrowVisible)
      c.ok("Change drill: the pad's CHANGE DRILL button is hidden again", !this.padButtonShows())
      c.ok("Change drill: setup state back to ghost", state.setupState === "ghost", state.setupState)
      c.ok("Change drill: the slider keeps its last value", state.sliderValueM === 1.0 && state.sliderText === "1.0 m", `value=${state.sliderValueM} text='${state.sliderText}'`)
      c.ok("Change drill: ghost back at the last spacing", state.ghostSpacingCm === 100, `ghost=${state.ghostSpacingCm}`)
      c.ok("Change drill: strip and ghost keep the last cone count", state.coneCount === 6 && state.stripCountText === "6", `count=${state.coneCount} text='${state.stripCountText}'`)

      // Wait for the panel to come back in front, then change the spacing with a real drag and place again.
      await this.waitForPanelToSettle(c)
      const target = parseFloat((config && config.get("movedSpacing")) || "1.4")
      await setSpacingByDrag(pincher, target)
      state = snap()
      c.ok(`re-spaced: slider reads ${target}`, state.sliderValueM === target, `value=${state.sliderValueM} text='${state.sliderText}'`)
      await this.waitForPanelToSettle(c)
      await pincher.pinch("PlaceDrillButton")
      await frames(5)
      state = snap()
      c.ok("re-placed", state.setupState === "placed" && state.spacingCm === Math.round(target * 100), `state=${state.setupState} spacing=${state.spacingCm}`)
      const parts = new DrillParts("Drill")
      for (let i = 1; i < state.coneCount; i++) {
        c.near(`re-placed: real gap ${i} to ${i + 1}`, parts.cone(i).getTransform().getWorldPosition().distance(parts.cone(i - 1).getTransform().getWorldPosition()), target * 100, 0.01)
      }
      c.ok("re-placed: cone 1 is somewhere else", parts.cone(0).getTransform().getWorldPosition().distance(oldCone) > 50, `moved=${fmt(parts.cone(0).getTransform().getWorldPosition().distance(oldCone))}`)
      c.ok("re-placed: no amber", parts.amberCones().length === 0)
      c.ok("re-placed: cone 1 highlighted", JSON.stringify(parts.nextPoles()) === "[0]", `next=[${parts.nextPoles()}]`)

      // Runs on the moved drill.
      const stations = measuredConeStations(state, parts)
      const finish = stations[stations.length - 1] + 100
      const moved: PlacedDrill = {state, parts, stations, sides: state.coneSides, finish, weave: weaveProfile(stations, state.coneSides, finish)}
      await stepOntoPad(rig)
      await this.finishRun(c, rig, moved, moved.weave, "6/6", `run on the moved ${target} m drill`)
    }
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }

  private async finishRun(c: Checks, rig: SkaterRig, placed: PlacedDrill, lateral: (s: number) => number, score: string, when: string): Promise<void> {
    let cardBeforeLine = 0
    let buttonWhileRunning = 0
    await rig.walk(0, placed.finish - 5, 150, lateral, (state) => {
      if (state.finishCardVisible) {
        cardBeforeLine++
      }
      if (state.runPhase === "Running" && this.padButtonShows()) {
        buttonWhileRunning++
      }
    })
    c.ok(`${when}: the pad's CHANGE DRILL button is hidden while running`, buttonWhileRunning === 0, `frames=${buttonWhileRunning}`)
    c.ok(`${when}: no card before the line`, cardBeforeLine === 0, `frames=${cardBeforeLine}`)
    await rig.walk(placed.finish - 5, placed.finish + 10, 150, lateral)
    // At the finish the wearer is skating with their eyes up, not looking down at a setup panel.
    rig.setLookDownDeg(this.cardPitchDeg)
    await frames(5)
    const state = snap()
    c.ok(`${when}: phase Finished`, state.runPhase === "Finished", state.runPhase)
    c.ok(`${when}: card shows`, state.finishCardVisible && findRequired("FinishCard").isEnabledInHierarchy)
    c.ok(`${when}: score state is ${score}`, state.finishScoreText === score, `score='${state.finishScoreText}' cleared=${state.clearedCount}`)
    const clean = state.clearedCount === state.coneCount
    const headline = findRequired("Headline").getComponent("Component.Text") as Text
    const expectedHeadline = clean ? "CLEAN RUN" : state.clearedCount / state.coneCount >= 0.7 ? "NICE RUN" : "KEEP PRACTICING"
    c.ok(`${when}: headline reads ${expectedHeadline}`, !!headline && headline.text === expectedHeadline, `text='${headline ? headline.text : ""}'`)
    // Size: the card is 28 x 18 cm and every text sits inside it.
    const plateFrame = findRequired("Frame", findRequired("CardPlate")).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const plateBox = plateFrame.mesh.aabbMax.sub(plateFrame.mesh.aabbMin)
    c.near(`${when}: card is 28 cm wide`, plateBox.x, 28, 0.5)
    c.near(`${when}: card is 18 cm tall`, plateBox.y, 18, 0.5)
    for (const name of ["Headline", "DetailLine", "RunCompleteLabel"]) {
      const text = findRequired(name).getComponent("Component.Text") as Text
      const scale = text.getSceneObject().getTransform().getWorldScale().x / findRequired("FinishCard").getTransform().getWorldScale().x
      const width = text.getBoundingBox().getSize().x * scale
      c.ok(`${when}: ${name} fits inside the card`, width <= 25, `width=${fmt(width)} cm`)
    }
    const detailObject = findRequired("DetailLine")
    const detailText = detailObject.getComponent("Component.Text") as Text
    const detailBox = detailText.getBoundingBox().getSize()
    const detailScale = detailObject.getTransform().getLocalScale().x
    c.ok(`${when}: subline keeps its 1.3 cm size`, Math.abs(detailScale * 1.5946 - 1.3) < 0.05, `cap=${fmt(detailScale * 1.5946)} cm`)
    c.ok(`${when}: subline stays inside the card (wraps, no overflow)`, detailBox.x * detailScale <= 25, `w=${fmt(detailBox.x * detailScale)}`)
    const headlineScale = headline.getSceneObject().getTransform().getLocalScale().x
    c.ok(`${when}: headline capitals are at most 3.5 cm`, headlineScale * 1.5946 <= 3.55, `cap=${fmt(headlineScale * 1.5946)} cm`)
    const small = allTexts().filter((text) => text.getSceneObject().isEnabledInHierarchy && text.text === "RUN COMPLETE")
    c.ok(`${when}: small RUN COMPLETE label shows`, small.length === 1, `count=${small.length}`)
    const missedList: number[] = []
    state.coneStates.forEach((s, i) => s !== "cleared" && missedList.push(i + 1))
    const expectedDetail = clean
      ? `${score} cones · eyes up all the way`
      : missedList.length === 1
        ? `${score} cones · cone ${missedList[0]} is marked on the drill`
        : `${score} cones · misses glow amber on the drill`
    const detail = findRequired("DetailLine").getComponent("Component.Text") as Text
    c.ok(`${when}: real-numbers line is '${expectedDetail}'`, detail.text === expectedDetail && state.finishDetail === expectedDetail, `text='${detail.text}'`)
    // One icon per cone, in order: cyan when cleared, amber when missed.
    for (let i = 0; i < state.coneCount; i++) {
      const icon = findRequired(`ConeIcon_${i + 1}`)
      const colour = icon.getComponent("Component.RenderMeshVisual") ? (icon.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor : new vec4(0, 0, 0, 0)
      const wantAmber = state.coneStates[i] !== "cleared"
      c.ok(`${when}: cone icon ${i + 1} is ${wantAmber ? "amber" : "cyan"}`, wantAmber ? colour.x > 0.9 && colour.y > 0.6 && colour.y < 0.78 && colour.z < 0.3 : colour.x < 0.35 && colour.y > 0.85 && colour.z > 0.9, `colour=(${fmt(colour.x)},${fmt(colour.y)},${fmt(colour.z)})`)
    }
    c.ok(`${when}: no icon beyond the last cone`, !findRequired(`ConeIcon_${Math.min(12, state.coneCount + 1)}`).enabled || state.coneCount >= 12)
    for (const label of ["AGAIN", "CHANGE DRILL"]) {
      const found = allTexts().filter((text) => text.getSceneObject().isEnabledInHierarchy && text.text === label && isUnder(text.getSceneObject(), "FinishCard"))
      c.ok(`${when}: '${label}' label shows`, found.length === 1, `count=${found.length}`)
    }
    // Celebration: clean runs only.
    const frame = state.finishCardVisible ? findRequired("Frame", findRequired("CardPlate")).getComponent("Component.RenderMeshVisual") as RenderMeshVisual : null
    const frameColour = frame ? frame.mainMaterial.mainPass.baseColor : new vec4(0, 0, 0, 0)
    if (clean) {
      c.ok(`${when}: clean run celebrates`, state.celebrating && state.celebrated, `celebrating=${state.celebrating}`)
      c.ok(`${when}: card frame is magenta #FF3DF0`, frameColour.x > 0.95 && Math.abs(frameColour.y - 0.239) < 0.03 && frameColour.z > 0.9, `frame=(${fmt(frameColour.x)},${fmt(frameColour.y)},${fmt(frameColour.z)})`)
      c.ok(`${when}: shards burst above the finish band`, state.shardCount > 20, `shards=${state.shardCount}`)
      let glitched = false
      let waveSeen = false
      let stillFalling = false
      const parts = new DrillParts("Drill")
      const started = getTime()
      while (getTime() - started < 6.4) {
        await frames(1)
        const elapsed = getTime() - started
        if (elapsed > 3.5 && elapsed < 4.5) {
          stillFalling = stillFalling || snap().shardCount > 20
        }
        glitched = glitched || snap().celebrating && findRequired("HeadlineGlitchMagenta").getComponent("Component.Text").enabled
        for (let i = 0; i < state.coneCount; i++) {
          waveSeen = waveSeen || findRequired(`PoleFlash_${i + 1}`, parts.root).enabled
        }
      }
      c.ok(`${when}: the headline glitched within a few seconds`, glitched)
      c.ok(`${when}: poles flashed in a wave`, waveSeen)
      c.ok(`${when}: shards are still falling at about 4 s`, stillFalling)
      c.ok(`${when}: shards have faded out after about 6 s`, snap().shardCount === 0, `shards=${snap().shardCount}`)
    } else {
      c.ok(`${when}: run with misses does not celebrate`, !state.celebrating && !state.celebrated && state.shardCount === 0 && !(frameColour.x > 0.95 && frameColour.z > 0.9 && frameColour.y < 0.4), `celebrating=${state.celebrating} shards=${state.shardCount}`)
      c.ok(`${when}: missed cones pulse amber once`, state.missPulsed)
    }
    c.ok(`${when}: the pad's CHANGE DRILL button shows after the finish`, this.padButtonShows(), "")
    c.ok(`${when}: Again has a live Interactable`, !!findInteractableByName("AgainButton", undefined, true))
    c.ok(`${when}: Change drill has a live Interactable`, !!findInteractableByName("ChangeDrillButton", undefined, true))

    const card = findRequired("FinishCard").getTransform().getWorldPosition()
    const eye = rig.actualEye()
    c.between(`${when}: card about 80 cm away`, card.distance(eye), 70, 90)
    c.between(`${when}: card about 15 cm below eye level`, eye.y - card.y, 10, 20)
    const view = rig.viewOf(card)
    const cameraForward = findRequired("Camera Object").getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const toCard = card.sub(eye)
    c.info(`${when}: card geometry`, `eye=${fmtV(eye)} card=${fmtV(card)} cameraForward=${fmtV(cameraForward)} toCardDotForward=${fmt(toCard.normalize().dot(cameraForward))} rigYawDeg=${fmt((rig.yaw * 180) / Math.PI)} behind=${view.behind} screen=(${fmt(view.x)},${fmt(view.y)})`)
    // Cone icon row stays inside the card at any cone count.
    for (let i = 0; i < state.coneCount; i++) {
      const icon = findRequired(`ConeIcon_${i + 1}`).getTransform()
      const x = Math.abs(icon.getLocalPosition().x) + 0.5 * 1.63 * icon.getLocalScale().x
      c.ok(`${when}: cone icon ${i + 1} fits in the card`, x <= 12.5, `edge=${fmt(x)}`)
    }
    c.ok(`${when}: card inside the view`, view.inView, `screen=(${fmt(view.x)},${fmt(view.y)})`)
  }

  private padButtonShows(): boolean {
    return findRequired("ChangeDrillPadRoot").isEnabledInHierarchy
  }

  /** The pad button: about 25 cm above the floor, on the pad's near edge, tilted back like the strip. */
  private checkPadButton(c: Checks, state: ReturnType<typeof snap>, when: string): void {
    const root = findRequired("ChangeDrillPadRoot").getTransform()
    const position = root.getWorldPosition()
    const pad = new vec3(state.padCentre.x, state.padCentre.y, state.padCentre.z)
    const forward = new vec3(state.drillForward.x, 0, state.drillForward.z)
    const along = new vec3(position.x - pad.x, 0, position.z - pad.z).dot(forward)
    const side = new vec3(position.x - pad.x, 0, position.z - pad.z).dot(new vec3(-forward.z, 0, forward.x))
    c.near(`${when}: pad button is level with the pad's near edge, cm before centre`, along, -50, 2)
    c.between(`${when}: pad button is right of the pad centre (60 cm, or closer to stay in view), cm`, side, 10, 62)
    c.near(`${when}: pad button is about 1.1 m above the floor`, position.y - state.floorY, 110, 1)
    c.near(`${when}: pad button is tilted back about 15 degrees from vertical (normal.y)`, root.getWorldRotation().multiplyVec3(new vec3(0, 0, 1)).y, 0.259, 0.04)
  }

  private async waitForPanelToSettle(c: Checks): Promise<void> {
    const panel = findRequired("SetupPanel").getTransform()
    let last = panel.getWorldPosition()
    let still = 0
    const started = getTime()
    while (still < 30 && getTime() - started < 20) {
      await frames(1)
      const now = panel.getWorldPosition()
      still = now.distance(last) < 0.05 ? still + 1 : 0
      last = now
    }
    c.info("panel settled", `after ${fmt(getTime() - started)}s at ${fmtV(last)}`)
    await sleep(500)
  }

  private expectReset(c: Checks, placed: PlacedDrill, when: string): void {
    const state = snap()
    c.ok(`${when}: all cones pending`, state.coneStates.every((cone) => cone === "pending"), JSON.stringify(state.coneStates))
    c.ok(`${when}: no amber on the real cones`, placed.parts.amberCones().length === 0, `amber=[${placed.parts.amberCones()}]`)
    c.ok(`${when}: cone 1 highlighted`, state.highlightedIndex === 0, `highlighted=${state.highlightedIndex}`)
    c.ok(`${when}: only pole 1 is the thick next pole`, JSON.stringify(placed.parts.nextPoles()) === "[0]", `next=[${placed.parts.nextPoles()}]`)
    c.ok(`${when}: pole 1 is the brightest`, placed.parts.brightestPole() === 0, `brightest=${placed.parts.brightestPole()}`)
    c.ok(`${when}: score back to zero`, state.clearedCount === 0, `cleared=${state.clearedCount}`)
    c.ok(`${when}: card hidden`, !state.finishCardVisible && !findRequired("FinishCard").isEnabledInHierarchy)
    c.ok(`${when}: no cue`, state.cueCount === 0 && state.cueDisplayedText === "", `count=${state.cueCount} text='${state.cueDisplayedText}'`)
  }
}
