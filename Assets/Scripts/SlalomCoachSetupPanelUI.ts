/**
 * SlalomCoachSetupPanelUI - the setup panel: title, hint, spacing value, spacing slider, "Place drill".
 *
 * Owns: the UI Kit Frame (the movable container with lazy follow and a grab margin), the light
 * backing, and the slider and button views. Reports: onSpacingChanged(m) and onPlaceDrill.
 * Must not: decide anything about the drill. SlalomCoachMain owns the spacing state.
 *
 * Follow: UI Kit Frame tag-along. The panel stays put until the view turns more than
 * deadZoneDeg, then slides back in front once the wearer settles. Dragging the Frame margin
 * (the bar around the panel) moves it by hand.
 */

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {FlexDirection} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {styleSliderLight} from "./SlalomCoachLightStyle"
import {addButton, addCentredText, flexChild, makeFlex, makeObject} from "./SlalomCoachPanelKitUI"

const SPACING_MIN_M = 0.8
const SPACING_MAX_M = 1.5
const SPACING_STEP_M = 0.1
const SPACING_STEPS = Math.round((SPACING_MAX_M - SPACING_MIN_M) / SPACING_STEP_M) + 1

/** Minimum clear space between the slider and the Place drill button, in cm. */
const MIN_SLIDER_BUTTON_GAP_CM = 3

function spacingToSliderValue(m: number): number {
  return (Math.round((m - SPACING_MIN_M) / SPACING_STEP_M)) / (SPACING_STEPS - 1)
}

function sliderValueToSpacing(v: number): number {
  return Math.round((SPACING_MIN_M + Math.round(v * (SPACING_STEPS - 1)) * SPACING_STEP_M) * 10) / 10
}

@component
export class SlalomCoachSetupPanelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachSetupPanelUI - spacing slider and Place drill</span>')
  @ui.separator

  @ui.group_start("Text")
  @input
  @hint("Title at the top of the panel")
  titleText: string = "Slalom Coach AR"

  @input
  @hint("One-line hint under the title")
  hintText: string = "Set spacing, then place the drill"

  @input
  @hint("Label in front of the spacing value")
  valuePrefix: string = "Cone spacing: "

  @input
  @hint("Text on the big button")
  placeLabel: string = "Place drill"
  @ui.group_end

  @ui.group_start("Layout")
  @input
  @hint("Overall panel width in cm, including the grab margin")
  @widget(new SliderWidget(24, 40, 1))
  panelWidthCm: number = 30

  @input
  @hint("Width of the grab margin around the panel, in cm")
  @widget(new SliderWidget(1, 4, 0.5))
  grabMarginCm: number = 2

  @input
  @hint("Clear space between the slider and the Place drill button, in cm. Never below 3")
  @widget(new SliderWidget(3, 8, 0.5))
  sliderToButtonGapCm: number = 4

  @input
  @hint("Viewing distance the text is scaled for, in cm")
  @widget(new SliderWidget(40, 110, 5))
  viewingDistanceCm: number = 60
  @ui.group_end

  @ui.group_start("Follow")
  @input
  @hint("Distance from the eyes to the panel, in cm")
  @widget(new SliderWidget(40, 110, 5))
  distanceCm: number = 60

  @input
  @hint("How far below eye level the panel floats, in cm")
  @widget(new SliderWidget(0, 40, 1))
  dropCm: number = 25

  @input
  @hint("How far to the left of the view centre the panel floats, in cm")
  @widget(new SliderWidget(0, 20, 1))
  leftCm: number = 6

  @input
  @hint("Turn the view by more than this many degrees and the panel follows")
  @widget(new SliderWidget(10, 60, 1))
  deadZoneDeg: number = 30
  @ui.group_end

  @ui.group_start("Colours")
  @input("vec4", "{0.62,0.80,0.90,0.62}")
  @hint("Light, semi-opaque panel background. Keep it light: dark colours turn transparent on the display")
  @widget(new ColorWidget())
  backingColor: vec4

  @input("vec4", "{0.12,0.60,0.72,1}")
  @hint("Colour of the grab bar under the panel")
  @widget(new ColorWidget())
  grabBarColor: vec4
  @ui.group_end

  private _onSpacingChanged = new Event<number>()
  private _onPlaceDrill = new Event<void>()
  private frame: Frame
  private slider: Slider
  private placeButton: Button
  private valueText: Text
  private spacingM = 1.0
  private suppressSliderEvent = false
  private tagAlong: any = null
  private following = false

  get onSpacingChanged(): PublicApi<number> {
    return this._onSpacingChanged.publicApi()
  }

  get onPlaceDrill(): PublicApi<void> {
    return this._onPlaceDrill.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.frame = this.sceneObject.createComponent(Frame.getTypeName()) as Frame
    this.frame.autoScaleContent = false
    this.frame.autoShowHide = false
    this.frame.useTagAlong = true
    this.frame.tagAlongDistance = this.distanceCm
    this.frame.onInitialized.add(() => this.build())
  }

  /** Sets the spacing in metres. Snaps to 0.1 m steps between 0.8 and 1.5. */
  setSpacing(m: number): void {
    this.spacingM = Math.min(SPACING_MAX_M, Math.max(SPACING_MIN_M, sliderValueToSpacing(spacingToSliderValue(m))))
    this.refreshValueText()
    if (this.slider && this.slider.initialized) {
      this.suppressSliderEvent = true
      this.slider.currentValue = spacingToSliderValue(this.spacingM)
      this.suppressSliderEvent = false
    }
  }

  getSpacing(): number {
    return this.spacingM
  }

  getValueText(): string {
    return this.valueText ? this.valueText.text : ""
  }

  /** Shows or hides the whole panel. Showing slides it back in front of the wearer. */
  setVisible(visible: boolean): void {
    this.sceneObject.enabled = visible
    if (visible && this.tagAlong) {
      this.tagAlong.recenter()
    }
  }

  isVisible(): boolean {
    return this.sceneObject.enabled
  }

  /** True while the Frame is moving back in front of the wearer, or being dragged. */
  isFollowing(): boolean {
    return this.tagAlong ? !!this.tagAlong.isMoving : false
  }

  hasFollowBehavior(): boolean {
    return !!this.tagAlong
  }

  /** Fires place-drill as if the button was pinched. */
  pressPlace(): void {
    this._onPlaceDrill.invoke()
  }

  private build(): void {
    this.frame.allowScaling = false
    this.frame.margin = this.grabMarginCm
    const innerWidth = this.panelWidthCm - this.grabMarginCm * 2
    const contentWidth = innerWidth - 3
    const gap = Math.max(MIN_SLIDER_BUTTON_GAP_CM, this.sliderToButtonGapCm)
    const rowGap = 0.8
    const heights = {title: 3.0, hint: 2.0, value: 3.6, slider: 2.4, place: 5}
    const innerHeight = 1.2 * 2 + heights.title + heights.hint + heights.value + heights.slider + gap + heights.place + rowGap * 5
    this.frame.innerSize = new vec2(innerWidth, innerHeight)
    this.frame.onlyInteractOnMargin = true

    const root = this.frame.contentTransform.getSceneObject()

    // Light, semi-opaque backing sitting just in front of the Frame's own body.
    const backingObject = makeObject(root, "Backing", new vec3(0, 0, 0.2))
    const backing = backingObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    backing.initialize()
    backing.gradient = false
    backing.backgroundColor = this.backingColor
    backing.cornerRadius = 1.4
    backing.size = new vec2(this.panelWidthCm, innerHeight + this.grabMarginCm * 2)

    // Visible grab bar in the bottom margin. Dragging anywhere on the margin moves the panel.
    const barObject = makeObject(root, "GrabBar", new vec3(0, -(innerHeight / 2 + this.grabMarginCm / 2), 0.4))
    const bar = barObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    bar.initialize()
    bar.gradient = false
    bar.backgroundColor = this.grabBarColor
    bar.cornerRadius = 0.4
    bar.size = new vec2(this.panelWidthCm * 0.35, Math.min(0.9, this.grabMarginCm * 0.5))

    const content = makeObject(root, "Content", new vec3(0, 0, 0.6))
    const column = makeFlex(content, FlexDirection.Column, innerWidth, innerHeight, {gap: rowGap, padX: 1.5, padY: 1.2})
    const d = this.viewingDistanceCm
    const white = new vec4(1, 1, 1, 1)

    flexChild(column, "Title", contentWidth, heights.title, (cell) => {
      addCentredText(cell, this.titleText, "Title2", contentWidth, heights.title, d, white)
    })
    flexChild(column, "Hint", contentWidth, heights.hint, (cell) => {
      addCentredText(cell, this.hintText, "Headline1", contentWidth, heights.hint, d, new vec4(1, 1, 1, 0.9))
    })
    flexChild(column, "SpacingValue", contentWidth, heights.value, (cell) => {
      this.valueText = addCentredText(cell, "", "Title1", contentWidth, heights.value, d, white)
      this.refreshValueText()
    })
    flexChild(column, "SpacingSliderCell", contentWidth, heights.slider, (cell) => {
      this.slider = cell.createComponent(Slider.getTypeName()) as Slider
      this.slider.size = new vec3(contentWidth - 2, heights.slider, 1)
      this.slider.numberOfSegments = SPACING_STEPS
      this.slider.segmented = true
      this.slider.currentValue = spacingToSliderValue(this.spacingM)
      styleSliderLight(this.slider)
      this.slider.onValueChange.add((value) => this.onSliderValue(value))
    })
    // Clear space so the slider can be used without hitting the button.
    flexChild(column, "SliderButtonGap", contentWidth, gap - rowGap * 2, () => {})
    this.placeButton = addButton(column, "PlaceDrillButton", this.placeLabel, contentWidth, heights.place, "Title2", d, false)
    this.placeButton.onTriggerUp.add(() => this._onPlaceDrill.invoke())

    this.setUpFollow()
  }

  private onSliderValue(value: number): void {
    if (this.suppressSliderEvent) {
      return
    }
    const m = sliderValueToSpacing(value)
    if (m === this.spacingM) {
      return
    }
    this.spacingM = m
    this.refreshValueText()
    this._onSpacingChanged.invoke(m)
  }

  private refreshValueText(): void {
    if (this.valueText) {
      this.valueText.text = `${this.valuePrefix}${this.spacingM.toFixed(1)} m`
    }
  }

  /**
   * Frame builds its tag-along privately and fixes the drop (-5 cm) and dead zone (35 deg).
   * This reads those two values off the live behaviour and sets the brief's numbers, and nudges
   * the panel left after every recentre. If a future UI Kit changes the internals, the panel
   * still works, it just follows with the package defaults.
   */
  private setUpFollow(): void {
    const behaviour = (this.frame as any)._tagAlong
    if (!behaviour) {
      print("SlalomCoachSetupPanelUI: Frame tag-along not found, using package defaults")
      return
    }
    this.tagAlong = behaviour
    behaviour.verticalOffset = -this.dropCm
    behaviour.deadZoneAngle = this.deadZoneDeg
    behaviour.onRecenter.add(() => this.nudgeLeft())
  }

  private nudgeLeft(): void {
    const transform = this.sceneObject.getTransform()
    const cameraTransform = (this.frame as any)._tagAlong ? (this.frame as any)._tagAlong.cameraTransform : null
    if (!cameraTransform) {
      return
    }
    const right = cameraTransform.right
    const flatRight = new vec3(right.x, 0, right.z)
    if (flatRight.length < 0.001) {
      return
    }
    const shift = flatRight.normalize().uniformScale(-this.leftCm)
    transform.setWorldPosition(transform.getWorldPosition().add(shift))
  }
}
