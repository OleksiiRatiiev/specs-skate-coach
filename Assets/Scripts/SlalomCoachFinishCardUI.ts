/**
 * SlalomCoachFinishCardUI - the end-of-run card: result headline, one icon per cone, a real-numbers
 * line, and the AGAIN / MOVE DRILL buttons.
 *
 * Owns: its neon layout, the clean-run celebration look (magenta frame, brief headline glitch).
 * Reports: onAgain and onMoveDrill.
 * Must not: keep score or decide when to show. SlalomCoachMain pushes the result in.
 */

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {AMBER, CYAN, MAGENTA, NeonButton, NeonPlate, Part, WHITE, addConeIcon, addNeonText, withAlpha} from "./SlalomCoachNeon"

const CARD_W = 40
const CARD_H = 30
const MAX_CONES = 12
const GLITCH_EVERY_SEC = 3.4
const GLITCH_LENGTH_SEC = 0.28

@component
export class SlalomCoachFinishCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachFinishCardUI - end of run result</span>')
  @ui.separator

  private _onAgain = new Event<void>()
  private _onMoveDrill = new Event<void>()
  private plate: NeonPlate
  private headline: Text
  private glitchMagenta: Text
  private glitchCyan: Text
  private detail: Text
  private icons: Part[] = []
  private againButton: NeonButton
  private moveButton: NeonButton
  private scoreText = ""
  private clean = false
  private celebrating = false
  private hideWhenReady = false
  private ready = false
  private glitchClock = 0
  private glitchStep = 0
  private glitchActive = false

  get onAgain(): PublicApi<void> {
    return this._onAgain.publicApi()
  }

  get onMoveDrill(): PublicApi<void> {
    return this._onMoveDrill.publicApi()
  }

  onAwake(): void {
    const root = this.sceneObject
    this.plate = new NeonPlate(root, "CardPlate", CARD_W, CARD_H, CYAN, {chamfer: 2.4, line: 0.22, fillAlpha: 0.1, brackets: true, order: 4})

    addNeonText(root, "RUN COMPLETE", "Medium", 1.3, withAlpha(CYAN, 0.9), {spacing: 0.22, position: new vec3(0, 11.6, 0.3), name: "RunCompleteLabel"})
    this.glitchMagenta = addNeonText(root, "", "Bold", 4.2, withAlpha(MAGENTA, 0.85), {spacing: 0.06, position: new vec3(0, 7, 0.28), name: "HeadlineGlitchMagenta", order: 38})
    this.glitchCyan = addNeonText(root, "", "Bold", 4.2, withAlpha(CYAN, 0.85), {spacing: 0.06, position: new vec3(0, 7, 0.29), name: "HeadlineGlitchCyan", order: 39})
    this.headline = addNeonText(root, "", "Bold", 4.2, CYAN, {spacing: 0.06, glow: true, position: new vec3(0, 7, 0.3), name: "Headline"})
    this.glitchMagenta.enabled = false
    this.glitchCyan.enabled = false
    this.detail = addNeonText(root, "", "Medium", 1.25, new vec4(0.92, 1, 1, 0.95), {spacing: 0.08, position: new vec3(0, -3.2, 0.3), name: "DetailLine"})

    for (let i = 0; i < MAX_CONES; i++) {
      this.icons.push(addConeIcon(root, `ConeIcon_${i + 1}`, 2.6, 3.2, CYAN, new vec3(0, 1.5, 0.2)))
    }

    this.againButton = new NeonButton(root, "AgainButton", "AGAIN", 16, 6.5, new vec3(-8.8, -9.3, 0.1), {
      style: "primary",
      icon: "restart",
      weight: "SemiBold",
      capCm: 1.9,
      spacing: 0.14,
    })
    this.moveButton = new NeonButton(root, "MoveDrillButton", "MOVE DRILL", 16, 6.5, new vec3(8.8, -9.3, 0.1), {
      style: "white",
      weight: "SemiBold",
      capCm: 1.9,
      spacing: 0.14,
    })
    this.againButton.onPress.add(() => this._onAgain.invoke())
    this.moveButton.onPress.add(() => this._onMoveDrill.invoke())

    // Hide only after UI Kit has started, because a disabled object never gets OnStart.
    const firstUpdate = this.createEvent("UpdateEvent")
    firstUpdate.bind(() => {
      firstUpdate.enabled = false
      this.ready = true
      if (this.hideWhenReady) {
        this.sceneObject.enabled = false
      }
    })
    this.createEvent("UpdateEvent").bind(() => this.tickGlitch(getDeltaTime()))
  }

  /** states: one entry per cone in order, "cleared" or anything else for missed. */
  setResult(states: string[]): void {
    const total = states.length
    const cleared = states.filter((s) => s === "cleared").length
    this.clean = cleared === total
    this.scoreText = `${cleared}/${total}`
    const title = this.clean ? "CLEAN RUN" : "NICE RUN"
    this.headline.text = title
    this.glitchMagenta.text = title
    this.glitchCyan.text = title

    const missed: number[] = []
    states.forEach((s, i) => {
      if (s !== "cleared") {
        missed.push(i + 1)
      }
    })
    this.detail.text = this.clean
      ? `${cleared}/${total} cones · eyes up all the way`
      : `${cleared}/${total} cones · ${missed.length === 1 ? `cone ${missed[0]} is` : `cones ${this.joinList(missed)} are`} marked on the drill`

    const pitch = Math.min(3.6, (CARD_W - 8) / total)
    const scale = Math.min(1, pitch / 3.6)
    this.icons.forEach((icon, i) => {
      icon.object.enabled = i < total
      if (i < total) {
        icon.object.getTransform().setLocalPosition(new vec3((i - (total - 1) / 2) * pitch, 1.5, 0.2))
        icon.object.getTransform().setLocalScale(new vec3(scale, scale, 1))
        icon.material.mainPass.baseColor = states[i] === "cleared" ? CYAN : AMBER
      }
    })
    this.setCelebrating(false)
  }

  /** Clean-run celebration look: magenta frame, headline glitches briefly every few seconds. */
  setCelebrating(on: boolean): void {
    this.celebrating = on
    this.plate.setColor(on ? MAGENTA : CYAN)
    this.plate.setGlow(on ? 1.5 : 1)
    this.headline.outlineSettings.fill.color = withAlpha(on ? MAGENTA : CYAN, 0.35)
    this.glitchClock = 0
    this.endGlitch()
  }

  getScoreText(): string {
    return this.scoreText
  }

  getHeadlineText(): string {
    return this.headline ? this.headline.text : ""
  }

  getDetailText(): string {
    return this.detail ? this.detail.text : ""
  }

  isCelebrating(): boolean {
    return this.celebrating
  }

  isGlitching(): boolean {
    return this.glitchActive
  }

  getFrameColor(): vec4 {
    return this.plate.getColor()
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

  private joinList(values: number[]): string {
    return values.length <= 1 ? `${values[0]}` : `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`
  }

  private tickGlitch(dt: number): void {
    if (!this.celebrating) {
      return
    }
    this.glitchClock += dt
    const phase = this.glitchClock % GLITCH_EVERY_SEC
    if (phase < GLITCH_LENGTH_SEC && this.glitchClock > 0.9) {
      this.glitchActive = true
      this.glitchStep += dt
      if (this.glitchStep > 0.04) {
        this.glitchStep = 0
        const jitter = () => (Math.random() - 0.5) * 1.1
        this.glitchMagenta.enabled = true
        this.glitchCyan.enabled = true
        this.glitchMagenta.getSceneObject().getTransform().setLocalPosition(new vec3(-0.5 + jitter(), 7 + jitter() * 0.3, 0.28))
        this.glitchCyan.getSceneObject().getTransform().setLocalPosition(new vec3(0.5 + jitter(), 7 + jitter() * 0.3, 0.29))
        this.headline.getSceneObject().getTransform().setLocalPosition(new vec3(jitter() * 0.5, 7, 0.3))
        this.headline.textFill.color = Math.random() < 0.3 ? WHITE : CYAN
      }
    } else if (this.glitchActive) {
      this.endGlitch()
    }
  }

  private endGlitch(): void {
    this.glitchActive = false
    if (!this.headline) {
      return
    }
    this.glitchMagenta.enabled = false
    this.glitchCyan.enabled = false
    this.headline.getSceneObject().getTransform().setLocalPosition(new vec3(0, 7, 0.3))
    this.headline.textFill.color = CYAN
  }
}
