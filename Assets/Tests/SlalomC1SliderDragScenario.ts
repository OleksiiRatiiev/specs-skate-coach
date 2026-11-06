/**
 * Criterion 1, part 2: the spacing slider. REAL drags through SIK (LEAF IK arm or simulated hand), never
 * setSpacing. Checks the minimum, the maximum and a middle value, that every value seen on every frame of
 * every drag is in range and on a 0.1 m step, that the text and the ghost's real cone spacing follow the
 * slider LIVE while the drag is in progress, and that dragging the slider presses nothing else (the
 * neighbouring Place drill button, defect D1) and does not move the panel.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {
  Checks,
  CONE_COUNT,
  eventCount,
  traceEvents,
  findRequired,
  fmt,
  frames,
  isOnStep,
  Pincher,
  setSpacingByDrag,
  SkaterRig,
  SliderProbe,
  snap,
  v3,
  waitForLens,
} from "./SlalomLeafHarness"
import {SlalomCoachSnapshot} from "../Scripts/SlalomCoachTestState"

interface Sample {
  t: number
  value: number
  componentValue: number
  knobValue: number
  text: string
  snapshotGhostCm: number
  realGhostCm: number
}

function realGhostSpacingCm(): number {
  try {
    const root = findRequired("GhostDrill")
    const first = findRequired("Cone_1", root).getTransform().getWorldPosition()
    const second = findRequired("Cone_2", root).getTransform().getWorldPosition()
    return first.distance(second)
  } catch (error) {
    return -1
  }
}

@component
export class SlalomC1SliderDragScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("c1_slider_drag")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    const pincher = new Pincher(config)
    c.info("pinch mode", `${pincher.mode} hand=${pincher.defaultHand} lookDownTotal=${fmt(rig.pitchDownDeg())}`)
    const probe = new SliderProbe()
    const panel = findRequired("SetupPanel")
    const panelStart = panel.getTransform().getWorldPosition()
    c.info("slider", `trackLength=${fmt(probe.trackLengthCm())} cm right=${fmt(probe.rightAxis().x)},${fmt(probe.rightAxis().y)},${fmt(probe.rightAxis().z)} segments=${probe.slider.numberOfSegments}`)

    let samples: Sample[] = []
    const record = (state: SlalomCoachSnapshot): void => {
      samples.push({
        t: getTime(),
        value: state.sliderValueM,
        componentValue: probe.componentValue(),
        knobValue: probe.slider.knobValue,
        text: state.sliderText,
        snapshotGhostCm: state.ghostSpacingCm,
        realGhostCm: realGhostSpacingCm(),
      })
    }

    const analyse = (label: string, wanted: number): void => {
      const requireEveryStep = pincher.mode !== "ik"
      const values = samples.map((s) => s.value)
      const distinct: number[] = []
      for (const value of values) {
        if (distinct.length === 0 || distinct[distinct.length - 1] !== value) {
          distinct.push(value)
        }
      }
      c.info(`${label}: values seen`, `${samples.length} frames, sequence=${JSON.stringify(distinct)}`)
      c.ok(`${label}: every value seen is on a 0.1 m step between 0.8 and 1.5`, values.every(isOnStep), `bad=${JSON.stringify(values.filter((v) => !isOnStep(v)))}`)
      c.ok(`${label}: the UI Kit slider only ever sat on one of its 8 segments`, samples.every((s) => s.componentValue >= -1e-6 && s.componentValue <= 1 + 1e-6 && Math.abs(s.componentValue * 7 - Math.round(s.componentValue * 7)) < 1e-3), `bad=${JSON.stringify(samples.filter((s) => Math.abs(s.componentValue * 7 - Math.round(s.componentValue * 7)) >= 1e-3).map((s) => fmt(s.componentValue)))}`)
      let stepsOk = true
      for (let i = 1; i < distinct.length; i++) {
        const change = Math.abs(distinct[i] - distinct[i - 1])
        if (Math.abs(change * 10 - Math.round(change * 10)) > 1e-6 || Math.round(change * 10) < 1) {
          stepsOk = false
        }
      }
      c.ok(`${label}: every change of the Lens's value was a whole number of 0.1 m steps`, stepsOk, JSON.stringify(distinct))
      // What the wearer sees under their finger: the knob. It moves live, so it shows whether the drag was continuous.
      const knobSteps: number[] = []
      for (const sample of samples) {
        const step = Math.round(sample.knobValue * 7)
        if (knobSteps.length === 0 || knobSteps[knobSteps.length - 1] !== step) {
          knobSteps.push(step)
        }
      }
      const knobMetres = knobSteps.map((step) => Math.round((0.8 + step * 0.1) * 10) / 10)
      let knobEveryStep = knobSteps.length >= 2
      for (let i = 1; i < knobSteps.length; i++) {
        if (Math.abs(knobSteps[i] - knobSteps[i - 1]) !== 1) {
          knobEveryStep = false
        }
      }
      c.info(`${label}: knob sequence`, JSON.stringify(knobMetres))
      if (requireEveryStep) {
        c.ok(`${label}: the knob passed through every 0.1 m step, so this was a continuous drag`, knobEveryStep, JSON.stringify(knobMetres))
      }
      c.ok(`${label}: it ends on ${wanted}`, snap().sliderValueM === wanted, `value=${snap().sliderValueM}`)
      c.ok(`${label}: the text reads 'Cone spacing: ${wanted.toFixed(1)} m' on every frame that showed ${wanted}`, samples.filter((s) => s.value === wanted).every((s) => s.text === `Cone spacing: ${wanted.toFixed(1)} m`), "")
      // The text must match its own frame's value on every frame, not only at the end.
      const textMismatch = samples.filter((s) => s.text !== `Cone spacing: ${s.value.toFixed(1)} m`)
      c.ok(`${label}: the text matched the value on every frame`, textMismatch.length === 0, `mismatch frames=${textMismatch.length} first=${textMismatch.length ? JSON.stringify(textMismatch[0]) : ""}`)
    }

    const analyseLive = (label: string): void => {
      // Live: while the drag is in progress, the ghost's real cone spacing must follow the knob within two frames.
      const knobM = (sample: Sample): number => Math.round((0.8 + Math.round(sample.knobValue * 7) * 0.1) * 10) / 10
      let lagFrames = 0
      let worstLag = 0
      let pendingSince = -1
      let changes = 0
      let lastKnob = samples.length ? knobM(samples[0]) : 0
      let firstKnobMoveT = -1
      let firstGhostMoveT = -1
      const startGhost = samples.length ? samples[0].realGhostCm : 0
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]
        if (knobM(sample) !== lastKnob) {
          changes++
          if (firstKnobMoveT < 0) {
            firstKnobMoveT = sample.t
          }
          pendingSince = i
          lastKnob = knobM(sample)
        }
        if (firstGhostMoveT < 0 && sample.realGhostCm > 0 && Math.abs(sample.realGhostCm - startGhost) > 0.5) {
          firstGhostMoveT = sample.t
        }
        const follows = sample.realGhostCm > 0 && Math.abs(sample.realGhostCm - knobM(sample) * 100) < 1
        if (pendingSince >= 0) {
          if (follows) {
            worstLag = Math.max(worstLag, i - pendingSince)
            pendingSince = -1
          } else if (i - pendingSince > 2) {
            lagFrames++
          }
        }
      }
      const dragEnd = traceEvents.filter((event) => event.name === "SpacingSliderCell" && event.type === "dragEnd" && samples.length > 0 && event.t >= samples[0].t)[0]
      c.info(`${label}: timing`, `knobFirstMoved=${fmt(firstKnobMoveT)} ghostFirstMoved=${fmt(firstGhostMoveT)} dragEnd=${dragEnd ? fmt(dragEnd.t) : "none"}`)
      c.ok(`${label}: the knob moved during the drag`, changes >= 1, `knobChanges=${changes}`)
      c.ok(`${label}: the ghost started following BEFORE the drag was released`, !!dragEnd && firstGhostMoveT >= 0 && firstGhostMoveT < dragEnd.t, `ghostFirstMoved=${fmt(firstGhostMoveT)} dragEnd=${dragEnd ? fmt(dragEnd.t) : "none"}`)
      c.ok(`${label}: the ghost's real cone spacing followed the knob within 2 frames`, lagFrames === 0 && pendingSince < 0, `laggingFrames=${lagFrames} worstLagFrames=${worstLag} unresolved=${pendingSince >= 0}`)
      const textLive = samples.filter((sample) => sample.text === `Cone spacing: ${knobM(sample).toFixed(1)} m`).length
      c.ok(`${label}: the 'Cone spacing' text followed the knob during the drag`, textLive >= samples.length - 3, `textMatchedKnobOnFrames=${textLive}/${samples.length}`)
    }

    // Launch state.
    let state = snap()
    c.ok("start: slider reads 1.0 and the ghost is at 100 cm", state.sliderValueM === 1.0 && Math.abs(realGhostSpacingCm() - 100) < 0.01, `value=${state.sliderValueM} realGhost=${fmt(realGhostSpacingCm())}`)
    c.ok("start: range reported by the Lens is 0.8 to 1.5", state.spacingMinM === 0.8 && state.spacingMaxM === 1.5, `${state.spacingMinM}..${state.spacingMaxM}`)

    // 1. Over-drag left: the slider must clamp at 0.8 and never go below.
    samples = []
    await pincher.drag("SpacingSliderCell", probe.rightAxis().uniformScale(-(probe.trackLengthCm() + 20)), undefined, record)
    await frames(5)
    record(snap())
    analyse("drag far left", 0.8)
    analyseLive("drag far left")
    c.near("drag far left: the ghost's real cone spacing is 80 cm", realGhostSpacingCm(), 80, 0.01)
    c.ok("drag far left: the minimum is reachable", Math.min(...samples.map((s) => s.value)) === 0.8)
    c.ok("drag far left: nothing below 0.8 was ever seen", Math.min(...samples.map((s) => s.value)) >= 0.8 - 1e-9)

    // 2. Over-drag right: clamps at 1.5.
    samples = []
    await pincher.drag("SpacingSliderCell", probe.rightAxis().uniformScale(probe.trackLengthCm() + 20), undefined, record)
    await frames(5)
    record(snap())
    analyse("drag far right", 1.5)
    analyseLive("drag far right")
    c.near("drag far right: the ghost's real cone spacing is 150 cm", realGhostSpacingCm(), 150, 0.01)
    c.ok("drag far right: the maximum is reachable", Math.max(...samples.map((s) => s.value)) === 1.5)
    c.ok("drag far right: nothing above 1.5 was ever seen", Math.max(...samples.map((s) => s.value)) <= 1.5 + 1e-9)

    // 3. A middle value, by a closed-loop drag. The IK arm only converges to about 1.5 cm, which is most of a
    // 2 cm slider step, so a mid-range value is checked with the SIK interactor and reported as untested for IK.
    if ((config && config.get("middle")) === "false") {
      c.info("middle value", "not tested in this mode: the IK wrist cannot land a single 2 cm step reliably (see c1_slider_drag_sik)")
    } else {
      samples = []
      const dragsUsed = await setSpacingByDrag(pincher, 1.2, record)
      await frames(5)
      record(snap())
      c.info("middle value", `reached with ${dragsUsed} drag(s)`)
      analyse("drag to a middle value", 1.2)
      analyseLive("drag to a middle value")
      c.near("drag to a middle value: the ghost's real cone spacing is 120 cm", realGhostSpacingCm(), 120, 0.01)
    }

    // Nothing else was pressed, and the panel stayed where it was.
    state = snap()
    c.ok("no Place drill press during any slider drag", eventCount("PlaceDrillButton", "triggerStart") === 0, `triggerStarts=${eventCount("PlaceDrillButton", "triggerStart")} hoverEnters=${eventCount("PlaceDrillButton", "hoverEnter")}`)
    c.ok("the drill is still not placed, and the panel and ghost still show", state.setupState === "ghost" && state.setupPanelVisible && state.ghostVisible, `state=${state.setupState}`)
    const panelMoved = panel.getTransform().getWorldPosition().distance(panelStart)
    c.ok("the panel did not move while the slider was dragged", panelMoved < 1, `moved=${fmt(panelMoved)} cm following=${state.panelFollowing}`)
    c.info("events", `slider hoverEnters=${eventCount("SpacingSliderCell", "hoverEnter")} dragStarts=${eventCount("SpacingSliderCell", "dragStart")} dragEnds=${eventCount("SpacingSliderCell", "dragEnd")}`)
    c.ok("every drag was a real SIK drag on the slider", eventCount("SpacingSliderCell", "dragStart") >= 2, `dragStarts=${eventCount("SpacingSliderCell", "dragStart")}`)
    v3(panelStart)
    void CONE_COUNT
    c.finish()
  }
}
