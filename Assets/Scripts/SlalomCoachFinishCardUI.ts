/**
 * SlalomCoachFinishCardUI - the end-of-run card: result headline, one icon per cone, a real-numbers
 * line, and the AGAIN / CHANGE DRILL buttons.
 *
 * Owns: its neon layout, the clean-run celebration look (magenta frame, brief headline glitch).
 * Reports: onAgain and onChangeDrill.
 * Must not: keep score or decide when to show. SlalomCoachMain pushes the result in.
 */

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {AMBER, CYAN, MAGENTA, NeonButton, NeonPlate, Part, WHITE, addConeIcon, addNeonText, withAlpha} from "./SlalomCoachNeon"

const CARD_W = 28
const CARD_H = 18
const INNER_W = 24 // text and icons stay inside this width
const HEADLINE_CAP = 3.5
const SUBLINE_CAP = 1.3
const ICON_H = 2
const ICON_W = 1.63
const ICON_MAX_PITCH = 2.4
const HEADLINE_Y = 4.7
const ICON_Y = 1.6
const SUBLINE_Y = -1.5
const BUTTON_W = 11
const BUTTON_H = 4
const BUTTON_Y = -6.2
const BUTTON_X = 6.25
const MAX_CONES = 12
const GLITCH_EVERY_SEC = 3.4
const GLITCH_LENGTH_SEC = 0.28

@component
export class SlalomCoachFinishCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachFinishCardUI - end of run result</span>')
  @ui.separator

  private _onAgain = new Event<void>()
  private _onChangeDrill = new Event<void>()
  private plate: NeonPlate
  private headline: Text
  private glitchMagenta: Text
  private glitchCyan: Text
  private detail: Text
  private icons: Part[] = []
  private againButton: NeonButton
  private changeButton: NeonButton
  private scoreText = ""
  private clean = false
  private celebrating = false
  private hideWhenReady = false
  private ready = false
  private glitchClock = 0
  private glitchStep = 0
  private glitchActive = false
  private fitDirty = false
  private buttonsFitted = false
  private headlineScale = HEADLINE_CAP / 1.5946
  private detailScale = SUBLINE_CAP / 1.5946

  get onAgain(): PublicApi<void> {
    return this._onAgain.publicApi()
  }

  get onChangeDrill(): PublicApi<void> {
    return this._onChangeDrill.publicApi()
  }

  onAwake(): void {
    const root = this.sceneObject
    this.plate = new NeonPlate(root, "CardPlate", CARD_W, CARD_H, CYAN, {chamfer: 1.6, line: 0.18, fillAlpha: 0.1, brackets: true, order: 4})

    addNeonText(root, "RUN COMPLETE", "Medium", 1.2, withAlpha(CYAN, 0.9), {spacing: 0.16, position: new vec3(0, 7.7, 0.3), name: "RunCompleteLabel"})
    this.glitchMagenta = addNeonText(root, "", "Bold", HEADLINE_CAP, withAlpha(MAGENTA, 0.85), {spacing: 0.04, position: new vec3(0, HEADLINE_Y, 0.28), name: "HeadlineGlitchMagenta", order: 38})
    this.glitchCyan = addNeonText(root, "", "Bold", HEADLINE_CAP, withAlpha(CYAN, 0.85), {spacing: 0.04, position: new vec3(0, HEADLINE_Y, 0.29), name: "HeadlineGlitchCyan", order: 39})
    this.headline = addNeonText(root, "", "Bold", HEADLINE_CAP, CYAN, {spacing: 0.04, glow: true, position: new vec3(0, HEADLINE_Y, 0.3), name: "Headline"})
    this.glitchMagenta.enabled = false
    this.glitchCyan.enabled = false
    this.detail = addNeonText(root, "", "Medium", SUBLINE_CAP, new vec4(0.92, 1, 1, 0.95), {spacing: 0.04, position: new vec3(0, SUBLINE_Y, 0.3), name: "DetailLine"})

    // The subline keeps its 1.3 cm size and wraps onto a second line inside the inner width.
    const localW = INNER_W / this.detailScale
    this.detail.horizontalOverflow = HorizontalOverflow.Wrap
    this.detail.worldSpaceRect = Rect.create(-localW / 2, localW / 2, -20, 20)

    for (let i = 0; i < MAX_CONES; i++) {
      this.icons.push(addConeIcon(root, `ConeIcon_${i + 1}`, ICON_W, ICON_H, CYAN, new vec3(0, ICON_Y, 0.2)))
    }

    this.againButton = new NeonButton(root, "AgainButton", "AGAIN", BUTTON_W, BUTTON_H, new vec3(-BUTTON_X, BUTTON_Y, 0.1), {
      style: "primary",
      icon: "restart",
      weight: "SemiBold",
      capCm: 1.2,
      spacing: 0.05,
      iconRadius: 0.6,
    })
    this.changeButton = new NeonButton(root, "ChangeDrillButton", "CHANGE DRILL", BUTTON_W, BUTTON_H, new vec3(BUTTON_X, BUTTON_Y, 0.1), {
      style: "white",
      weight: "SemiBold",
      capCm: 1.2,
      spacing: 0.05,
    })
    this.againButton.onPress.add(() => this._onAgain.invoke())
    this.changeButton.onPress.add(() => this._onChangeDrill.invoke())

    // Hide only after UI Kit has started, because a disabled object never gets OnStart.
    const firstUpdate = this.createEvent("UpdateEvent")
    firstUpdate.bind(() => {
      firstUpdate.enabled = false
      this.ready = true
      if (this.hideWhenReady) {
        this.sceneObject.enabled = false
      }
    })
    this.createEvent("UpdateEvent").bind(() => {
      this.tickGlitch(getDeltaTime())
      this.fitPending()
    })
    this.fitPending()
  }

  /** states: one entry per cone in order, "cleared" or anything else for missed. */
  setResult(states: string[]): void {
    const total = states.length
    const cleared = states.filter((s) => s === "cleared").length
    this.clean = cleared === total
    this.scoreText = `${cleared}/${total}`
    const ratio = total > 0 ? cleared / total : 0
    const title = this.clean ? "CLEAN RUN" : ratio >= 0.7 ? "NICE RUN" : "KEEP PRACTICING"
    this.headline.text = title
    this.glitchMagenta.text = title
    this.glitchCyan.text = title

    const missCount = total - cleared
    const firstMiss = states.findIndex((s) => s !== "cleared") + 1
    this.detail.text = this.clean
      ? `${cleared}/${total} cones · eyes up all the way`
      : missCount === 1
        ? `${cleared}/${total} cones · cone ${firstMiss} is marked on the drill`
        : `${cleared}/${total} cones · misses glow amber on the drill`

    // Icon row: fixed size, squeezed to fit the inner width when there are many cones.
    const pitch = Math.min(ICON_MAX_PITCH, INNER_W / Math.max(1, total))
    const scale = Math.min(1, (pitch * 0.9) / ICON_W)
    this.icons.forEach((icon, i) => {
      icon.object.enabled = i < total
      if (i < total) {
        icon.object.getTransform().setLocalPosition(new vec3((i - (total - 1) / 2) * pitch, ICON_Y, 0.2))
        icon.object.getTransform().setLocalScale(new vec3(scale, scale, 1))
        icon.material.mainPass.baseColor = states[i] === "cleared" ? CYAN : AMBER
      }
    })
    this.fitDirty = true
    this.fitPending()
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

  /** Shrinks a text so it fits the inner width. Returns false while the text is not measurable yet. */
  private fitText(text: Text, baseScale: number, maxWidth: number): boolean {
    const transform = text.getSceneObject().getTransform()
    const width = text.getBoundingBox().getSize().x * baseScale
    if (!(width > 0.01) && text.text.length > 0) {
      return false
    }
    const k = width > maxWidth ? maxWidth / width : 1
    transform.setLocalScale(new vec3(baseScale * k, baseScale * k, baseScale * k))
    return true
  }

  private fitPending(): void {
    if (!this.fitDirty && this.buttonsFitted) {
      return
    }
    let done = true
    if (this.fitDirty) {
      done = this.fitText(this.headline, this.headlineScale, INNER_W) && done
      done = this.fitText(this.glitchMagenta, this.headlineScale, INNER_W) && done
      done = this.fitText(this.glitchCyan, this.headlineScale, INNER_W) && done
      if (done) {
        this.fitDirty = false
      }
    }
    if (!this.buttonsFitted) {
      const a = this.againButton.fitContent(BUTTON_W - 3, 0.9)
      const m = this.changeButton.fitContent(BUTTON_W - 3, 0.9)
      this.buttonsFitted = a && m
    }
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
        this.glitchMagenta.getSceneObject().getTransform().setLocalPosition(new vec3(-0.5 + jitter(), HEADLINE_Y + jitter() * 0.3, 0.28))
        this.glitchCyan.getSceneObject().getTransform().setLocalPosition(new vec3(0.5 + jitter(), HEADLINE_Y + jitter() * 0.3, 0.29))
        this.headline.getSceneObject().getTransform().setLocalPosition(new vec3(jitter() * 0.5, HEADLINE_Y, 0.3))
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
    this.headline.getSceneObject().getTransform().setLocalPosition(new vec3(0, HEADLINE_Y, 0.3))
    this.headline.textFill.color = CYAN
  }
}
