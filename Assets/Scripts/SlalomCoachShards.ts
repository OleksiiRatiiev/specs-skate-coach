/**
 * SlalomCoachShards - one-shot burst of neon shards (cyan, magenta, white, amber) for a clean run.
 *
 * Owns: a small pool of shard objects, their motion and fade. World-anchored: the burst is placed
 * in the world at a point and never follows the head. No sound.
 * Must not: decide when to burst. SlalomCoachMain calls burst() and tick().
 */

import {AMBER, CYAN, MAGENTA, WHITE} from "./SlalomCoachNeon"
import {buildShardMesh} from "./SlalomCoachMeshes"

const unlitMaterial = requireAsset("../Materials/SlalomUnlit.mat") as Material

const SHARD_COUNT = 56
const FALL_SEC = 5
const FADE_SEC = 1
const LIFETIME_SEC = FALL_SEC + FADE_SEC
const GRAVITY_CM_S2 = 80
const DRAG_PER_SEC = 2.5

interface Shard {
  object: SceneObject
  material: Material
  color: vec4
  velocity: vec3
  spinAxis: vec3
  spinSpeed: number
  age: number
  scale: number
}

export class SlalomCoachShards {
  private root: SceneObject
  private shards: Shard[] = []
  private active = false
  private elapsed = 0
  private floorY = -1e9

  constructor() {
    this.root = global.scene.createSceneObject("CelebrationShards")
    const mesh = buildShardMesh(14, 4)
    const palette = [CYAN, MAGENTA, WHITE, AMBER]
    for (let i = 0; i < SHARD_COUNT; i++) {
      const object = global.scene.createSceneObject(`Shard_${i}`)
      object.setParent(this.root)
      const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      visual.mesh = mesh
      const material = unlitMaterial.clone()
      material.mainPass.twoSided = true
      material.mainPass.blendMode = BlendMode.Normal
      material.mainPass.depthWrite = false
      visual.mainMaterial = material
      object.enabled = false
      this.shards.push({
        object,
        material,
        color: palette[i % palette.length],
        velocity: vec3.zero(),
        spinAxis: vec3.up(),
        spinSpeed: 0,
        age: 0,
        scale: 1,
      })
    }
  }

  /** Starts a burst centred on a world point. */
  burst(centre: vec3, floorY: number = -1e9): void {
    this.floorY = floorY
    this.active = true
    this.elapsed = 0
    for (const shard of this.shards) {
      const angle = Math.random() * Math.PI * 2
      const spread = 40 + Math.random() * 110
      shard.velocity = new vec3(Math.cos(angle) * spread, 150 + Math.random() * 190, Math.sin(angle) * spread)
      shard.spinAxis = new vec3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      shard.spinSpeed = 4 + Math.random() * 10
      shard.scale = 0.6 + Math.random() * 0.9
      shard.age = 0
      const transform = shard.object.getTransform()
      transform.setWorldPosition(centre.add(new vec3((Math.random() - 0.5) * 30, Math.random() * 10, (Math.random() - 0.5) * 30)))
      transform.setWorldRotation(quat.angleAxis(Math.random() * Math.PI * 2, shard.spinAxis))
      transform.setLocalScale(new vec3(shard.scale, shard.scale, shard.scale))
      shard.object.enabled = true
      shard.material.mainPass.baseColor = shard.color
    }
  }

  isActive(): boolean {
    return this.active
  }

  getVisibleCount(): number {
    return this.shards.filter((s) => s.object.enabled).length
  }

  /** The colours used, for tests. */
  static palette(): vec4[] {
    return [CYAN, MAGENTA, WHITE, AMBER]
  }

  stop(): void {
    this.active = false
    for (const shard of this.shards) {
      shard.object.enabled = false
    }
  }

  tick(dt: number): void {
    if (!this.active) {
      return
    }
    this.elapsed += dt
    for (const shard of this.shards) {
      if (!shard.object.enabled) {
        continue
      }
      shard.age += dt
      if (shard.age >= LIFETIME_SEC) {
        shard.object.enabled = false
        continue
      }
      // Gravity with air drag: the shards flutter down slowly instead of dropping.
      const drag = Math.exp(-DRAG_PER_SEC * dt)
      shard.velocity = new vec3(shard.velocity.x * drag, (shard.velocity.y - GRAVITY_CM_S2 * dt) * drag, shard.velocity.z * drag)
      const transform = shard.object.getTransform()
      const moved = transform.getWorldPosition().add(shard.velocity.uniformScale(dt))
      transform.setWorldPosition(new vec3(moved.x, Math.max(moved.y, this.floorY + 0.5), moved.z))
      transform.setWorldRotation(quat.angleAxis(shard.spinSpeed * dt, shard.spinAxis).multiply(transform.getWorldRotation()))
      const alpha = shard.age < FALL_SEC ? 1 : 1 - (shard.age - FALL_SEC) / FADE_SEC
      shard.material.mainPass.baseColor = new vec4(shard.color.x, shard.color.y, shard.color.z, alpha)
    }
    if (this.elapsed >= LIFETIME_SEC) {
      this.stop()
    }
  }
}
