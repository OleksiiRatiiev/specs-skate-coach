/**
 * SlalomCoachPanelKitUI - shared UI Kit building blocks for the Slalom Coach panels.
 *
 * Owns: the type scale and the flex, text and button helpers each panel composes.
 * Must not: hold state. Panels own their own view state.
 */

import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {styleButtonLight} from "./SlalomCoachLightStyle"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

const FONT_SIZE_SCALE = 1.0

export type TextRole =
  | "Title1"
  | "Title2"
  | "HeadlineXL"
  | "Headline1"
  | "Headline2"
  | "Subheadline"
  | "Button"
  | "Callout"
  | "Body"
  | "Caption"

const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
}

export function applyTextRole(text: Text, role: TextRole, distanceCm: number = 110): void {
  text.size = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  ;(text as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const LAYOUT_Z_LIFT = 0.02

export function makeObject(parent: SceneObject, name: string, position?: vec3): SceneObject {
  const object = global.scene.createSceneObject(name)
  object.setParent(parent)
  if (position) {
    object.getTransform().setLocalPosition(position)
  }
  return object
}

export interface FlexOptions {
  gap?: number
  padX?: number
  padY?: number
  justify?: FlexJustify
  align?: FlexAlign
}

export function makeFlex(parent: SceneObject, direction: FlexDirection, width: number, height: number, options?: FlexOptions): SceneObject {
  const container = makeObject(parent, "Flex", new vec3(0, 0, LAYOUT_Z_LIFT))
  const flexLayout = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
  // Children are registered explicitly by flexChild(), before the layout has started.
  flexLayout.autoDiscoverItemsOnStart = false
  const flexItem = container.createComponent(FlexItem.getTypeName()) as FlexItem
  flexItem.overrideWidth = width
  flexItem.overrideHeight = height
  flexLayout.onInitialized.add(() => {
    flexLayout.width = width
    flexLayout.height = height
    flexLayout.direction = direction
    if (direction === FlexDirection.Row) {
      flexLayout.columnGap = options?.gap ?? 0
    } else {
      flexLayout.rowGap = options?.gap ?? 0
    }
    flexLayout.paddingTop = options?.padY ?? 0
    flexLayout.paddingBottom = options?.padY ?? 0
    flexLayout.paddingLeft = options?.padX ?? 0
    flexLayout.paddingRight = options?.padX ?? 0
    flexLayout.justifyContent = options?.justify ?? FlexJustify.Center
    flexLayout.alignItems = options?.align ?? FlexAlign.Center
  })
  return container
}

export function flexChild(parent: SceneObject, name: string, width: number, height: number, builder: (child: SceneObject) => void): SceneObject {
  const child = makeObject(parent, name, new vec3(0, 0, LAYOUT_Z_LIFT))
  const flexItem = child.createComponent(FlexItem.getTypeName()) as FlexItem
  flexItem.overrideWidth = width
  flexItem.overrideHeight = height
  flexItem.flexGrow = 0
  flexItem.flexShrink = 0
  builder(child)
  const parentLayout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
  if (parentLayout) {
    parentLayout.addItems([flexItem])
  }
  return child
}

export function addCentredText(parent: SceneObject, value: string, role: TextRole, widthCm: number, heightCm: number, distanceCm: number, color: vec4): Text {
  const text = parent.createComponent("Component.Text") as Text
  text.text = value
  text.depthTest = true
  applyTextRole(text, role, distanceCm)
  text.horizontalAlignment = HorizontalAlignment.Center
  text.verticalAlignment = VerticalAlignment.Center
  text.horizontalOverflow = HorizontalOverflow.Overflow
  text.verticalOverflow = VerticalOverflow.Overflow
  text.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  text.textFill.color = color
  return text
}

/** UI Kit Button filling its flex cell. The label is an ElementContent, so it also changes colour with hover and press. */
export function addButton(parent: SceneObject, name: string, label: string, width: number, height: number, role: TextRole, distanceCm: number, toggleable: boolean): Button {
  let button: Button
  flexChild(parent, name, width, height, (cell) => {
    button = cell.createComponent(Button.getTypeName()) as Button
    button.size = new vec3(width, height, 1)
    if (toggleable) {
      button.setIsToggleable(true)
    }
    styleButtonLight(button)
    const content = cell.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = label
    content.textSize = TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
  })
  return button
}
