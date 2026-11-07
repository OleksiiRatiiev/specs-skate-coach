/**
 * SlalomCoachNeon - the neon HUD kit: colours, fonts, chamfered outline plates, corner brackets,
 * small icons and the UI Kit button wrapper that draws them.
 *
 * Owns: how every HUD element looks (cyan thin outline, soft glow, chamfer, light fills only).
 * Must not: decide any behaviour. Panels place these and listen to the button events.
 * Units are cm. Shapes face +Z in their own local space.
 */

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {StateName} from "SpectaclesUIKit.lspkg/Scripts/Components/Element"
import {hideButtonVisual} from "./SlalomCoachLightStyle"
import {
  buildChamferFillMesh,
  buildChamferFrameMesh,
  buildConeIconMesh,
  buildCornerBracketsMesh,
  buildQuadXYMesh,
  buildRestartIconMesh,
} from "./SlalomCoachMeshes"

export const CYAN = new vec4(0.247, 0.941, 1, 1) // #3FF0FF
export const AMBER = new vec4(1, 0.69, 0.125, 1) // #FFB020
export const MAGENTA = new vec4(1, 0.239, 0.941, 1) // #FF3DF0
export const WHITE = new vec4(1, 1, 1, 1)

const unlitMaterial = requireAsset("../Materials/SlalomUnlit.mat") as Material
const fontBold = requireAsset("../Fonts/ChakraPetch-Bold.ttf") as Font
const fontSemiBold = requireAsset("../Fonts/ChakraPetch-SemiBold.ttf") as Font
const fontMedium = requireAsset("../Fonts/ChakraPetch-Medium.ttf") as Font

export type Weight = "Bold" | "SemiBold" | "Medium"

export function withAlpha(c: vec4, a: number): vec4 {
  return new vec4(c.x, c.y, c.z, a)
}

export interface Part {
  object: SceneObject
  material: Material
}

/** A flat HUD mesh with its own unlit, blended, depth-free material. */
export function addHudMesh(parent: SceneObject, name: string, mesh: RenderMesh, color: vec4, z: number, order: number): Part {
  const object = global.scene.createSceneObject(name)
  object.setParent(parent)
  object.getTransform().setLocalPosition(new vec3(0, 0, z))
  const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  visual.mesh = mesh
  const material = unlitMaterial.clone()
  material.mainPass.baseColor = color
  material.mainPass.twoSided = true
  material.mainPass.blendMode = BlendMode.Normal
  material.mainPass.depthWrite = false
  material.mainPass.depthTest = false
  visual.mainMaterial = material
  visual.renderOrder = order
  return {object, material}
}

/**
 * Uppercase-style text with a Chakra Petch weight. capCm is the height of capital letters.
 * Text is em-square size/43.886 cm at scale 1, and capitals fill about 0.7 of it.
 */
export function addNeonText(
  parent: SceneObject,
  value: string,
  weight: Weight,
  capCm: number,
  color: vec4,
  options?: {spacing?: number; glow?: boolean; position?: vec3; order?: number; align?: HorizontalAlignment; name?: string}
): Text {
  const object = global.scene.createSceneObject(options?.name ?? "Text")
  object.setParent(parent)
  object.getTransform().setLocalPosition(options?.position ?? new vec3(0, 0, 0.15))
  const size = 100
  const scale = capCm / ((size / 43.886) * 0.7)
  object.getTransform().setLocalScale(new vec3(scale, scale, scale))
  const text = object.createComponent("Component.Text") as Text
  text.text = value
  text.size = size
  text.font = weight === "Bold" ? fontBold : weight === "SemiBold" ? fontSemiBold : fontMedium
  text.depthTest = false
  text.renderOrder = options?.order ?? 30
  text.horizontalAlignment = options?.align ?? HorizontalAlignment.Center
  text.verticalAlignment = VerticalAlignment.Center
  text.horizontalOverflow = HorizontalOverflow.Overflow
  text.verticalOverflow = VerticalOverflow.Overflow
  text.letterSpacing = options?.spacing ?? 0
  text.textFill.color = color
  if (options?.glow) {
    text.outlineSettings.enabled = true
    text.outlineSettings.size = 0.25
    text.outlineSettings.fill.color = withAlpha(color, 0.3)
  }
  return text
}

/** Chamfered neon plate: light fill, thin outline, two soft glow layers and optional HUD corner brackets. */
export class NeonPlate {
  readonly root: SceneObject
  private fill: Part
  private glowInner: Part
  private glowOuter: Part
  private frame: Part
  private brackets: Part | null = null
  private color: vec4
  private fillAlpha: number
  private glowLevel = 1

  constructor(
    parent: SceneObject,
    name: string,
    w: number,
    h: number,
    color: vec4,
    options?: {chamfer?: number; line?: number; fillAlpha?: number; brackets?: boolean; order?: number}
  ) {
    const chamfer = options?.chamfer ?? Math.min(1.6, Math.min(w, h) * 0.22)
    const line = options?.line ?? 0.2
    const order = options?.order ?? 10
    this.color = color
    this.fillAlpha = options?.fillAlpha ?? 0.1
    this.root = global.scene.createSceneObject(name)
    this.root.setParent(parent)
    this.fill = addHudMesh(this.root, "Fill", buildChamferFillMesh(w, h, chamfer), withAlpha(color, this.fillAlpha), 0, order)
    this.glowOuter = addHudMesh(this.root, "GlowOuter", buildChamferFrameMesh(w + 2.4, h + 2.4, chamfer + 1.0, 1.4 + line), withAlpha(color, 0.07), 0.01, order + 1)
    this.glowInner = addHudMesh(this.root, "GlowInner", buildChamferFrameMesh(w + 0.9, h + 0.9, chamfer + 0.4, 0.55 + line), withAlpha(color, 0.16), 0.02, order + 2)
    this.frame = addHudMesh(this.root, "Frame", buildChamferFrameMesh(w, h, chamfer, line), color, 0.03, order + 3)
    if (options?.brackets) {
      const len = Math.min(w, h) * 0.28
      this.brackets = addHudMesh(this.root, "Brackets", buildCornerBracketsMesh(w + 0.9, h + 0.9, chamfer + 0.4, len, line * 2.6), color, 0.04, order + 4)
    }
  }

  setColor(color: vec4): void {
    this.color = color
    this.apply()
  }

  setFillAlpha(alpha: number): void {
    this.fillAlpha = alpha
    this.apply()
  }

  /** 0..1.5: scales the glow layers. */
  setGlow(level: number): void {
    this.glowLevel = level
    this.apply()
  }

  getColor(): vec4 {
    return this.color
  }

  private apply(): void {
    const c = this.color
    this.fill.material.mainPass.baseColor = withAlpha(c, this.fillAlpha)
    this.glowOuter.material.mainPass.baseColor = withAlpha(c, 0.07 * this.glowLevel)
    this.glowInner.material.mainPass.baseColor = withAlpha(c, 0.16 * this.glowLevel)
    this.frame.material.mainPass.baseColor = c
    if (this.brackets) {
      this.brackets.material.mainPass.baseColor = c
    }
  }
}

export type ButtonIcon = "none" | "minus" | "plus" | "restart"
export type ButtonStyle = "cyan" | "primary" | "white"

/**
 * UI Kit Button (far-field pinch and mouse click) with an invisible stock visual and a neon plate on top.
 * Looks: idle thin outline, hover brighter with a stronger glow and fill, pressed filled and white-hot.
 */
export class NeonButton {
  readonly object: SceneObject
  readonly button: Button
  private plate: NeonPlate
  private label: Text | null = null
  private iconParts: Part[] = []
  private style: ButtonStyle
  private state: StateName = StateName.default
  private pulse = 0
  private _onPress = new Event<void>()

  get onPress(): PublicApi<void> {
    return this._onPress.publicApi()
  }

  constructor(
    parent: SceneObject,
    name: string,
    labelText: string,
    w: number,
    h: number,
    position: vec3,
    options: {style?: ButtonStyle; icon?: ButtonIcon; weight?: Weight; capCm?: number; spacing?: number}
  ) {
    this.style = options.style ?? "cyan"
    this.object = global.scene.createSceneObject(name)
    this.object.setParent(parent)
    this.object.getTransform().setLocalPosition(position)

    this.button = this.object.createComponent(Button.getTypeName()) as Button
    this.button.size = new vec3(w, h, 1)
    hideButtonVisual(this.button)
    this.button.onTriggerUp.add(() => this._onPress.invoke())
    this.button.onStateChanged.add((s) => {
      this.state = s
      this.refresh()
    })

    const base = this.style === "white" ? WHITE : CYAN
    this.plate = new NeonPlate(this.object, "Plate", w, h, base, {fillAlpha: this.idleFill(), line: 0.22, chamfer: Math.min(1.4, h * 0.25), order: 12})
    const icon = options.icon ?? "none"
    const capCm = options.capCm ?? 1.9
    if (icon === "none" || icon === "restart") {
      const hasIcon = icon === "restart"
      const labelX = hasIcon ? 1.8 : 0
      this.label = addNeonText(this.object, labelText, options.weight ?? "SemiBold", capCm, this.labelColor(), {
        spacing: options.spacing ?? 0.12,
        position: new vec3(labelX, 0, 0.2),
        order: 40,
        name: "Label",
      })
      if (hasIcon) {
        this.iconParts.push(addHudMesh(this.object, "RestartIcon", buildRestartIconMesh(1.35, 0.4), this.labelColor(), 0.2, 40))
        this.iconParts[0].object.getTransform().setLocalPosition(new vec3(-(this.estimateLabelWidth(labelText, capCm) / 2) + labelX - 1.2, 0, 0.2))
      }
    } else {
      const bar = h * 0.5
      const thick = h * 0.1
      this.iconParts.push(addHudMesh(this.object, "Bar", buildQuadXYMesh(bar, thick), this.labelColor(), 0.2, 40))
      if (icon === "plus") {
        this.iconParts.push(addHudMesh(this.object, "BarV", buildQuadXYMesh(thick, bar), this.labelColor(), 0.2, 40))
      }
    }
    this.refresh()
  }

  setVisible(visible: boolean): void {
    this.object.enabled = visible
  }

  /** Slow glow pulse, level 0..1. */
  setPulse(level: number): void {
    this.pulse = level
    this.refresh()
  }

  getLabelText(): string {
    return this.label ? this.label.text : ""
  }

  /** Programmatic press, as if pinched. */
  press(): void {
    this._onPress.invoke()
  }

  private estimateLabelWidth(text: string, capCm: number): number {
    return text.length * capCm * 0.62
  }

  private idleFill(): number {
    return this.style === "primary" ? 0.32 : this.style === "white" ? 0.04 : 0.1
  }

  private labelColor(): vec4 {
    if (this.state === StateName.triggered) {
      return WHITE
    }
    if (this.style === "white") {
      return WHITE
    }
    if (this.style === "primary") {
      return this.state === StateName.hovered ? WHITE : new vec4(0.88, 1, 1, 1)
    }
    return this.state === StateName.hovered ? WHITE : CYAN
  }

  private refresh(): void {
    const hovered = this.state === StateName.hovered
    const pressed = this.state === StateName.triggered
    const base = this.style === "white" ? WHITE : CYAN
    const fill = pressed ? 0.7 : hovered ? this.idleFill() + 0.2 : this.idleFill()
    this.plate.setColor(pressed ? WHITE : hovered && this.style !== "white" ? new vec4(0.6, 0.97, 1, 1) : base)
    this.plate.setFillAlpha(fill)
    this.plate.setGlow(pressed ? 1.6 : hovered ? 1.35 : 0.75 + 0.5 * this.pulse)
    const color = this.labelColor()
    if (this.label) {
      this.label.textFill.color = color
    }
    for (const part of this.iconParts) {
      part.material.mainPass.baseColor = color
    }
  }
}

/** Little cone icon for the finish card, tinted per cone result. */
export function addConeIcon(parent: SceneObject, name: string, w: number, h: number, color: vec4, position: vec3): Part {
  const part = addHudMesh(parent, name, buildConeIconMesh(w, h), color, 0.2, 30)
  part.object.getTransform().setLocalPosition(position)
  return part
}
