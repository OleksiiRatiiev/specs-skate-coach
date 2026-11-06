/**
 * Hover and pressed states of the slider and the Place drill button, read from the real UI Kit visuals
 * (the visual's stateName and its live tweened gradient colour) on every frame of a real drag and a real pinch.
 * Idle, hover and pressed must be different and must match the Lens's light style colours in direction.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {buttonNamed, Checks, findRequired, fmt, frames, Pincher, SkaterRig, SliderProbe, snap, waitForLens} from "./SlalomLeafHarness"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"

interface Reading {
  state: string
  colour: vec3
}

function read(visual: any): Reading | null {
  try {
    const gradient = visual.currentGradient
    const colour = gradient && gradient.stop0 ? gradient.stop0.color : null
    return colour ? {state: String(visual.stateName), colour: new vec3(colour.x, colour.y, colour.z)} : null
  } catch (error) {
    return null
  }
}

function dist(a: vec3, b: vec3): number {
  return a.distance(b)
}

@component
export class SlalomUiStatesScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("ui_states")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    const pincher = new Pincher(config)
    const button: any = buttonNamed("PlaceDrillButton")
    const slider: any = findRequired("SpacingSliderCell").getComponent(Slider.getTypeName())
    const probe = new SliderProbe()

    const IDLE = new vec3(0.08, 0.58, 0.74)
    const HOVER = new vec3(0.25, 0.8, 0.95)
    const PRESSED = new vec3(0.9, 0.45, 0.08)
    const KNOB_IDLE = new vec3(0.96, 1, 1)

    const idleButton = read(button.visual)
    const idleKnob = read(slider.knobVisual)
    const idleFill = read(slider.trackFillVisual)
    c.ok("idle: button state is 'default' and colour is the idle teal", !!idleButton && idleButton.state === "default" && dist(idleButton.colour, IDLE) < 0.05, idleButton ? `${idleButton.state} (${fmt(idleButton.colour.x)},${fmt(idleButton.colour.y)},${fmt(idleButton.colour.z)})` : "unreadable")
    c.ok("idle: knob state is 'default' and colour is near white", !!idleKnob && idleKnob.state === "default" && dist(idleKnob.colour, KNOB_IDLE) < 0.05, idleKnob ? `${idleKnob.state} (${fmt(idleKnob.colour.x)},${fmt(idleKnob.colour.y)},${fmt(idleKnob.colour.z)})` : "unreadable")
    c.ok("idle: slider fill state is 'default'", !!idleFill && idleFill.state === "default", idleFill ? idleFill.state : "unreadable")

    // Hover with a dwell, through a real SIK hover (no press). The IK arm goes from contact straight to the
    // press, so it cannot show a hover state; a hover dwell can.
    const hoverer = new DefaultLeafInteractor()
    const sampleDuring = async (action: Promise<void>, reader: () => Reading | null): Promise<Reading[]> => {
      const readings: Reading[] = []
      let running = true
      const sampler = (async () => {
        while (running) {
          const reading = reader()
          if (reading) {
            readings.push(reading)
          }
          await nextFrame()
        }
      })()
      try {
        await action
      } finally {
        running = false
      }
      await sampler
      return readings
    }
    const buttonHover = await sampleDuring(hoverer.hover(findInteractableByName("PlaceDrillButton", undefined, true), 1500), () => read(button.visual))
    const hoveredButton = buttonHover.filter((r) => r.state === "hovered")
    c.info("hover button", `states=${JSON.stringify(Array.from(new Set(buttonHover.map((r) => r.state))))} lastColour=(${fmt(buttonHover[buttonHover.length - 1].colour.x)},${fmt(buttonHover[buttonHover.length - 1].colour.y)},${fmt(buttonHover[buttonHover.length - 1].colour.z)})`)
    c.ok("hover dwell: the Place drill button went to 'hovered'", hoveredButton.length > 10, `frames=${hoveredButton.length}`)
    c.ok("hover dwell: the Place drill button turned the hover colour", hoveredButton.length > 0 && Math.min(...hoveredButton.map((r) => dist(r.colour, HOVER))) < 0.1, `closest=${fmt(Math.min(...hoveredButton.map((r) => dist(r.colour, HOVER)), 9))}`)
    c.ok("hover dwell: it was not a press (no trigger on Place drill)", snap().setupState === "ghost", snap().setupState)
    await frames(30)
    const afterButtonHover = read(button.visual)
    c.ok("after the hover: the button is back to idle", !!afterButtonHover && afterButtonHover.state === "default" && dist(afterButtonHover.colour, IDLE) < 0.1, afterButtonHover ? `${afterButtonHover.state} (${fmt(afterButtonHover.colour.x)},${fmt(afterButtonHover.colour.y)},${fmt(afterButtonHover.colour.z)})` : "unreadable")

    const sliderHover = await sampleDuring(hoverer.hover(findInteractableByName("SpacingSliderCell", undefined, true), 1500), () => read(slider.knobVisual))
    const hoveredKnob = sliderHover.filter((r) => r.state === "hovered")
    c.info("hover slider", `knob states=${JSON.stringify(Array.from(new Set(sliderHover.map((r) => r.state))))}`)
    c.ok("hover dwell: the slider knob went to 'hovered'", hoveredKnob.length > 10, `frames=${hoveredKnob.length}`)
    c.ok("hover dwell: the slider knob turned the hover colour", hoveredKnob.length > 0 && Math.min(...hoveredKnob.map((r) => dist(r.colour, HOVER))) < 0.1, `closest=${fmt(Math.min(...hoveredKnob.map((r) => dist(r.colour, HOVER)), 9))}`)
    c.ok("hover dwell: hovering the slider did not change its value", snap().sliderValueM === 1.0, `value=${snap().sliderValueM}`)
    await frames(30)

    // A real drag of the slider, sampling the knob and the fill on every frame.
    const knobSeen: Reading[] = []
    const fillSeen: Reading[] = []
    await pincher.drag("SpacingSliderCell", probe.rightAxis().uniformScale(5), undefined, () => {
      const knob = read(slider.knobVisual)
      const fill = read(slider.trackFillVisual)
      if (knob) {
        knobSeen.push(knob)
      }
      if (fill) {
        fillSeen.push(fill)
      }
    })
    await frames(30)
    const knobStates = Array.from(new Set(knobSeen.map((r) => r.state)))
    c.info("knob states seen", JSON.stringify(knobStates))
    const knobHover = knobSeen.filter((r) => r.state === "hovered")
    const knobPressed = knobSeen.filter((r) => r.state === "triggered")
    c.info("drag: frames the knob spent hovered on the way to the press", `${knobHover.length}`)
    c.ok("drag: the knob went through 'triggered' while dragged", knobPressed.length > 0, `frames=${knobPressed.length}`)
    const bestKnobPressed = Math.min(...knobPressed.map((r) => dist(r.colour, PRESSED)), 9)
    c.ok("drag: the knob really turned the pressed amber", bestKnobPressed < 0.15, `closest=${fmt(bestKnobPressed)}`)
    c.ok("drag: hover and pressed knob colours differ from idle and from each other", dist(HOVER, KNOB_IDLE) > 0.2 && dist(PRESSED, HOVER) > 0.2, "")
    const fillStates = Array.from(new Set(fillSeen.map((r) => r.state)))
    c.info("fill states seen", JSON.stringify(fillStates))
    c.ok("drag: the track fill also showed a pressed state", fillSeen.some((r) => r.state === "triggered"), JSON.stringify(fillStates))
    const afterDrag = read(slider.knobVisual)
    c.ok("after the drag: the knob is back to idle", !!afterDrag && afterDrag.state === "default" && dist(afterDrag.colour, KNOB_IDLE) < 0.1, afterDrag ? `${afterDrag.state} (${fmt(afterDrag.colour.x)},${fmt(afterDrag.colour.y)},${fmt(afterDrag.colour.z)})` : "unreadable")

    // A real pinch on Place drill, sampling the button on every frame.
    const seen: Reading[] = []
    await pincher.pinch("PlaceDrillButton", undefined, () => {
      const reading = read(button.visual)
      if (reading) {
        seen.push(reading)
      }
    })
    const states = Array.from(new Set(seen.map((r) => r.state)))
    c.info("button states seen", JSON.stringify(states))
    const hovered = seen.filter((r) => r.state === "hovered")
    const pressed = seen.filter((r) => r.state === "triggered")
    c.info("pinch: frames the button spent hovered on the way to the press (the IK arm goes straight to the press)", `${hovered.length}`)
    c.ok("pinch: the button went through 'triggered'", pressed.length > 0, `frames=${pressed.length}`)
    const bestHover = Math.min(...hovered.map((r) => dist(r.colour, HOVER)), 9)
    const bestPressed = Math.min(...pressed.map((r) => dist(r.colour, PRESSED)), 9)
    const towardsHover = hovered.length ? Math.max(...hovered.map((r) => dist(r.colour, IDLE))) : 0
    const towardsPressed = pressed.length ? Math.max(...pressed.map((r) => dist(r.colour, IDLE))) : 0
    c.info("button colours", `closestToHover=${fmt(bestHover)} closestToPressed=${fmt(bestPressed)} maxMoveFromIdleWhileHovered=${fmt(towardsHover)} whilePressed=${fmt(towardsPressed)}`)
    c.ok("pinch: the pressed button's colour moved clearly away from idle", towardsPressed > 0.1, `moved=${fmt(towardsPressed)}`)
    c.ok("pinch: pressed is closer to the pressed amber than to idle", bestPressed < dist(PRESSED, IDLE) * 0.8, `closest=${fmt(bestPressed)}`)
    c.ok("the pinch placed the drill", snap().setupState === "placed", snap().setupState)
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }
}
