/**
 * Drifting off the path and "Back to line". More than about 1.5 m from the path line the line glows brighter
 * for a moment, and after 2 s off it the current cue is replaced by "Back to line", with still only one cue on
 * screen. Returning to the line stops it. Path brightness is read from the real PathLine material.
 * Parameter "mode":
 *   no_cue       drift while no cue is active, hold, then return
 *   with_cue     drift the moment "Bend knees" starts, so the drift cue has to replace it
 *   return_early leave the line for 1.2 s and come back, so no cue may appear
 *   band         1.2 m from the line must do nothing, 1.9 m must trigger it
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {
  Checks,
  colorOf,
  findRequired,
  fmt,
  frames,
  hold,
  luminance,
  Pincher,
  placeWithPinches,
  PlacedDrill,
  SkaterRig,
  snap,
  stepOntoPad,
  visibleCuePhrases,
  waitForLens,
} from "./SlalomLeafHarness"
import {SlalomCoachSnapshot} from "../Scripts/SlalomCoachTestState"

interface Frame {
  t: number
  cue: string
  count: number
  displayed: string
  visible: number
  pathLum: number
  glow: number
  distance: number
}

@component
export class SlalomBackToLineScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const mode = (config && config.get("mode")) || "no_cue"
    const c = new Checks(`back_to_line_${mode}`)
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    const pincher = new Pincher(config)
    const placed = await placeWithPinches(pincher, config)
    await stepOntoPad(rig)

    const pathLine = placed.parts.part("PathLine")
    const labelText = findRequired("CueLabel").getComponent("Component.Text") as Text
    let timeline: Frame[] = []
    const record = (state: SlalomCoachSnapshot): void => {
      timeline.push({
        t: getTime(),
        cue: state.cueText,
        count: state.cueCount,
        displayed: state.cueDisplayedText,
        visible: visibleCuePhrases(labelText, state.stanceCardVisible),
        pathLum: luminance(colorOf(pathLine)),
        glow: state.pathGlow,
        distance: state.distanceToPathCm,
      })
    }
    const baselineLum = luminance(colorOf(pathLine))
    c.info("baseline", `pathLuminance=${fmt(baselineLum)} pathGlow=${fmt(snap().pathGlow)}`)

    // Moves the skater to a given distance from the path line at station s, using the Lens's own distance reading.
    const placeAtDistance = async (s: number, distance: number): Promise<number> => {
      let lateral = placed.weave(s) + distance
      for (let attempt = 0; attempt < 5; attempt++) {
        rig.setDrillPosition(s, lateral)
        await frames(3)
        const measured = snap().distanceToPathCm
        if (Math.abs(measured - distance) <= 4) {
          return measured
        }
        lateral += distance - measured
      }
      return snap().distanceToPathCm
    }

    const sampleHold = async (seconds: number): Promise<void> => hold(seconds, record)
    const firstCue = (text: string): Frame | undefined => timeline.filter((f) => f.cue === text)[0]
    const checkOneCue = (label: string): void => {
      c.ok(`${label}: never more than one cue in the Lens's state`, timeline.every((f) => f.count <= 1), `max=${Math.max(...timeline.map((f) => f.count))}`)
      c.ok(`${label}: never more than one cue phrase visible in the scene`, timeline.every((f) => f.visible <= 1), `max=${Math.max(...timeline.map((f) => f.visible))}`)
    }

    // Leave the pad along the path, so the skater is running.
    await rig.walk(0, 100, 120, () => 0)

    if (mode === "no_cue") {
      // Wait for "Eyes up" to be gone, so no cue is active when the drift starts.
      await sampleHold(0.1)
      for (let i = 0; i < 60 && (snap().cueCount > 0 || snap().cueDisplayedText !== ""); i++) {
        await hold(0.1)
      }
      let state = snap()
      c.ok("start: no cue is active", state.cueCount === 0 && state.cueDisplayedText === "", `count=${state.cueCount} text='${state.cueDisplayedText}'`)
      c.ok("start: on the line, the path is at rest", Math.abs(luminance(colorOf(pathLine)) - baselineLum) < 0.01 && state.pathGlow === 0, `lum=${fmt(luminance(colorOf(pathLine)))} glow=${fmt(state.pathGlow)}`)
      timeline = []
      const measured = await placeAtDistance(100, 190)
      const t0 = getTime() - 3 / 30
      c.near("drifted to 1.9 m from the line, measured by the Lens, cm", measured, 190, 4)
      await sampleHold(3.6)
      const cue = firstCue("Back to line")
      const peak = Math.max(...timeline.map((f) => f.pathLum))
      const lastSecond = timeline.filter((f) => f.t > t0 + 2.2)
      c.ok("the path glowed brighter for a moment", peak - baselineLum > 0.05, `peak=${fmt(peak)} baseline=${fmt(baselineLum)}`)
      c.ok("the path glow faded back to rest", lastSecond.length > 0 && lastSecond.every((f) => Math.abs(f.pathLum - baselineLum) < 0.02), `lastLums=${lastSecond.slice(0, 3).map((f) => fmt(f.pathLum))}`)
      c.ok("no cue before 2 s off the line", timeline.filter((f) => f.t < t0 + 1.7).every((f) => f.cue === "" && f.displayed === ""), `early cues=${JSON.stringify(timeline.filter((f) => f.t < t0 + 1.7 && f.cue !== "").map((f) => f.cue))}`)
      c.ok("'Back to line' showed", !!cue, "")
      if (cue) {
        c.between("'Back to line' came after about 2 s off the line, seconds", cue.t - t0, 1.8, 2.7)
        c.ok("'Back to line' really displayed on the Text", timeline.some((f) => f.displayed === "Back to line" && f.visible === 1), "")
      }
      checkOneCue("drift with no cue active")
      const spans = timeline.filter((f, i) => f.cue === "Back to line" && (i === 0 || timeline[i - 1].cue !== "Back to line")).length
      c.ok("'Back to line' showed once, not repeatedly", spans === 1, `spans=${spans}`)

      // Return to the line.
      timeline = []
      rig.setDrillPosition(100, placed.weave(100))
      const returned = getTime()
      await sampleHold(3.2)
      state = snap()
      c.ok("back on the line: the Lens sees it", state.distanceToPathCm < 150, `distance=${fmt(state.distanceToPathCm)}`)
      c.ok("back on the line: no new 'Back to line' cue", timeline.filter((f) => f.t > returned + 2.7).every((f) => f.cue !== "Back to line"), "")
      c.ok("back on the line: the cue is gone after its normal time", state.cueCount === 0 && state.cueDisplayedText === "", `count=${state.cueCount} text='${state.cueDisplayedText}'`)
      c.ok("back on the line: the path is at rest", Math.abs(luminance(colorOf(pathLine)) - baselineLum) < 0.01, `lum=${fmt(luminance(colorOf(pathLine)))}`)
      checkOneCue("returning")
    } else if (mode === "with_cue") {
      // Walk to the cone 2 line so "Bend knees" starts, and drift the moment it does.
      const weaveToCone2 = (s: number): number => placed.weave(s)
      await rig.walk(100, placed.stations[1] + 3, 100, weaveToCone2, record)
      let state = snap()
      c.ok("start: 'Bend knees' is the active cue", state.cueText === "Bend knees", `cue='${state.cueText}'`)
      timeline = []
      const t0 = getTime()
      const measured = await placeAtDistance(placed.stations[1] + 3, 190)
      c.near("drifted to 1.9 m from the line, cm", measured, 190, 4)
      await sampleHold(3.4)
      const bend = firstCue("Bend knees")
      const back = firstCue("Back to line")
      c.info("timeline", `bendKnewsSeen=${!!bend} backToLineAt=${back ? fmt(back.t - t0) : "never"}s`)
      c.ok("'Back to line' showed", !!back, "")
      if (back) {
        c.between("'Back to line' came after about 2 s off the line, seconds", back.t - t0, 1.8, 2.7)
        const before = timeline.filter((f) => f.t < back.t)
        const lastBefore = before.length ? before[before.length - 1] : undefined
        c.ok("it REPLACED the active cue: the state went straight from 'Bend knees' to 'Back to line'", !!lastBefore && lastBefore.cue === "Bend knees", `lastCueBefore='${lastBefore ? lastBefore.cue : ""}'`)
        c.ok("'Back to line' really displayed on the Text", timeline.some((f) => f.displayed === "Back to line" && f.visible === 1), "")
      }
      checkOneCue("drift while 'Bend knees' is active")
      c.ok("the path glowed brighter when the drift began", Math.max(...timeline.map((f) => f.pathLum)) - baselineLum > 0.05, `peak=${fmt(Math.max(...timeline.map((f) => f.pathLum)))}`)
      state = snap()
    } else if (mode === "return_early") {
      for (let i = 0; i < 60 && (snap().cueCount > 0 || snap().cueDisplayedText !== ""); i++) {
        await hold(0.1)
      }
      timeline = []
      const measured = await placeAtDistance(100, 190)
      c.near("drifted to 1.9 m from the line, cm", measured, 190, 4)
      await sampleHold(1.2)
      rig.setDrillPosition(100, placed.weave(100))
      await sampleHold(4.0)
      c.ok("it glowed when the drift began", Math.max(...timeline.map((f) => f.pathLum)) - baselineLum > 0.05, `peak=${fmt(Math.max(...timeline.map((f) => f.pathLum)))}`)
      c.ok("returning before 2 s: 'Back to line' never showed", !firstCue("Back to line"), `first=${firstCue("Back to line") ? "yes" : "no"}`)
      c.ok("returning before 2 s: no cue at all", timeline.every((f) => f.cue === "" && f.displayed === ""), "")
      c.ok("the path glow faded back to rest", Math.abs(luminance(colorOf(pathLine)) - baselineLum) < 0.01, `lum=${fmt(luminance(colorOf(pathLine)))}`)
      checkOneCue("short excursion")
    } else {
      for (let i = 0; i < 60 && (snap().cueCount > 0 || snap().cueDisplayedText !== ""); i++) {
        await hold(0.1)
      }
      timeline = []
      const inside = await placeAtDistance(100, 120)
      c.near("placed 1.2 m from the line, cm", inside, 120, 4)
      await sampleHold(3.2)
      c.ok("1.2 m from the line: the path does not glow", timeline.every((f) => Math.abs(f.pathLum - baselineLum) < 0.01 && f.glow === 0), `peak=${fmt(Math.max(...timeline.map((f) => f.pathLum)))}`)
      c.ok("1.2 m from the line, even after 3 s: no cue", timeline.every((f) => f.cue === ""), "")
      timeline = []
      const t0 = getTime()
      const outside = await placeAtDistance(100, 190)
      c.near("moved to 1.9 m from the line, cm", outside, 190, 4)
      await sampleHold(3.2)
      c.ok("1.9 m from the line: the path glows", Math.max(...timeline.map((f) => f.pathLum)) - baselineLum > 0.05, `peak=${fmt(Math.max(...timeline.map((f) => f.pathLum)))}`)
      const cue = firstCue("Back to line")
      c.ok("1.9 m from the line, after 2 s: 'Back to line'", !!cue && cue.t - t0 >= 1.8 && cue.t - t0 <= 2.7, cue ? `at ${fmt(cue.t - t0)} s` : "never")
      checkOneCue("band")
    }
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
    void (placed as PlacedDrill)
  }
}
