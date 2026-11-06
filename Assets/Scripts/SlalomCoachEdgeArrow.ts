/**
 * SlalomCoachEdgeArrow - the small arrow at the lower edge of the view.
 *
 * Lives under the Camera Object: the one element attached to the view, and only while needed.
 * Owns: its mesh, material and on-screen placement.
 * Must not: decide when to show or where to point. SlalomCoachMain does that.
 */

import {buildArrowMesh} from "./SlalomCoachMeshes"

const unlitMaterial = requireAsset("../Materials/SlalomUnlit.mat") as Material
const ARROW_RENDER_ORDER = 1000

@component
export class SlalomCoachEdgeArrow extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachEdgeArrow - points at what is out of view</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Distance in front of the eyes in cm")
  @widget(new SliderWidget(60, 200, 5))
  distanceCm: number = 100

  @input
  @hint("Arrow length in cm at that distance")
  @widget(new SliderWidget(2, 10, 0.5))
  sizeCm: number = 4.5

  @input
  @hint("How far towards the lower edge of the view to sit. 1 is exactly on the edge")
  @widget(new SliderWidget(0.3, 1, 0.05))
  edgeFraction: number = 0.78

  @input("vec3", "{0.75,1,1}")
  @hint("Arrow colour. Keep it light, because dark colours vanish on the additive display")
  @widget(new ColorWidget())
  color: vec3
  @ui.group_end

  private visual: SceneObject
  private visible = false
  private pointingAngleDeg = 0

  onAwake(): void {
    this.visual = global.scene.createSceneObject("ArrowVisual")
    this.visual.setParent(this.sceneObject)
    const meshVisual = this.visual.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    meshVisual.mesh = buildArrowMesh(this.sizeCm, this.sizeCm)
    const material = unlitMaterial.clone()
    material.mainPass.baseColor = new vec4(this.color.x, this.color.y, this.color.z, 1)
    material.mainPass.twoSided = true
    material.mainPass.depthTest = false
    material.mainPass.depthWrite = false
    material.mainPass.blendMode = BlendMode.Normal
    meshVisual.mainMaterial = material
    // Under the camera, so it draws first by hierarchy. It must draw over the drill instead.
    meshVisual.renderOrder = ARROW_RENDER_ORDER
    this.visual.enabled = false
  }

  /** Fits the arrow to the camera's view. Call once the camera's field of view is known. */
  placeForView(verticalFovRadians: number): void {
    const halfHeight = Math.tan(verticalFovRadians / 2) * this.distanceCm
    this.sceneObject.getTransform().setLocalPosition(new vec3(0, -halfHeight * this.edgeFraction, -this.distanceCm))
  }

  /** dirX and dirY are the direction to the target on the view plane (right, up). */
  showPointing(dirX: number, dirY: number): void {
    const angle = Math.atan2(-dirX, dirY)
    this.pointingAngleDeg = (angle * 180) / Math.PI
    this.visual.getTransform().setLocalRotation(quat.angleAxis(angle, vec3.forward()))
    this.setVisible(true)
  }

  hide(): void {
    this.setVisible(false)
  }

  isVisible(): boolean {
    return this.visible
  }

  /** 0 = up the view, positive = turning anticlockwise towards the left. */
  getAngleDeg(): number {
    return this.pointingAngleDeg
  }

  private setVisible(visible: boolean): void {
    if (this.visible !== visible) {
      this.visible = visible
      this.visual.enabled = visible
    }
  }
}
