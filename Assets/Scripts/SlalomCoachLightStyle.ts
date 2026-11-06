/**
 * SlalomCoachLightStyle - light, high-contrast colours for UI Kit buttons and the slider.
 *
 * Owns: the idle, hover and pressed colours, applied through the public visual API of UI Kit.
 * Why: the stock themes are dark, and dark colours turn transparent on the additive display.
 * Must not: change behaviour. It only recolours.
 */

import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {GradientParameters} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"

export const LIGHT_IDLE = new vec4(0.08, 0.58, 0.74, 1)
export const LIGHT_HOVER = new vec4(0.25, 0.80, 0.95, 1)
export const LIGHT_PRESSED = new vec4(0.90, 0.45, 0.08, 1)
const BORDER_IDLE = new vec4(0.85, 0.97, 1, 1)
const BORDER_HOVER = new vec4(1, 1, 1, 1)
const BORDER_PRESSED = new vec4(1, 1, 0.8, 1)
const TRACK = new vec4(0.26, 0.52, 0.66, 1)
const KNOB_IDLE = new vec4(0.96, 1, 1, 1)

/** A uniform "gradient", because the visuals tween between gradients but not between a colour and a gradient. */
function solid(color: vec4): GradientParameters {
  return {
    enabled: true,
    type: "Linear",
    start: new vec2(0, 1),
    end: new vec2(0, -1),
    stop0: {enabled: true, percent: 0, color},
    stop1: {enabled: true, percent: 0.5, color},
    stop2: {enabled: true, percent: 1, color},
  }
}

function colourVisual(
  visual: RoundedRectangleVisual,
  idle: vec4,
  hover: vec4,
  pressed: vec4,
  border: boolean
): void {
  visual.defaultBaseType = "Gradient"
  visual.hoveredBaseType = "Gradient"
  visual.triggeredBaseType = "Gradient"
  visual.defaultGradient = solid(idle)
  visual.hoveredGradient = solid(hover)
  visual.triggeredGradient = solid(pressed)
  visual.defaultHasBorder = border
  visual.hoveredHasBorder = border
  visual.triggeredHasBorder = border
  if (border) {
    visual.defaultBorderSize = 0.12
    visual.hoveredBorderSize = 0.2
    visual.triggeredBorderSize = 0.2
    visual.defaultBorderType = "Color"
    visual.hoveredBorderType = "Color"
    visual.triggeredBorderType = "Color"
    visual.borderDefaultColor = BORDER_IDLE
    visual.borderHoveredColor = BORDER_HOVER
    visual.borderTriggeredColor = BORDER_PRESSED
  }
}

/** Idle teal, brighter cyan on hover, amber while pressed. */
export function styleButtonLight(button: Button): void {
  const apply = () => {
    const visual = button.visual as RoundedRectangleVisual
    if (visual) {
      colourVisual(visual, LIGHT_IDLE, LIGHT_HOVER, LIGHT_PRESSED, true)
    }
  }
  if (button.initialized) {
    apply()
  } else {
    button.onInitialized.add(apply)
  }
}

/** Mid blue track, bright cyan fill that goes lighter on hover and amber while dragged, white knob. */
export function styleSliderLight(slider: Slider): void {
  const apply = () => {
    const track = slider.visual as RoundedRectangleVisual
    if (track) {
      colourVisual(track, TRACK, TRACK, TRACK, true)
    }
    const fill = slider.trackFillVisual as RoundedRectangleVisual
    if (fill) {
      colourVisual(fill, LIGHT_IDLE, LIGHT_HOVER, LIGHT_PRESSED, false)
    }
    const knob = slider.knobVisual as RoundedRectangleVisual
    if (knob) {
      colourVisual(knob, KNOB_IDLE, LIGHT_HOVER, LIGHT_PRESSED, true)
    }
  }
  if (slider.initialized) {
    apply()
  } else {
    slider.onInitialized.add(apply)
  }
}
