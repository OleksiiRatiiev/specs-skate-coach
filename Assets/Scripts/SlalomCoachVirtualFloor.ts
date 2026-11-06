/**
 * SlalomCoachVirtualFloor - PREVIEW STAND-IN for the real parking lot.
 *
 * Owns: a large dim floor sheet with a 1 m grid, large enough for the whole drill.
 * Must not: pretend to sense the ground. On a real device it hides itself by default, and
 * the drill sits at the floor height SlalomCoachMain estimates from the wearer's eye height.
 */

import {buildFloorGridMesh, buildFloorMesh} from "./SlalomCoachMeshes"

const unlitMaterial = requireAsset("../Materials/SlalomUnlit.mat") as Material

@component
export class SlalomCoachVirtualFloor extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachVirtualFloor - stand-in for the parking lot</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Width and depth of the floor in cm")
  @widget(new SliderWidget(1000, 10000, 100))
  floorSizeCm: number = 6000

  @input
  @hint("Grid line spacing in cm")
  @widget(new SliderWidget(25, 500, 25))
  gridStepCm: number = 100

  @input
  @hint("Hide the stand-in floor outside the Lens Studio preview")
  hideOnDevice: boolean = true

  @input("vec3", "{0.09,0.11,0.14}")
  @hint("Floor colour. The display is additive, so this stays faint on glasses")
  @widget(new ColorWidget())
  floorColor: vec3

  @input("vec3", "{0.24,0.29,0.34}")
  @hint("Grid line colour")
  @widget(new ColorWidget())
  gridColor: vec3
  @ui.group_end

  onAwake(): void {
    if (this.hideOnDevice && !global.deviceInfoSystem.isEditor()) {
      this.sceneObject.enabled = false
      return
    }
    this.addSheet("FloorSheet", buildFloorMesh(this.floorSizeCm), this.floorColor)
    this.addSheet("FloorGrid", buildFloorGridMesh(this.floorSizeCm, this.gridStepCm, 1.2, 0.1), this.gridColor)
  }

  setFloorHeight(floorY: number): void {
    const transform = this.sceneObject.getTransform()
    const position = transform.getWorldPosition()
    transform.setWorldPosition(new vec3(position.x, floorY, position.z))
  }

  private addSheet(name: string, mesh: RenderMesh, color: vec3): void {
    const object = global.scene.createSceneObject(name)
    object.setParent(this.sceneObject)
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = mesh
    const material = unlitMaterial.clone()
    material.mainPass.baseColor = new vec4(color.x, color.y, color.z, 1)
    material.mainPass.twoSided = true
    visual.mainMaterial = material
  }
}
