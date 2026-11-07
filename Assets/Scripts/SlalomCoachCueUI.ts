/**
 * SlalomCoachCueUI - the single floating cue. One Text component, so never two on screen.
 *
 * Owns: the text, its world placement and the fade timing (view state only).
 * Must not: decide which cue to show. SlalomCoachMain calls showCue().
 * The cue is world-anchored: it stays where it was placed, and never follows the head.
 */

import {CYAN} from "./SlalomCoachNeon"

const cueFont = requireAsset("../Fonts/ChakraPetch-Bold.ttf") as Font

@component
export class SlalomCoachCueUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachCueUI - one short cue at a time</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Height of the capital letters in cm")
  @widget(new SliderWidget(4, 16, 0.5))
  letterHeightCm: number = 9

  @input
  @hint("How long the cue stays fully visible, in seconds")
  @widget(new SliderWidget(0.5, 5, 0.1))
  holdSec: number = 3

  @input
  @hint("Length of the quick fade in and replace, in seconds")
  @widget(new SliderWidget(0.05, 0.6, 0.05))
  fadeInSec: number = 0.12

  @input
  @hint("Length of the final fade out, in seconds")
  @widget(new SliderWidget(0.05, 1.5, 0.05))
  fadeOutSec: number = 0.35

  @ui.group_end

  private textObject: SceneObject
  private text: Text
  private alpha = 0
  private state: "none" | "swapping" | "fadeIn" | "hold" | "fadeOut" = "none"
  private stateTime = 0
  private logicalCue = ""
  private pendingPosition = vec3.zero()
  private pendingRotation = quat.quatIdentity()

  onAwake(): void {
    this.textObject = global.scene.createSceneObject("CueLabel")
    this.textObject.setParent(this.sceneObject)
    // Text size is an em square of size / 43.886 cm, and capitals fill about 0.7 of it.
    const size = 100
    const capHeightAtScaleOne = (size / 43.886) * 0.7
    const scale = this.letterHeightCm / capHeightAtScaleOne
    this.textObject.getTransform().setLocalScale(new vec3(scale, scale, scale))

    this.text = this.textObject.createComponent("Component.Text") as Text
    this.text.size = size
    this.text.font = cueFont
    this.text.depthTest = true
    this.text.horizontalAlignment = HorizontalAlignment.Center
    this.text.verticalAlignment = VerticalAlignment.Center
    this.text.horizontalOverflow = HorizontalOverflow.Overflow
    this.text.verticalOverflow = VerticalOverflow.Overflow
    this.text.layoutRect = Rect.create(-20, 20, -3, 3)
    this.setAlpha(0)
    this.textObject.enabled = false

    this.createEvent("UpdateEvent").bind(() => this.tick(getDeltaTime()))
  }

  /** Replaces any current cue with a quick fade. worldRotation should face the skater. */
  showCue(cue: string, worldPosition: vec3, worldRotation: quat): void {
    this.logicalCue = cue
    this.pendingPosition = worldPosition
    this.pendingRotation = worldRotation
    if (this.state === "none") {
      this.beginFadeIn()
    } else {
      this.state = "swapping"
      this.stateTime = 0
    }
  }

  clear(): void {
    this.logicalCue = ""
    this.state = "none"
    this.setAlpha(0)
    this.textObject.enabled = false
  }

  /** The cue that should be on screen now, or an empty string. */
  getCueText(): string {
    return this.logicalCue
  }

  /** The string on the single Text component, which trails getCueText() during a swap. */
  getDisplayedText(): string {
    return this.textObject.enabled ? this.text.text : ""
  }

  getCueCount(): number {
    return this.logicalCue.length > 0 ? 1 : 0
  }

  getAlpha(): number {
    return this.alpha
  }

  getWorldPosition(): vec3 {
    return this.sceneObject.getTransform().getWorldPosition()
  }

  private tick(dt: number): void {
    this.stateTime += dt
    switch (this.state) {
      case "swapping": {
        this.setAlpha(Math.max(0, this.alpha - dt / Math.max(0.01, this.fadeInSec)))
        if (this.alpha <= 0) {
          this.beginFadeIn()
        }
        break
      }
      case "fadeIn": {
        this.setAlpha(Math.min(1, this.alpha + dt / Math.max(0.01, this.fadeInSec)))
        if (this.alpha >= 1) {
          this.state = "hold"
          this.stateTime = 0
        }
        break
      }
      case "hold": {
        if (this.stateTime >= this.holdSec) {
          this.state = "fadeOut"
          this.stateTime = 0
          // The cue's time is up. It stops counting as active once the fade has started.
          this.logicalCue = ""
        }
        break
      }
      case "fadeOut": {
        this.setAlpha(Math.max(0, this.alpha - dt / Math.max(0.01, this.fadeOutSec)))
        if (this.alpha <= 0) {
          this.state = "none"
          this.textObject.enabled = false
        }
        break
      }
    }
  }

  private beginFadeIn(): void {
    const transform = this.sceneObject.getTransform()
    transform.setWorldPosition(this.pendingPosition)
    transform.setWorldRotation(this.pendingRotation)
    this.text.text = this.logicalCue
    this.textObject.enabled = true
    this.state = "fadeIn"
    this.stateTime = 0
  }

  private setAlpha(alpha: number): void {
    this.alpha = alpha
    this.text.textFill.color = new vec4(CYAN.x, CYAN.y, CYAN.z, alpha)
  }
}
