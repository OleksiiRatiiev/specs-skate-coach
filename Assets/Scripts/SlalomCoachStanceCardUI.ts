/**
 * SlalomCoachStanceCardUI - compact neon stance reminder beside the start pad.
 *
 * Owns: its layout (chamfered cyan outline, light fill, three uppercase lines, no icon).
 * Must not: decide when to show or where to stand. SlalomCoachMain places it and shows it while
 * the skater is on the pad.
 * Local space: centred on the object, facing +Z, units in cm.
 */

import {CYAN, NeonPlate, addNeonText} from "./SlalomCoachNeon"

const CARD_W = 22
const CARD_H = 12.5
const LINE_CAP = 1.9
const LINE_PITCH = 3.2
const LINES = ["EYES UP", "KNEES BENT", "ARMS FORWARD"]
const TEXT_COLOR = new vec4(0.9, 1, 1, 1)

@component
export class SlalomCoachStanceCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachStanceCardUI - stance reminder beside the pad</span>')
  @ui.separator

  private hideWhenReady = false
  private ready = false

  onAwake(): void {
    const root = this.sceneObject
    new NeonPlate(root, "StancePlate", CARD_W, CARD_H, CYAN, {chamfer: 1.6, line: 0.18, fillAlpha: 0.12, brackets: true, order: 4})
    LINES.forEach((line, index) => {
      const y = (1 - index) * LINE_PITCH
      addNeonText(root, line, "Bold", LINE_CAP, TEXT_COLOR, {glow: true, spacing: 0.1, position: new vec3(0, y, 0.3), name: `StanceLine_${index + 1}`})
    })

    // Hide only after the first frame, so every component has started.
    const firstUpdate = this.createEvent("UpdateEvent")
    firstUpdate.bind(() => {
      firstUpdate.enabled = false
      this.ready = true
      if (this.hideWhenReady) {
        this.sceneObject.enabled = false
      }
    })
  }

  setVisible(visible: boolean): void {
    this.hideWhenReady = !visible
    if (this.ready) {
      this.sceneObject.enabled = visible
    }
  }

  isVisible(): boolean {
    return this.sceneObject.enabled && !this.hideWhenReady
  }
}
