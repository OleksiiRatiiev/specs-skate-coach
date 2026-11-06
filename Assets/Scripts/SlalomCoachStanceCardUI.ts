/**
 * SlalomCoachStanceCardUI - figure plus three stance reminders, floating past the start pad.
 *
 * Owns: its layout. Light colours, no backing, as the display is additive.
 * Must not: decide when to show. SlalomCoachMain shows it while the skater is on the pad.
 */

import {FlexDirection} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {addCentredText, flexChild, makeFlex, makeObject} from "./SlalomCoachPanelKitUI"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material
const FIGURE_ICON = requireAsset("../Icons/skateboarding.png") as Texture

@component
export class SlalomCoachStanceCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachStanceCardUI - stance reminder on the pad</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("First reminder")
  lineOne: string = "Knees bent"

  @input
  @hint("Second reminder")
  lineTwo: string = "Arms forward"

  @input
  @hint("Third reminder")
  lineThree: string = "Eyes 2–3 cones ahead"

  @input
  @hint("Card height in cm")
  @widget(new SliderWidget(25, 70, 1))
  cardHeightCm: number = 40

  @input
  @hint("Viewing distance the text is scaled for, in cm. Larger makes the text bigger")
  @widget(new SliderWidget(60, 220, 5))
  textDistanceCm: number = 130

  @input("vec3", "{0.85,0.97,1}")
  @hint("Colour of the figure and text. Keep it light for the additive display")
  @widget(new ColorWidget())
  cardColor: vec3
  @ui.group_end

  private hideWhenReady = false
  private ready = false

  onAwake(): void {
    const width = 42
    const height = this.cardHeightCm
    const rowHeight = height * 0.14
    const figureSize = height - rowHeight * 3 - 2
    const color = new vec4(this.cardColor.x, this.cardColor.y, this.cardColor.z, 1)

    this.sceneObject.createComponent("Component.Canvas")
    const column = makeFlex(this.sceneObject, FlexDirection.Column, width, height, {gap: 0.5})

    flexChild(column, "Figure", figureSize, figureSize, (cell) => {
      const figure = makeObject(cell, "FigureImage")
      const image = figure.createComponent("Component.Image") as Image
      const material = imageMaterial.clone()
      material.mainPass.baseTex = FIGURE_ICON
      material.mainPass.baseColor = color
      material.mainPass.depthTest = true
      material.mainPass.depthWrite = false
      image.clearMaterials()
      image.addMaterial(material)
      figure.getTransform().setLocalScale(new vec3(figureSize, figureSize, 1))
    })

    const lines = [this.lineOne, this.lineTwo, this.lineThree]
    lines.forEach((line, index) => {
      flexChild(column, `StanceLine_${index + 1}`, width, rowHeight, (cell) => {
        addCentredText(cell, line, "Title1", width, rowHeight, this.textDistanceCm, color)
      })
    })

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
