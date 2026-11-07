/**
 * SlalomCoachDrillView - draws one copy of the drill. Used twice: the placed drill and the ghost.
 *
 * Owns: the drill's meshes and materials, and which pole/cone colours are showing.
 * Expects: a DrillLayout from build(). Local space: origin at the pad centre, travel along -Z.
 * Must not: decide anything about the run. It shows what SlalomCoachMain tells it to.
 */

import {DrillLayout} from "./SlalomCoachDrillLayout"
import {
  buildFlatRectMesh,
  buildFrustumMesh,
  buildRectOutlineMesh,
  buildRibbonMesh,
} from "./SlalomCoachMeshes"

const unlitMaterial = requireAsset("../Materials/SlalomUnlit.mat") as Material

const CONE_SEGMENTS = 18
const POLE_SEGMENTS = 10
const PAD_FILL_Y = 0.5
const PAD_EDGE_Y = 0.7
const PATH_HALO_Y = 0.9
const PATH_CORE_Y = 1.1
const FINISH_Y = 1.3

@component
export class SlalomCoachDrillView extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SlalomCoachDrillView - one copy of the drill</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Faint copy shown while choosing where to place the drill")
  isGhost: boolean = false

  @input
  @hint("Brightness of the ghost compared with the placed drill")
  @widget(new SliderWidget(0.05, 1, 0.05))
  ghostStrength: number = 0.4

  @input
  @hint("Cone height in cm")
  @widget(new SliderWidget(10, 60, 1))
  coneHeightCm: number = 30

  @input
  @hint("Cone base radius in cm")
  @widget(new SliderWidget(4, 20, 1))
  coneRadiusCm: number = 10

  @input
  @hint("Marker pole height above the floor in cm")
  @widget(new SliderWidget(50, 150, 5))
  poleHeightCm: number = 100

  @input
  @hint("Marker pole thickness in cm")
  @widget(new SliderWidget(1, 6, 0.5))
  poleThicknessCm: number = 2

  @input
  @hint("How many times thicker the highlighted next pole is than the others")
  @widget(new SliderWidget(1, 4, 0.5))
  highlightThicknessFactor: number = 2

  @input
  @hint("Depth of the finish band along the drill, in cm")
  @widget(new SliderWidget(10, 60, 1))
  finishBandDepthCm: number = 30

  @input
  @hint("Width of the glowing path line in cm")
  @widget(new SliderWidget(4, 30, 1))
  pathWidthCm: number = 10

  @input("vec3", "{0.72,0.82,0.95}")
  @hint("Cone colour before and after a clean pass. Keep it clearly different from the miss colour")
  @widget(new ColorWidget())
  coneColor: vec3

  @input("vec3", "{1,0.62,0.05}")
  @hint("Cone colour after a miss")
  @widget(new ColorWidget())
  coneMissedColor: vec3

  @input("vec3", "{0.12,0.38,0.46}")
  @hint("Pole colour when it is not the next cone")
  @widget(new ColorWidget())
  poleColor: vec3

  @input("vec3", "{0.85,1,1}")
  @hint("Pole colour when it is the next cone. Much brighter than the others")
  @widget(new ColorWidget())
  poleHighlightColor: vec3

  @input("vec3", "{0.15,0.75,0.8}")
  @hint("Path line colour at rest")
  @widget(new ColorWidget())
  pathColor: vec3

  @input("vec3", "{0.75,1,1}")
  @hint("Path line colour when it brightens because the skater drifted away")
  @widget(new ColorWidget())
  pathBrightColor: vec3

  @input("vec3", "{0.3,0.7,0.75}")
  @hint("Start pad colour")
  @widget(new ColorWidget())
  padColor: vec3

  @input("vec3", "{1,1,0.95}")
  @hint("Finish band colour. Bright and wide so it reads from a distance")
  @widget(new ColorWidget())
  finishColor: vec3
  @ui.group_end

  private partsRoot: SceneObject | null = null
  private coneMaterials: Material[] = []
  private poleMaterials: Material[] = []
  private poleHalos: SceneObject[] = []
  private poleThick: SceneObject[] = []
  private coneObjects: SceneObject[] = []
  private poleObjects: SceneObject[] = []
  private pathMaterial: Material | null = null
  private pathHaloMaterial: Material | null = null
  private builtKey = ""
  private flashObjects: SceneObject[] = []
  private flashMaterials: Material[] = []
  private waveColors: vec3[] = [new vec3(1, 0.24, 0.94), new vec3(1, 1, 1)]
  private flashes: {index: number; delay: number; age: number; duration: number; kind: "wave" | "miss"}[] = []

  /** Rebuilds the geometry when the spacing changes. Safe to call repeatedly. */
  build(layout: DrillLayout): void {
    const key = `${layout.config.coneCount}@${layout.config.spacingCm}`
    if (this.builtKey === key && this.partsRoot) {
      return
    }
    if (this.partsRoot) {
      this.partsRoot.destroy()
    }
    this.builtKey = key
    this.flashObjects = []
    this.flashMaterials = []
    this.flashes = []
    this.coneMaterials = []
    this.poleMaterials = []
    this.poleHalos = []
    this.poleThick = []
    this.coneObjects = []
    this.poleObjects = []

    const root = global.scene.createSceneObject("Parts")
    root.setParent(this.sceneObject)
    this.partsRoot = root

    this.addPad(root, layout)
    this.addPath(root, layout)
    this.addFinish(root, layout)

    const coneMesh = buildFrustumMesh(this.coneRadiusCm, 1, this.coneHeightCm, CONE_SEGMENTS)
    const poleMesh = buildFrustumMesh(this.poleThicknessCm / 2, this.poleThicknessCm / 2, this.poleHeightCm, POLE_SEGMENTS)
    const thickRadius = (this.poleThicknessCm * this.highlightThicknessFactor) / 2
    const thickMesh = buildFrustumMesh(thickRadius, thickRadius, this.poleHeightCm, POLE_SEGMENTS)
    const haloMesh = buildFrustumMesh(thickRadius * 2.2, thickRadius * 2.2, this.poleHeightCm, POLE_SEGMENTS)
    const flashMesh = buildFrustumMesh(thickRadius * 1.6, thickRadius * 1.6, this.poleHeightCm, POLE_SEGMENTS)

    for (let i = 0; i < layout.coneS.length; i++) {
      const position = new vec3(0, 0, -layout.coneS[i])
      const cone = this.addPart(root, `Cone_${i + 1}`, coneMesh, this.coneColor, 1, position)
      const pole = this.addPart(root, `Pole_${i + 1}`, poleMesh, this.poleColor, 1, position)
      const thick = this.addPart(root, `PoleNext_${i + 1}`, thickMesh, this.poleHighlightColor, 1, position)
      const halo = this.addPart(root, `PoleHalo_${i + 1}`, haloMesh, this.poleHighlightColor, 0.3, position)
      const flash = this.addPart(root, `PoleFlash_${i + 1}`, flashMesh, this.poleHighlightColor, 0, position)
      flash.object.enabled = false
      this.flashObjects.push(flash.object)
      this.flashMaterials.push(flash.material)
      thick.object.enabled = false
      halo.object.enabled = false
      this.poleThick.push(thick.object)
      this.coneMaterials.push(cone.material)
      this.poleMaterials.push(pole.material)
      this.poleHalos.push(halo.object)
      this.coneObjects.push(cone.object)
      this.poleObjects.push(pole.object)
    }
  }

  setVisible(visible: boolean): void {
    this.sceneObject.enabled = visible
  }

  isVisible(): boolean {
    return this.sceneObject.enabled
  }

  setConeMissed(index: number, missed: boolean): void {
    this.coneMaterials[index].mainPass.baseColor = this.tint(missed ? this.coneMissedColor : this.coneColor, 1)
  }

  clearConeColours(): void {
    for (let i = 0; i < this.coneMaterials.length; i++) {
      this.setConeMissed(i, false)
    }
  }

  /** Lights exactly one pole. Pass -1 for none. */
  setHighlightedPole(index: number): void {
    for (let i = 0; i < this.poleMaterials.length; i++) {
      const lit = i === index
      this.poleMaterials[i].mainPass.baseColor = this.tint(this.poleColor, 1)
      this.poleObjects[i].enabled = !lit
      this.poleThick[i].enabled = lit
      this.poleHalos[i].enabled = lit
    }
  }

  /** 0 = resting path line, 1 = fully brightened. */
  setPathGlow(level: number): void {
    if (!this.pathMaterial || !this.pathHaloMaterial) {
      return
    }
    const mixed = vec3.lerp(this.pathColor, this.pathBrightColor, level)
    this.pathMaterial.mainPass.baseColor = this.tint(mixed, 1)
    this.pathHaloMaterial.mainPass.baseColor = this.tint(mixed, 0.22 + 0.25 * level)
  }

  /** Neon wave of flashing poles from the first cone to the last (clean-run celebration). */
  playWave(colorA: vec3, colorB: vec3, stepSec: number): void {
    this.waveColors = [colorA, colorB]
    for (let i = 0; i < this.flashObjects.length; i++) {
      this.flashes.push({index: i, delay: i * stepSec, age: 0, duration: 0.55, kind: "wave"})
    }
  }

  /** One amber pulse on each missed cone (and its pole). */
  pulseMissed(indices: number[]): void {
    for (const index of indices) {
      this.flashes.push({index, delay: 0, age: 0, duration: 0.9, kind: "miss"})
    }
  }

  isFlashing(): boolean {
    return this.flashes.length > 0
  }

  /** Advances any running flashes. Call every frame. */
  tickEffects(dt: number): void {
    if (this.flashes.length === 0) {
      return
    }
    const alive: typeof this.flashes = []
    for (const f of this.flashes) {
      f.age += dt
      const t = f.age - f.delay
      const object = this.flashObjects[f.index]
      if (!object) {
        continue
      }
      if (t < 0) {
        alive.push(f)
        continue
      }
      if (t >= f.duration) {
        object.enabled = false
        this.coneObjects[f.index].getTransform().setLocalScale(vec3.one())
        continue
      }
      const u = t / f.duration
      const envelope = Math.sin(u * Math.PI)
      object.enabled = true
      if (f.kind === "wave") {
        const colour = vec3.lerp(this.waveColors[0], this.waveColors[1], u)
        this.flashMaterials[f.index].mainPass.baseColor = new vec4(colour.x, colour.y, colour.z, 0.95 * envelope)
      } else {
        this.flashMaterials[f.index].mainPass.baseColor = new vec4(this.coneMissedColor.x, this.coneMissedColor.y, this.coneMissedColor.z, 0.85 * envelope)
        const grow = 1 + 0.35 * envelope
        this.coneObjects[f.index].getTransform().setLocalScale(new vec3(grow, grow, grow))
      }
      alive.push(f)
    }
    this.flashes = alive
  }

  /** Stops every flash and puts cones back to normal size. */
  clearEffects(): void {
    this.flashes = []
    for (const object of this.flashObjects) {
      object.enabled = false
    }
    for (const cone of this.coneObjects) {
      cone.getTransform().setLocalScale(vec3.one())
    }
  }

  getConeCount(): number {
    return this.coneObjects.length
  }

  getPoleThicknessCm(): number {
    return this.poleThicknessCm
  }

  getHighlightPoleThicknessCm(): number {
    return this.poleThicknessCm * this.highlightThicknessFactor
  }

  getFinishBandDepthCm(): number {
    return this.finishBandDepthCm
  }

  getConeWorldPosition(index: number): vec3 {
    return this.coneObjects[index].getTransform().getWorldPosition()
  }

  getPoleWorldPosition(index: number): vec3 {
    return this.poleObjects[index].getTransform().getWorldPosition()
  }

  private addPad(root: SceneObject, layout: DrillLayout): void {
    const size = layout.config.padSizeCm
    this.addPart(root, "StartPad", buildFlatRectMesh(size, size, PAD_FILL_Y), this.padColor, 0.3, vec3.zero())
    this.addPart(root, "StartPadEdge", buildRectOutlineMesh(size, 3, PAD_EDGE_Y), this.padColor, 1, vec3.zero())
  }

  private addPath(root: SceneObject, layout: DrillLayout): void {
    const halo = this.addPart(root, "PathHalo", buildRibbonMesh(layout.pathSamples, this.pathWidthCm * 2, PATH_HALO_Y), this.pathColor, 0.22, vec3.zero())
    const core = this.addPart(root, "PathLine", buildRibbonMesh(layout.pathSamples, this.pathWidthCm, PATH_CORE_Y), this.pathColor, 1, vec3.zero())
    this.pathHaloMaterial = halo.material
    this.pathMaterial = core.material
  }

  private addFinish(root: SceneObject, layout: DrillLayout): void {
    const width = layout.config.padSizeCm
    const centre = new vec3(0, 0, -layout.finishS)
    this.addPart(root, "FinishBandGlow", buildFlatRectMesh(width + 16, this.finishBandDepthCm + 16, FINISH_Y - 0.1), this.finishColor, 0.28, centre)
    this.addPart(root, "FinishBand", buildFlatRectMesh(width, this.finishBandDepthCm, FINISH_Y), this.finishColor, 1, centre)
  }

  private addPart(parent: SceneObject, name: string, mesh: RenderMesh, color: vec3, alpha: number, position: vec3): {object: SceneObject; material: Material} {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    object.getTransform().setLocalPosition(position)
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = mesh
    const material = unlitMaterial.clone()
    material.mainPass.baseColor = this.tint(color, alpha)
    material.mainPass.twoSided = true
    material.mainPass.blendMode = BlendMode.Normal
    material.mainPass.depthWrite = alpha >= 1 && !this.isGhost
    visual.mainMaterial = material
    return {object, material}
  }

  private tint(color: vec3, alpha: number): vec4 {
    const strength = this.isGhost ? this.ghostStrength : 1
    return new vec4(color.x, color.y, color.z, alpha * strength)
  }
}
