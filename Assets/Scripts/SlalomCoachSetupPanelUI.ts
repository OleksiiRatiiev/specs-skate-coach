/**
 * SlalomCoachSetupPanelUI - the compact setup strip anchored to the ghost's start pad.
 *
 * Owns: the two stepper rows (cone count, cone spacing), the PLACE DRILL button and their neon look.
 * Reports: onCountChanged(n), onSpacingChanged(m) and onPlaceDrill.
 * Must not: decide anything about the drill, or position itself. SlalomCoachMain owns the values
 * and moves this object with the ghost (about 90 cm above the pad, tilted back about 30 degrees).
 * Local space: centred on the object, facing +Z, units in cm.
 */

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {CYAN, NeonButton, NeonPlate, addNeonText, withAlpha} from "./SlalomCoachNeon"

export const COUNT_MIN = 4
export const COUNT_MAX = 12
export const COUNT_DEFAULT = 6
const SPACING_MIN_M = 0.8
const SPACING_MAX_M = 1.5
const SPACING_STEP_M = 0.1

const STRIP_W = 38
const STRIP_H = 33
const STEP_BUTTON = 7
const PULSE_PERIOD_SEC = 2.6

function snapSpacing(m: number): number {
  const steps = Math.round((m - SPACING_MIN_M) / SPACING_STEP_M)
  const snapped = SPACING_MIN_M + Math.max(0, Math.min(Math.round((SPACING_MAX_M - SPACING_MIN_M) / SPACING_STEP_M), steps)) * SPACING_STEP_M
  return Math.round(snapped * 10) / 10
}

@component
export class SlalomCoachSetupPanelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachSetupPanelUI - cone count, spacing, Place drill</span>')
  @ui.separator

  private _onSpacingChanged = new Event<number>()
  private _onCountChanged = new Event<number>()
  private _onPlaceDrill = new Event<void>()
  private spacingM = 1.0
  private count = COUNT_DEFAULT
  private countText: Text
  private spacingText: Text
  private placeButton: NeonButton
  private plusMinus: Record<string, NeonButton> = {}
  private time = 0

  get onSpacingChanged(): PublicApi<number> {
    return this._onSpacingChanged.publicApi()
  }

  get onCountChanged(): PublicApi<number> {
    return this._onCountChanged.publicApi()
  }

  get onPlaceDrill(): PublicApi<void> {
    return this._onPlaceDrill.publicApi()
  }

  onAwake(): void {
    this.build()
    this.createEvent("UpdateEvent").bind(() => {
      this.time += getDeltaTime()
      this.placeButton.setPulse(0.5 + 0.5 * Math.sin((this.time / PULSE_PERIOD_SEC) * Math.PI * 2))
    })
  }

  /** Sets the spacing in metres. Snaps to 0.1 m steps between 0.8 and 1.5. */
  setSpacing(m: number): void {
    this.spacingM = snapSpacing(m)
    this.refresh()
  }

  setCount(n: number): void {
    this.count = Math.max(COUNT_MIN, Math.min(COUNT_MAX, Math.round(n)))
    this.refresh()
  }

  getSpacing(): number {
    return this.spacingM
  }

  getCount(): number {
    return this.count
  }

  getValueText(): string {
    return this.spacingText ? this.spacingText.text : ""
  }

  getCountText(): string {
    return this.countText ? this.countText.text : ""
  }

  setVisible(visible: boolean): void {
    this.sceneObject.enabled = visible
  }

  isVisible(): boolean {
    return this.sceneObject.enabled
  }

  /** The strip has no follow behaviour: it is anchored to the ghost's start pad. */
  isFollowing(): boolean {
    return false
  }

  hasFollowBehavior(): boolean {
    return false
  }

  /** Same as pinching PLACE DRILL. */
  pressPlace(): void {
    this._onPlaceDrill.invoke()
  }

  /** Same as pinching one of the stepper buttons: "count" or "spacing", direction -1 or +1. */
  step(which: "count" | "spacing", direction: number): void {
    if (which === "count") {
      const next = Math.max(COUNT_MIN, Math.min(COUNT_MAX, this.count + direction))
      if (next !== this.count) {
        this.count = next
        this.refresh()
        this._onCountChanged.invoke(next)
      }
    } else {
      const next = snapSpacing(this.spacingM + direction * SPACING_STEP_M)
      if (next !== this.spacingM) {
        this.spacingM = next
        this.refresh()
        this._onSpacingChanged.invoke(next)
      }
    }
  }

  private build(): void {
    const root = this.sceneObject
    new NeonPlate(root, "StripPlate", STRIP_W, STRIP_H, CYAN, {chamfer: 2.2, line: 0.22, fillAlpha: 0.1, brackets: true, order: 4})

    const rowY = [STRIP_H / 2 - 2.5 - 4, STRIP_H / 2 - 2.5 - 4 - 10]
    const columnX = STRIP_W / 2 - 2 - STEP_BUTTON / 2
    const rows: {key: "count" | "spacing"; label: string}[] = [
      {key: "count", label: "CONES"},
      {key: "spacing", label: "CONE SPACING"},
    ]
    rows.forEach((row, i) => {
      const y = rowY[i]
      const prefix = row.key === "count" ? "Cones" : "Spacing"
      const minus = new NeonButton(root, `${prefix}MinusButton`, "", STEP_BUTTON, STEP_BUTTON, new vec3(-columnX, y, 0.1), {icon: "minus"})
      const plus = new NeonButton(root, `${prefix}PlusButton`, "", STEP_BUTTON, STEP_BUTTON, new vec3(columnX, y, 0.1), {icon: "plus"})
      minus.onPress.add(() => this.step(row.key, -1))
      plus.onPress.add(() => this.step(row.key, 1))
      this.plusMinus[`${row.key}-`] = minus
      this.plusMinus[`${row.key}+`] = plus
      const value = addNeonText(root, "", "Bold", 5, new vec4(1, 1, 1, 1), {glow: true, position: new vec3(0, y + 0.9, 0.3), name: `${prefix}Value`, spacing: 0.04})
      value.textFill.color = CYAN
      addNeonText(root, row.label, "Medium", 1.25, withAlpha(CYAN, 0.9), {spacing: 0.16, position: new vec3(0, y - 3.0, 0.3), name: `${prefix}Label`})
      if (row.key === "count") {
        this.countText = value
      } else {
        this.spacingText = value
      }
    })

    this.placeButton = new NeonButton(root, "PlaceDrillButton", "PLACE DRILL", STRIP_W - 5, 7.5, new vec3(0, -(STRIP_H / 2 - 2.5 - 3.75), 0.1), {
      style: "primary",
      weight: "SemiBold",
      capCm: 2.3,
      spacing: 0.14,
    })
    this.placeButton.onPress.add(() => this._onPlaceDrill.invoke())
    this.refresh()
  }

  private refresh(): void {
    if (this.countText) {
      this.countText.text = `${this.count}`
    }
    if (this.spacingText) {
      this.spacingText.text = `${this.spacingM.toFixed(1)} m`
    }
  }
}
