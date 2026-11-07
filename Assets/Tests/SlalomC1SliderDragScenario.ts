/**
 * Criterion 1, part 2: the setup steppers. REAL pinches through SIK on the - and + buttons, never
 * setSpacing or setCount. Checks cone count 4 to 12 (default 6) and spacing 0.8 to 1.5 m in 0.1 m
 * steps (default 1.0), that both clamp at their ends, that the strip's text and the ghost's real cones
 * follow every press LIVE, that buttons show hover and pressed states, and that nothing else is pressed.
 * (The file keeps its old name; the slider it used to test is gone.)
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {StateName} from "SpectaclesUIKit.lspkg/Scripts/Components/Element"
import {
  buttonNamed,
  Checks,
  eventCount,
  findRequired,
  fmt,
  frames,
  isOnStep,
  Pincher,
  SkaterRig,
  snap,
  stepRow,
  waitForLens,
} from "./SlalomLeafHarness"

function ghostSpacingCm(): number {
  const root = findRequired("GhostDrill")
  return findRequired("Cone_1", root).getTransform().getWorldPosition().distance(findRequired("Cone_2", root).getTransform().getWorldPosition())
}

function ghostConeCount(): number {
  const root = findRequired("GhostDrill")
  let count = 0
  for (let i = 1; i <= 14; i++) {
    let found = false
    const visit = (o: SceneObject): void => {
      if (o.name === `Cone_${i}`) {
        found = true
      }
      for (let k = 0; k < o.getChildrenCount() && !found; k++) {
        visit(o.getChild(k))
      }
    }
    visit(root)
    if (found) {
      count++
    }
  }
  return count
}

@component
export class SlalomC1SliderDragScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("c1_steppers")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    const pincher = new Pincher(config)
    c.info("pinch mode", `${pincher.mode} lookDownTotal=${fmt(rig.pitchDownDeg())}`)

    const start = snap()
    c.ok("start: 6 cones and 1.0 m", start.coneCount === 6 && start.sliderValueM === 1.0 && start.stripCountText === "6" && start.sliderText === "1.0 m", `count=${start.coneCount} spacing=${start.sliderValueM}`)

    // Hover and pressed states on the + button.
    const seen = new Set<string>()
    buttonNamed("SpacingPlusButton").onStateChanged.add((s: StateName) => seen.add(String(s)))

    // Spacing: down to 0.8, clamp, up to 1.5, clamp. Every value on a 0.1 step, text and ghost live.
    const values: number[] = []
    let liveErrors = 0
    let liveExample = ""
    const record = async (): Promise<void> => {
      await frames(3)
      const s = snap()
      values.push(s.sliderValueM)
      const expectedCm = Math.round(s.sliderValueM * 100)
      if (s.sliderText !== `${s.sliderValueM.toFixed(1)} m` || Math.abs(ghostSpacingCm() - expectedCm) > 0.01 || s.ghostSpacingCm !== expectedCm) {
        liveErrors++
        liveExample = `value=${s.sliderValueM} text='${s.sliderText}' ghostReal=${fmt(ghostSpacingCm())} ghostSnap=${s.ghostSpacingCm}`
      }
    }
    for (let i = 0; i < 3; i++) {
      await stepRow(pincher, "Spacing", -1)
      await record()
    }
    c.ok("spacing: clamps at 0.8 m", snap().sliderValueM === 0.8, `value=${snap().sliderValueM}`)
    for (let i = 0; i < 8; i++) {
      await stepRow(pincher, "Spacing", 1)
      await record()
    }
    c.ok("spacing: clamps at 1.5 m", snap().sliderValueM === 1.5, `value=${snap().sliderValueM}`)
    c.ok("spacing: every value is on a 0.1 m step between 0.8 and 1.5", values.every(isOnStep), JSON.stringify(values))
    c.ok("spacing: text and the ghost's real cones followed every press", liveErrors === 0, `errors=${liveErrors} ${liveExample}`)
    c.ok("spacing: a press moves exactly one 0.1 step", values.slice(1).every((v, i) => Math.abs(Math.abs(v - values[i]) - 0.1) < 1e-6 || v === values[i]), JSON.stringify(values))
    c.ok("buttons show hover and pressed states", seen.has("hovered") && seen.has("triggered"), JSON.stringify(Array.from(seen)))
    for (let i = 0; i < 5; i++) {
      await stepRow(pincher, "Spacing", -1)
    }
    c.ok("spacing: back to 1.0 m", snap().sliderValueM === 1.0, `value=${snap().sliderValueM}`)

    // Cone count: 4 to 12.
    const counts: number[] = []
    let countErrors = 0
    for (let i = 0; i < 4; i++) {
      await stepRow(pincher, "Cones", -1)
      await frames(3)
      counts.push(snap().coneCount)
      if (snap().stripCountText !== `${snap().coneCount}` || ghostConeCount() !== snap().coneCount) {
        countErrors++
      }
    }
    c.ok("cones: clamps at 4", snap().coneCount === 4 && ghostConeCount() === 4, JSON.stringify(counts))
    for (let i = 0; i < 9; i++) {
      await stepRow(pincher, "Cones", 1)
      await frames(3)
      counts.push(snap().coneCount)
      if (snap().stripCountText !== `${snap().coneCount}` || ghostConeCount() !== snap().coneCount) {
        countErrors++
      }
    }
    c.ok("cones: clamps at 12", snap().coneCount === 12 && ghostConeCount() === 12, JSON.stringify(counts))
    c.ok("cones: text and the ghost's real cones followed every press", countErrors === 0, `errors=${countErrors} ${JSON.stringify(counts)}`)
    for (let i = 0; i < 6; i++) {
      await stepRow(pincher, "Cones", -1)
    }
    c.ok("cones: back to 6", snap().coneCount === 6 && ghostConeCount() === 6, `count=${snap().coneCount}`)

    const end = snap()
    c.ok("nothing else was pressed: still choosing, Place drill untouched", end.setupState === "ghost" && eventCount("PlaceDrillButton", "triggerStart") === 0, `state=${end.setupState}`)
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }
}
