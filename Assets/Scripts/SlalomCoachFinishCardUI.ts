/**
 * SlalomCoachFinishCardUI - shows cones cleared next to "Again" and "Move drill".
 *
 * Owns: its UI Kit layout. Reports: onAgain and onMoveDrill.
 * Must not: keep score or decide when to show. SlalomCoachMain pushes the score in.
 */

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexDirection} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {addButton, addCentredText, flexChild, makeFlex, makeObject} from "./SlalomCoachPanelKitUI"

@component
export class SlalomCoachFinishCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachFinishCardUI - end of run result</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Caption under the score")
  scoreCaption: string = "cones cleared"

  @input
  @hint("Viewing distance the text is scaled for, in cm")
  @widget(new SliderWidget(40, 110, 5))
  viewingDistanceCm: number = 70

  @input
  @hint("Width of each button in cm")
  @widget(new SliderWidget(6, 16, 0.5))
  buttonWidthCm: number = 10.5

  @input
  @hint("Height of each button in cm")
  @widget(new SliderWidget(3, 10, 0.5))
  buttonHeightCm: number = 6
  @ui.group_end

  private _onAgain = new Event<void>()
  private _onMoveDrill = new Event<void>()
  private scoreText: Text
  private hideWhenReady = false
  private ready = false

  get onAgain(): PublicApi<void> {
    return this._onAgain.publicApi()
  }

  get onMoveDrill(): PublicApi<void> {
    return this._onMoveDrill.publicApi()
  }

  onAwake(): void {
    const scoreWidth = 11
    const gap = 1.2
    const padX = 1.5
    const width = scoreWidth + this.buttonWidthCm * 2 + gap * 2 + padX * 2
    const height = this.buttonHeightCm + 4

    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(width, height)

    const content = makeObject(this.sceneObject, "Content", new vec3(0, 0, 0.6))
    const row = makeFlex(content, FlexDirection.Row, width, height, {gap, padX})

    flexChild(row, "Score", scoreWidth, height - 1, (cell) => {
      const column = makeFlex(cell, FlexDirection.Column, scoreWidth, height - 1, {gap: 0.2})
      flexChild(column, "ScoreValue", scoreWidth, 3.6, (valueCell) => {
        this.scoreText = addCentredText(valueCell, "0/6", "Title1", scoreWidth, 3.6, this.viewingDistanceCm, new vec4(1, 1, 1, 1))
      })
      flexChild(column, "ScoreCaption", scoreWidth, 1.8, (captionCell) => {
        addCentredText(captionCell, this.scoreCaption, "Headline2", scoreWidth, 1.8, this.viewingDistanceCm, new vec4(1, 1, 1, 0.75))
      })
    })

    const againButton = addButton(row, "AgainButton", "Again", this.buttonWidthCm, this.buttonHeightCm, "HeadlineXL", this.viewingDistanceCm, false)
    const moveButton = addButton(row, "MoveDrillButton", "Move drill", this.buttonWidthCm, this.buttonHeightCm, "HeadlineXL", this.viewingDistanceCm, false)
    againButton.onTriggerUp.add(() => this._onAgain.invoke())
    moveButton.onTriggerUp.add(() => this._onMoveDrill.invoke())

    // Hide only after UI Kit has started, because a disabled object never gets OnStart.
    const firstUpdate = this.createEvent("UpdateEvent")
    firstUpdate.bind(() => {
      firstUpdate.enabled = false
      this.ready = true
      if (this.hideWhenReady) {
        this.sceneObject.enabled = false
      }
    })
  }

  setScore(cleared: number, total: number): void {
    this.scoreText.text = `${cleared}/${total}`
  }

  getScoreText(): string {
    return this.scoreText ? this.scoreText.text : ""
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
