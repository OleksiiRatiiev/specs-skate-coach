/**
 * Criterion 3, One cue at a time. Walks a clean weave and samples every frame. Parameter "speed" is
 * cm/s: at the slow default each cue can fade by itself, while at the fast one cues replace each other.
 * Compares the Lens's cue state with what the real Text components are showing, on every frame.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {allTexts, Checks, CONE_COUNT, CUE_PHRASES, findRequired, fmt, fmtV, frames, Pincher, placeWithPinches, SkaterRig, snap, stepOntoPad, v3, waitForLens} from "./SlalomLeafHarness"
import {SlalomCoachSnapshot} from "../Scripts/SlalomCoachTestState"

interface CueSpan {
  text: string
  startTime: number
  startStation: number
  endTime: number
  fadedTime: number
  position: vec3
  placed: boolean
  moved: number
  travel: number
}

@component
export class SlalomC3CuesScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const speed = parseFloat((config && config.get("speed")) || "60")
    const slow = speed <= 80
    const c = new Checks(`c3_cues_${speed}`)
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(3)
    const pincher = new Pincher(config)
    c.info("pinch mode", pincher.mode)

    const placed = await placeWithPinches(pincher, config)
    await stepOntoPad(rig)
    const onPad = snap()
    c.ok("on the pad: no cue yet", onPad.cueCount === 0 && onPad.cueDisplayedText === "", `count=${onPad.cueCount} text='${onPad.cueDisplayedText}'`)
    c.ok("on the pad: stance card shows", onPad.stanceCardVisible)
    c.ok("on the pad: highlight on cone 1", onPad.highlightedIndex === 0)

    const label = findRequired("CueLabel")
    const labelText = label.getComponent("Component.Text") as Text
    const cueObject = findRequired("CueText")
    const texts = allTexts()

    const spans: CueSpan[] = []
    let current: CueSpan | null = null
    let previousCue = ""
    let frameCount = 0
    let maxCueCount = 0
    let maxVisibleCueTexts = 0
    let strayCueTextFrames = 0
    let strayExample = ""
    let highlightErrors = 0
    let highlightExample = ""
    let haloErrors = 0
    let thickErrors = 0
    let thickExample = ""
    let haloExample = ""
    let brightErrors = 0
    let mismatchFrames = 0
    let mismatchStart = -1
    let longestMismatch = 0
    let skewFrames = 0
    let skewRun = 0
    let longestSkew = 0
    let mismatchExample = ""
    let seenStations: number[] = []
    let previousHighlight = 0
    const highlightOrder: number[] = [0]
    let lastAlpha = 0
    let lastStationSeen = 0
    let stanceAfterLeaving = 0

    const sample = (state: SlalomCoachSnapshot): void => {
      frameCount++
      const now = getTime()
      maxCueCount = Math.max(maxCueCount, state.cueCount)

      // What a person would see: every enabled Text in the scene that shows a cue phrase.
      let visible = 0
      for (const text of texts) {
        if (isNull(text) || !text.getSceneObject().isEnabledInHierarchy || CUE_PHRASES.indexOf(text.text) < 0) {
          continue
        }
        if (text === labelText) {
          if (text.textFill.color.a > 0.001) {
            visible++
          }
        } else if (!state.stanceCardVisible) {
          strayCueTextFrames++
          strayExample = `'${text.text}' on ${text.getSceneObject().name} at s=${fmt(state.skaterStationCm)}`
          visible++
        }
      }
      maxVisibleCueTexts = Math.max(maxVisibleCueTexts, visible)

      // Displayed text against state. A swap trails by design, for the length of the quick fade.
      const shown = label.isEnabledInHierarchy ? labelText.text : ""
      if (state.cueText !== "" && shown !== state.cueText && labelText.textFill.color.a > 0.001) {
        mismatchFrames++
        if (mismatchStart < 0) {
          mismatchStart = now
        }
        longestMismatch = Math.max(longestMismatch, now - mismatchStart)
        mismatchExample = `state='${state.cueText}' shown='${shown}' alpha=${fmt(labelText.textFill.color.a)} s=${fmt(state.skaterStationCm)}`
      } else {
        mismatchStart = -1
      }
      // The snapshot was published last LateUpdate and the Text is read now, so one frame's skew at a
      // transition is sampling. Two frames running means they really disagree.
      if (shown !== state.cueDisplayedText) {
        skewFrames++
        skewRun++
        longestSkew = Math.max(longestSkew, skewRun)
        c.info("display skew", `snapshot='${state.cueDisplayedText}' text='${shown}' alpha=${fmt(labelText.textFill.color.a)} s=${fmt(state.skaterStationCm)}`)
      } else {
        skewRun = 0
      }
      if (state.skaterStationCm > 60 && state.stanceCardVisible) {
        stanceAfterLeaving++
      }

      // Spans of the logical cue.
      if (state.cueText !== previousCue) {
        if (current && previousCue !== "") {
          current.endTime = now
        }
        if (state.cueText !== "") {
          current = {
            text: state.cueText,
            startTime: now,
            startStation: state.skaterStationCm,
            endTime: -1,
            fadedTime: -1,
            position: state.cueWorldPosition ? v3(state.cueWorldPosition) : vec3.zero(),
            placed: false,
            moved: 0,
            travel: state.skaterStationCm - lastStationSeen,
          }
          spans.push(current)
        }
        previousCue = state.cueText
      }
      if (state.cueText === "" && current && current.endTime > 0 && current.fadedTime < 0 && state.cueAlpha <= 0.001 && lastAlpha > 0) {
        current.fadedTime = now
      }
      lastAlpha = state.cueAlpha

      // Highlight against the real cone stations, and against what is actually lit.
      let expected = 0
      while (expected < CONE_COUNT && placed.stations[expected] <= state.skaterStationCm) {
        expected++
      }
      const expectedIndex = expected < CONE_COUNT ? expected : -1
      if (state.highlightedIndex !== expectedIndex) {
        highlightErrors++
        highlightExample = `s=${fmt(state.skaterStationCm)} highlighted=${state.highlightedIndex} expected=${expectedIndex}`
      }
      const lit = placed.parts.litHalos()
      const expectedLit = state.highlightedIndex >= 0 ? [state.highlightedIndex] : []
      if (JSON.stringify(lit) !== JSON.stringify(expectedLit)) {
        haloErrors++
        haloExample = `s=${fmt(state.skaterStationCm)} lit=[${lit}] expected=[${expectedLit}]`
      }
      const thick = placed.parts.nextPoles()
      if (JSON.stringify(thick) !== JSON.stringify(expectedLit)) {
        thickErrors++
        thickExample = `s=${fmt(state.skaterStationCm)} thick=[${thick}] expected=[${expectedLit}]`
      }
      if (state.highlightedIndex >= 0 && placed.parts.brightestPole() !== state.highlightedIndex) {
        brightErrors++
      }
      if (state.highlightedIndex !== previousHighlight) {
        highlightOrder.push(state.highlightedIndex)
        previousHighlight = state.highlightedIndex
      }
      seenStations.push(state.skaterStationCm)
      lastStationSeen = state.skaterStationCm
    }

    let measuredPlacement = false
    const placementChecks: string[] = []
    await rig.walk(0, placed.finish + 20, speed, placed.weave, (state) => {
      sample(state)
      // During a swap the old cue is still fading at the old spot, so a cue's placement is judged
      // from the frame its own text first appears.
      const span = spans.length > 0 ? spans[spans.length - 1] : null
      if (!span || state.cueText !== span.text || !label.isEnabledInHierarchy || labelText.text !== span.text) {
        return
      }
      // Read live, like the text above. The snapshot's position is a frame older.
      const position = cueObject.getTransform().getWorldPosition()
      if (!span.placed) {
        span.placed = true
        span.position = position
        const pad = v3(state.padCentre)
        const forward = v3(state.drillForward)
        const right = v3(state.drillRight)
        const offset = position.sub(pad)
        const ahead = offset.dot(forward) - span.startStation
        const height = position.y - state.floorY
        const pathT = placed.weave(offset.dot(forward))
        const side = Math.abs(offset.dot(right) - pathT)
        const view = rig.viewOf(position)
        placementChecks.push(`${span.text}: aheadOfTrigger=${fmt(ahead)} aheadNow=${fmt(offset.dot(forward) - state.skaterStationCm)} height=${fmt(height)} offPath=${fmt(side)} screen=(${fmt(view.x)},${fmt(view.y)}) inView=${view.inView}`)
        c.between(`${span.text}: about 2 to 3 m ahead of where it was triggered`, ahead, 190, 310)
        c.between(`${span.text}: about 1.2 m above the floor`, height, 110, 130)
        c.between(`${span.text}: offset to the side of the path, cm`, side, 10, 90)
        c.ok(`${span.text}: inside the view when it appears`, view.inView, `screen=(${fmt(view.x)},${fmt(view.y)})`)
        measuredPlacement = true
      }
      span.moved = Math.max(span.moved, position.distance(span.position))
    })

    // Let the last cue finish.
    for (let i = 0; i < 90; i++) {
      await frames(1)
      sample(snap())
    }

    c.info("spans", spans.map((s) => `${s.text}@s=${fmt(s.startStation)} active=${fmt(s.endTime - s.startTime)}s faded=${s.fadedTime > 0 ? fmt(s.fadedTime - s.startTime) : "n/a"}s moved=${fmt(s.moved)}`).join(" ; "))
    c.info("placement", placementChecks.join(" ; "))
    c.info("frames", `sampled=${frameCount}`)
    c.ok("walk covered the drill", frameCount > 30 && measuredPlacement, `frames=${frameCount}`)

    const order = spans.map((s) => s.text)
    c.ok("cue order is Eyes up, Bend knees, Arms forward", JSON.stringify(order) === JSON.stringify(["Eyes up", "Bend knees", "Arms forward"]), JSON.stringify(order))
    if (spans.length === 3) {
      c.between("Eyes up shows on leaving the pad, at station", spans[0].startStation, 50, 70)
      // A cue can only be seen on the first frame after the crossing, so it may be at most one frame's travel late.
      c.ok("Bend knees shows on reaching cone 2: at the line, no later than that frame's travel", spans[1].startStation - placed.stations[1] >= 0 && spans[1].startStation - placed.stations[1] <= spans[1].travel + 1, `past=${fmt(spans[1].startStation - placed.stations[1])} frameTravel=${fmt(spans[1].travel)}`)
      c.ok("Arms forward shows on reaching cone 5: at the line, no later than that frame's travel", spans[2].startStation - placed.stations[4] >= 0 && spans[2].startStation - placed.stations[4] <= spans[2].travel + 1, `past=${fmt(spans[2].startStation - placed.stations[4])} frameTravel=${fmt(spans[2].travel)}`)
      for (const span of spans) {
        c.ok(`${span.text} really appeared`, span.placed)
        c.near(`${span.text} stays world anchored, cm moved`, span.moved, 0, 0.01)
      }
      if (slow) {
        for (const span of spans) {
          c.between(`${span.text} is active for about 2 s`, span.endTime - span.startTime, 1.7, 2.6)
          c.ok(`${span.text} has faded right out`, span.fadedTime > 0, `faded=${fmt(span.fadedTime)}`)
          if (span.fadedTime > 0) {
            c.between(`${span.text} gone within about 2 s plus the fade`, span.fadedTime - span.startTime, 2, 3)
          }
        }
      } else {
        c.between("Eyes up replaced early, seconds", spans[0].endTime - spans[0].startTime, 0.3, 2.6)
      }
    }

    c.ok("never more than one cue in state", maxCueCount <= 1, `max=${maxCueCount}`)
    c.ok("never more than one cue phrase visible in the scene", maxVisibleCueTexts <= 1, `max=${maxVisibleCueTexts}`)
    c.ok("no cue phrase visible anywhere else off the pad", strayCueTextFrames === 0, `frames=${strayCueTextFrames} ${strayExample}`)
    c.ok("displayed text matches the cue state, apart from the quick swap", longestMismatch <= 0.4, `mismatchFrames=${mismatchFrames} longestSeconds=${fmt(longestMismatch)} last: ${mismatchExample}`)
    c.ok("snapshot's displayed text never disagrees with the Text component for two frames running", longestSkew <= 1, `skewFrames=${skewFrames} longestRun=${longestSkew}`)
    c.ok("stance card hides after leaving the pad", stanceAfterLeaving === 0, `frames=${stanceAfterLeaving}`)
    c.ok("after the last cue, no text remains", snap().cueDisplayedText === "" && snap().cueCount === 0, `text='${snap().cueDisplayedText}' count=${snap().cueCount}`)

    c.ok("highlight always matches the next cone by real station", highlightErrors === 0, `errors=${highlightErrors} ${highlightExample}`)
    c.ok("exactly the highlighted pole's halo is lit", haloErrors === 0, `errors=${haloErrors} ${haloExample}`)
    c.ok("exactly the highlighted cone shows the thick 4 cm PoleNext", thickErrors === 0, `errors=${thickErrors} ${thickExample}`)
    c.ok("highlighted pole is the brightest", brightErrors === 0, `errors=${brightErrors}`)
    c.ok("highlight stepped through every cone in order", JSON.stringify(highlightOrder) === "[0,1,2,3,4,5,-1]", JSON.stringify(highlightOrder))
    const end = snap()
    c.info("end", `phase=${end.runPhase} cleared=${end.clearedCount} cones=${JSON.stringify(end.coneStates)} eye=${fmtV(end.cameraPosition)}`)
    c.ok("this weave cleared every cone", end.clearedCount === 6, `cleared=${end.clearedCount}`)
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }
}
