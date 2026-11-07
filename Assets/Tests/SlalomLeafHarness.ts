/**
 * SlalomLeafHarness - shared test helpers for the Slalom Coach LEAF scenarios. Test-only.
 *
 * Owns: moving the skater through a runtime camera rig, real pinches, evidence logging and
 * direct measurement of the running scene (bounds, mesh vertices, material colours, enabled state).
 * Reads the Lens only through SlalomCoachTestState and the scene. It never calls SlalomCoachMain.
 */

import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {
  findSceneObjectByName,
  forEachComponentInSubtree,
  nextFrame,
  sleep,
  withTimeout,
} from "Leaf.lspkg/Utils/common/Utils"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {SlalomCoachSnapshot, SlalomCoachTestState} from "../Scripts/SlalomCoachTestState"

export const CONE_COUNT = 6
export const CUE_PHRASES = ["Eyes up", "Bend knees", "Arms forward", "Back to line"]
const AMBER = new vec3(1, 0.62, 0.05)
const PINCH_TIMEOUT_MS = 30000
const MAX_PINCH_ATTEMPTS = 3

export function snap(): SlalomCoachSnapshot {
  const snapshot = SlalomCoachTestState.instance ? SlalomCoachTestState.instance.getSnapshot() : null
  if (!snapshot) {
    throw new Error("SlalomCoachTestState has no snapshot, so the Lens is not running")
  }
  return snapshot
}

export function fmt(n: number): string {
  return n === undefined || n === null || isNaN(n) ? String(n) : n.toFixed(2)
}

export function v3(v: vec3 | {x: number; y: number; z: number}): vec3 {
  return new vec3(v.x, v.y, v.z)
}

export function fmtV(v: {x: number; y: number; z: number}): string {
  return `(${fmt(v.x)},${fmt(v.y)},${fmt(v.z)})`
}

/** Records every result to the log and fails the scenario at the end, so one run reports all findings. */
export class Checks {
  readonly failures: string[] = []

  constructor(private tag: string) {}

  ok(label: string, condition: boolean, detail: string = ""): boolean {
    print(`[SLALOM][${this.tag}] ${condition ? "PASS" : "FAIL"} ${label}${detail ? " :: " + detail : ""}`)
    if (!condition) {
      this.failures.push(`${label}${detail ? " (" + detail + ")" : ""}`)
    }
    return condition
  }

  near(label: string, actual: number, expected: number, tolerance: number): boolean {
    return this.ok(label, Math.abs(actual - expected) <= tolerance, `actual=${fmt(actual)} expected=${expected}+-${tolerance}`)
  }

  between(label: string, actual: number, low: number, high: number): boolean {
    return this.ok(label, actual >= low && actual <= high, `actual=${fmt(actual)} range=[${low},${high}]`)
  }

  info(label: string, detail: string = ""): void {
    print(`[SLALOM][${this.tag}] INFO ${label}${detail ? " :: " + detail : ""}`)
  }

  deviation(label: string, detail: string = ""): void {
    print(`[SLALOM][${this.tag}] DEVIATION ${label}${detail ? " :: " + detail : ""}`)
  }

  finish(): void {
    for (const stray of strays) {
      this.failures.push(`stray press: ${stray}`)
      print(`[SLALOM][${this.tag}] FAIL stray press: ${stray}`)
    }
    print(`[SLALOM][${this.tag}] DONE failures=${this.failures.length}`)
    if (this.failures.length > 0) {
      throw new Error(`${this.failures.length} check(s) failed: ${this.failures.join(" | ")}`)
    }
  }
}

const DRAG_TIMEOUT_MS = 60000
const TRACE_NAMES = ["ConesMinusButton", "ConesPlusButton", "SpacingMinusButton", "SpacingPlusButton", "PlaceDrillButton", "AgainButton", "MoveDrillButton"]

export interface TraceEvent {
  t: number
  name: string
  type: string
}

/** Every hover, trigger and drag event seen on the setup and card controls, so a stray press is visible. */
export const traceEvents: TraceEvent[] = []

/** Presses that landed on a control other than the one being pinched or dragged. Any entry fails the scenario. */
export const strays: string[] = []

export function eventCount(name: string, type: string): number {
  return traceEvents.filter((event) => event.name === name && event.type === type).length
}

/** Pinches and drags with LEAF's simulated arm and hand, through SIK. Never calls the Lens's own methods. */
export class Pincher {
  readonly mode: string
  readonly defaultHand: "left" | "right"
  readonly placeHand: "left" | "right"
  timeoutMs = PINCH_TIMEOUT_MS
  private ik: ReturnType<typeof createIKInteractor> | null = null
  private sik: DefaultLeafInteractor | null = null
  private traced = new Set<string>()

  constructor(config?: ScenarioConfig) {
    this.defaultHand = (((config && config.get("hand")) || "right") as "left" | "right")
    this.placeHand = (((config && config.get("placeHand")) || "right") as "left" | "right")
    this.mode = (config && config.get("pinch")) || "ik"
    traceEvents.length = 0
    strays.length = 0
    if (this.mode === "ik") {
      this.ik = createIKInteractor({avatar: {debugOverlay: false}})
    }
    if (this.mode === "sik") {
      this.sik = new DefaultLeafInteractor()
    }
  }

  private camera(): Camera {
    return findRequired("Camera Object").getComponent("Component.Camera") as Camera
  }

  /** Logs events on every control, so a pinch that lands elsewhere is visible. */
  traceAll(): void {
    for (const name of TRACE_NAMES) {
      const interactable = findInteractableByName(name)
      if (!interactable || this.traced.has(name)) {
        continue
      }
      this.traced.add(name)
      const record = (type: string): void => {
        traceEvents.push({t: getTime(), name, type})
        print(`[SLALOM][trace] ${fmt(getTime())} ${type} ${name}`)
      }
      interactable.onHoverEnter.add(() => record("hoverEnter"))
      interactable.onHoverExit.add(() => record("hoverExit"))
      interactable.onTriggerStart.add(() => record("triggerStart"))
      interactable.onTriggerEnd.add(() => record("triggerEnd"))
      interactable.onDragStart.add(() => record("dragStart"))
      interactable.onDragEnd.add(() => record("dragEnd"))
    }
  }

  private handFor(name: string, override?: "left" | "right"): "left" | "right" {
    return override || (name === "PlaceDrillButton" ? this.placeHand : this.defaultHand)
  }

  /**
   * Pinches, and retries a failed pinch up to MAX_PINCH_ATTEMPTS times. Every failed attempt is logged
   * as RETRY, so a scenario that passed after a retry can be told from one that passed first time.
   * A retry is only taken when the pinch itself failed (no trigger, or a reach diagnostic).
   */
  async pinch(name: string, handOverride?: "left" | "right", onFrame?: (state: SlalomCoachSnapshot) => void): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.pinchOnce(name, handOverride, onFrame)
        if (attempt > 1) {
          print(`[SLALOM][pinch] ${name} succeeded on attempt ${attempt}`)
        }
        return
      } catch (error) {
        const message = String(error)
        const noTrigger = message.indexOf("produced 0 trigger ends") >= 0 || message.indexOf("[IK ") >= 0 || message.indexOf("did not complete") >= 0
        print(`[SLALOM][pinch] RETRY ${name} attempt ${attempt} failed: ${message}`)
        if (!noTrigger || attempt >= MAX_PINCH_ATTEMPTS || (!this.retryAllowed)) {
          throw error
        }
        await sleep(2500)
      }
    }
  }

  retryAllowed = true

  private recordStrays(target: string, since: number): void {
    for (const event of traceEvents) {
      if (event.t >= since && event.type === "triggerStart" && event.name !== target) {
        const text = `${event.name} was pressed at t=${fmt(event.t)} during an action on ${target}`
        strays.push(text)
        print(`[SLALOM][stray] ${text}`)
      }
    }
  }

  private describeTarget(name: string, target: Interactable, hand: "left" | "right"): string {
    const position = target.getTransform().getWorldPosition()
    const onScreen = this.camera().worldSpaceToScreenSpace(position)
    const route = this.ik ? `${hand} ${this.ik[hand].isIndirect(target) ? "far-field ray" : "direct poke"}` : this.sik ? "simulated SIK interactor (no arm)" : `simulated ${hand} hand`
    return `target ${name} at ${fmtV(position)} eyeDistance=${fmt(position.distance(WorldEye()))} screen=(${fmt(onScreen.x)},${fmt(onScreen.y)}) enabled=${target.enabled} colliders=${target.colliders.length} route=${route}`
  }

  private async pinchOnce(name: string, handOverride?: "left" | "right", onFrame?: (state: SlalomCoachSnapshot) => void): Promise<void> {
    const hand = this.handFor(name, handOverride)
    const target = findInteractableByName(name, undefined, true)
    if (!target) {
      throw new Error(`No enabled Interactable named ${name}`)
    }
    this.traceAll()
    let triggerEnds = 0
    const unsubscribe = target.onTriggerEnd.add(() => {
      triggerEnds++
    })
    const started = getTime()
    print(`[SLALOM][pinch] ${this.mode} -> ${name} ${this.describeTarget(name, target, hand)}`)
    const action = this.ik ? this.ik.trigger(target, hand) : this.sik ? this.sik.trigger(target) : LeafHandInteractor.get(hand).trigger(target)
    let sampling = true
    const sampler = (async () => {
      while (sampling) {
        if (onFrame) {
          try {
            onFrame(snap())
          } catch (error) {
            print(`[SLALOM][pinch] sampler error ${error}`)
          }
        }
        await nextFrame()
      }
    })()
    try {
      await withTimeout(action, this.timeoutMs, `Pinch on ${name} did not complete within ${this.timeoutMs / 1000}s`)
    } finally {
      sampling = false
    }
    await sampler
    unsubscribe()
    this.recordStrays(name, started)
    print(`[SLALOM][pinch] ${name} done in ${fmt(getTime() - started)}s triggerEnds=${triggerEnds}`)
    if (triggerEnds !== 1) {
      throw new Error(`Pinch on ${name} produced ${triggerEnds} trigger ends, expected exactly 1`)
    }
    await frames(3)
  }

  /**
   * Pinches the target and drags it by a world-space offset in cm. onFrame sees the Lens's published
   * state on every frame while the drag is in progress, so live behaviour can be sampled mid-drag.
   */
  async drag(name: string, delta: vec3, handOverride?: "left" | "right", onFrame?: (state: SlalomCoachSnapshot) => void): Promise<void> {
    const hand = this.handFor(name, handOverride)
    const target = findInteractableByName(name, undefined, true)
    if (!target) {
      throw new Error(`No enabled Interactable named ${name}`)
    }
    this.traceAll()
    print(`[SLALOM][drag] ${this.mode} -> ${name} delta=${fmtV(delta)} ${this.describeTarget(name, target, hand)}`)
    let done = false
    const sampler = (async () => {
      while (!done) {
        if (onFrame) {
          try {
            onFrame(snap())
          } catch (error) {
            print(`[SLALOM][drag] sampler error ${error}`)
          }
        }
        await nextFrame()
      }
    })()
    const started = getTime()
    try {
      const action = this.ik ? this.ik.drag(target, delta, hand) : this.handDrag(target, delta, hand)
      await withTimeout(action, DRAG_TIMEOUT_MS, `Drag on ${name} did not complete within ${DRAG_TIMEOUT_MS / 1000}s`)
    } finally {
      done = true
    }
    await sampler
    this.recordStrays(name, started)
    print(`[SLALOM][drag] ${name} done in ${fmt(getTime() - started)}s`)
    await frames(3)
  }

  private handDrag(target: Interactable, delta: vec3, hand: "left" | "right"): Promise<void> {
    const durationMs = 1500
    const updates = Math.max(1, Math.round(durationMs / 1000 / Math.max(0.008, getDeltaTime())))
    const perUpdate = delta.uniformScale(1 / updates)
    return this.sik ? this.sik.drag(target, perUpdate, durationMs) : LeafHandInteractor.get(hand).drag(target, perUpdate, durationMs)
  }
}

function WorldEye(): vec3 {
  return findRequired("Camera Object").getTransform().getWorldPosition()
}

/** Lets the Lens run for a number of seconds, calling onFrame with its published state on every frame. */
export async function hold(seconds: number, onFrame?: (state: SlalomCoachSnapshot) => void): Promise<void> {
  const until = getTime() + seconds
  while (getTime() < until) {
    await nextFrame()
    if (onFrame) {
      onFrame(snap())
    }
  }
}

export async function frames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await nextFrame()
  }
}

export function findRequired(name: string, root?: SceneObject): SceneObject {
  const found = findSceneObjectByName(name, root)
  if (!found) {
    throw new Error(`Scene object ${name} not found${root ? " under " + root.name : ""}`)
  }
  return found
}

export function buttonNamed(name: string): Button {
  return findRequired(name).getComponent(Button.getTypeName()) as Button
}

export interface Bounds {
  min: vec3
  max: vec3
  size: vec3
  centre: vec3
}

export function visualOf(object: SceneObject): RenderMeshVisual {
  const visual = object.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  if (!visual) {
    throw new Error(`${object.name} has no RenderMeshVisual`)
  }
  return visual
}

export function boundsOf(object: SceneObject): Bounds {
  const visual = visualOf(object)
  const min = visual.worldAabbMin()
  const max = visual.worldAabbMax()
  return {min, max, size: max.sub(min), centre: min.add(max).uniformScale(0.5)}
}

/**
 * Size of an object's mesh from its real vertices, in the object's own axes and scaled to world cm.
 * Independent of how the drill is turned in the world, and works for objects that are switched off.
 */
export function meshExtents(object: SceneObject): {min: vec3; max: vec3; size: vec3} {
  const mesh = visualOf(object).mesh
  const positions = mesh.extractVerticesForAttribute("position")
  const scale = object.getTransform().getWorldScale()
  let min = new vec3(1e9, 1e9, 1e9)
  let max = new vec3(-1e9, -1e9, -1e9)
  for (let i = 0; i + 2 < positions.length; i += 3) {
    min = new vec3(Math.min(min.x, positions[i]), Math.min(min.y, positions[i + 1]), Math.min(min.z, positions[i + 2]))
    max = new vec3(Math.max(max.x, positions[i]), Math.max(max.y, positions[i + 1]), Math.max(max.z, positions[i + 2]))
  }
  min = min.mult(scale)
  max = max.mult(scale)
  return {min, max, size: max.sub(min)}
}

export function colorOf(object: SceneObject): vec4 {
  return visualOf(object).mainMaterial.mainPass.baseColor
}

export function luminance(color: vec4): number {
  return 0.2126 * color.x + 0.7152 * color.y + 0.0722 * color.z
}

export function isAmber(color: vec4): boolean {
  return new vec3(color.x, color.y, color.z).distance(AMBER) < 0.05
}

/** One copy of the drill in the running scene. */
export class DrillParts {
  readonly root: SceneObject

  constructor(rootName: "Drill" | "GhostDrill") {
    this.root = findRequired(rootName)
  }

  part(name: string): SceneObject {
    return findRequired(name, this.root)
  }

  cone(index: number): SceneObject {
    return this.part(`Cone_${index + 1}`)
  }

  pole(index: number): SceneObject {
    return this.part(`Pole_${index + 1}`)
  }

  poleNext(index: number): SceneObject {
    return this.part(`PoleNext_${index + 1}`)
  }

  /** The pole a person sees for this cone: the thick PoleNext when highlighted, otherwise the thin Pole. */
  visiblePole(index: number): SceneObject {
    return this.poleNext(index).enabled ? this.poleNext(index) : this.pole(index)
  }

  /** Number of cones on this drill, from the Lens's own state. */
  count(): number {
    return snap().coneCount
  }

  /** Cones whose thick PoleNext is showing. */
  nextPoles(): number[] {
    const shown: number[] = []
    for (let i = 0; i < this.count(); i++) {
      if (this.poleNext(i).enabled) {
        shown.push(i)
      }
    }
    return shown
  }

  litHalos(): number[] {
    const lit: number[] = []
    for (let i = 0; i < this.count(); i++) {
      if (this.part(`PoleHalo_${i + 1}`).enabled) {
        lit.push(i)
      }
    }
    return lit
  }

  /** The cone whose visible pole is brightest, judged from the real material colours. */
  brightestPole(): number {
    let best = -1
    let bestLuminance = -1
    for (let i = 0; i < this.count(); i++) {
      const value = luminance(colorOf(this.visiblePole(i)))
      if (value > bestLuminance + 0.001) {
        bestLuminance = value
        best = i
      }
    }
    return best
  }

  amberCones(): number[] {
    const amber: number[] = []
    for (let i = 0; i < this.count(); i++) {
      if (isAmber(colorOf(this.cone(i)))) {
        amber.push(i)
      }
    }
    return amber
  }
}

/**
 * The skater. Parents the Camera Object under a runtime rig and solves the rig every frame so the
 * camera's world pose is exactly the requested one, whatever local pose DeviceTracking writes.
 */
export class SkaterRig {
  yaw: number
  eye: vec3

  private cameraObject: SceneObject
  private cameraTransform: Transform
  private rigTransform: Transform
  private rig: SceneObject
  readonly camera: Camera

  private pitchRotation: quat
  private levelPitch: quat
  readonly basePitchDeg: number

  constructor(host: BaseScriptComponent, config?: ScenarioConfig) {
    this.cameraObject = findRequired("Camera Object")
    this.camera = this.cameraObject.getComponent("Component.Camera") as Camera
    this.cameraTransform = this.cameraObject.getTransform()
    this.eye = this.cameraTransform.getWorldPosition()
    const worldRotation = this.cameraTransform.getWorldRotation()
    const look = worldRotation.multiplyVec3(new vec3(0, 0, -1))
    this.yaw = Math.atan2(-look.x, -look.z)
    this.basePitchDeg = (Math.asin(Math.max(-1, Math.min(1, look.y))) * 180) / Math.PI
    // The camera's own tilt is kept, so the frustum is the real preview camera's. Only the heading is the rig's.
    const extraDown = parseFloat((config && config.get("lookDownDeg")) || "0")
    const levelPitch = quat.angleAxis(-this.yaw, vec3.up()).multiply(worldRotation)
    this.levelPitch = levelPitch
    this.pitchRotation = levelPitch.multiply(quat.angleAxis((-extraDown * Math.PI) / 180, vec3.right()))
    this.rig = global.scene.createSceneObject("LeafTestRig")
    this.rigTransform = this.rig.getTransform()
    this.cameraObject.setParent(this.rig)
    this.apply()
    host.createEvent("UpdateEvent").bind(() => this.apply())
    this.setupPitchDeg = this.pitchDownDeg()
  }

  private apply(): void {
    const localPosition = this.cameraTransform.getLocalPosition()
    const localRotation = this.cameraTransform.getLocalRotation()
    const wantedWorld = quat.angleAxis(this.yaw, vec3.up()).multiply(this.pitchRotation)
    const rigRotation = wantedWorld.multiply(localRotation.invert())
    this.rigTransform.setWorldRotation(rigRotation)
    this.rigTransform.setWorldPosition(this.eye.sub(rigRotation.multiplyVec3(localPosition)))
  }

  /** The downward tilt the rig started with, used to look back at the setup panel. */
  setupPitchDeg = 0

  /** Tilts the view to an absolute downward angle in degrees (0 is level), keeping the heading. */
  setPitchDownDeg(degrees: number): void {
    // Keep the camera's own base orientation and add only the difference from its starting tilt.
    this.pitchRotation = this.levelPitch.multiply(quat.angleAxis((-(degrees + this.basePitchDeg) * Math.PI) / 180, vec3.right()))
  }

  /** The camera's real downward tilt in degrees, positive looking down. */
  pitchDownDeg(): number {
    const look = this.cameraTransform.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    return (-Math.asin(Math.max(-1, Math.min(1, look.y))) * 180) / Math.PI
  }

  actualEye(): vec3 {
    return this.cameraTransform.getWorldPosition()
  }

  /** Distance between the requested and actual camera position, used to prove the rig works. */
  trackingErrorCm(): number {
    return this.actualEye().distance(this.eye)
  }

  heading(): vec3 {
    return new vec3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
  }

  /** Turns the skater so the view points the given number of degrees to the right of the drill direction. */
  faceRelativeToDrill(degreesRight: number): void {
    const forward = snap().drillForward
    this.yaw = Math.atan2(-forward.x, -forward.z) - (degreesRight * Math.PI) / 180
  }

  turnRight(degrees: number): void {
    this.yaw -= (degrees * Math.PI) / 180
  }

  setDrillPosition(s: number, t: number): void {
    const state = snap()
    const pad = state.padCentre
    const forward = state.drillForward
    const right = state.drillRight
    this.eye = new vec3(pad.x + forward.x * s + right.x * t, this.eye.y, pad.z + forward.z * s + right.z * t)
  }

  /** Walks at a steady speed along a lateral profile. onFrame sees each frame the Lens has published. */
  async walk(from: number, to: number, speedCmPerSec: number, lateral: (s: number) => number, onFrame?: (state: SlalomCoachSnapshot) => void): Promise<void> {
    const direction = to >= from ? 1 : -1
    let s = from
    let last = getTime()
    this.setDrillPosition(s, lateral(s))
    await nextFrame()
    while (true) {
      const now = getTime()
      s += direction * speedCmPerSec * (now - last)
      last = now
      const done = direction > 0 ? s >= to : s <= to
      if (done) {
        s = to
      }
      this.setDrillPosition(s, lateral(s))
      await nextFrame()
      if (onFrame) {
        onFrame(snap())
      }
      if (done) {
        break
      }
    }
    await frames(2)
    if (onFrame) {
      onFrame(snap())
    }
  }

  /** The point projected to the view: x and y in 0..1 mean inside it. z > 0 in view space means behind. */
  viewOf(point: vec3): {x: number; y: number; behind: boolean; inView: boolean} {
    const local = this.cameraTransform.getInvertedWorldTransform().multiplyPoint(point)
    const screen = this.camera.worldSpaceToScreenSpace(point)
    const behind = local.z > 0
    const inView = !behind && screen.x >= 0 && screen.x <= 1 && screen.y >= 0 && screen.y <= 1
    return {x: screen.x, y: screen.y, behind, inView}
  }

  /** True when any of the sampled points along the pole is inside the camera's view. */
  poleInView(pole: SceneObject): boolean {
    const bounds = boundsOf(pole)
    for (let i = 0; i <= 10; i++) {
      const y = bounds.min.y + (bounds.size.y * i) / 10
      if (this.viewOf(new vec3(bounds.centre.x, y, bounds.centre.z)).inView) {
        return true
      }
    }
    return false
  }
}

/** Cone stations measured from the real cone objects, projected onto the drill direction. */
export function measuredConeStations(state: SlalomCoachSnapshot, parts: DrillParts): number[] {
  const pad = v3(state.padCentre)
  const forward = v3(state.drillForward)
  const stations: number[] = []
  for (let i = 0; i < state.coneCount; i++) {
    stations.push(parts.cone(i).getTransform().getWorldPosition().sub(pad).dot(forward))
  }
  return stations
}

/** The skater's own weave: smooth swings that reach 50 cm on the correct side at each cone. */
export function weaveProfile(stations: number[], sides: number[], finish: number, padFront: number = 50, swing: number = 50): (s: number) => number {
  const knots: {s: number; t: number}[] = [{s: padFront, t: 0}]
  for (let i = 0; i < stations.length; i++) {
    knots.push({s: stations[i], t: sides[i] * swing})
  }
  knots.push({s: finish, t: 0})
  return (s: number): number => {
    if (s <= knots[0].s || s >= knots[knots.length - 1].s) {
      return 0
    }
    for (let i = 0; i < knots.length - 1; i++) {
      if (s <= knots[i + 1].s) {
        const u = (s - knots[i].s) / (knots[i + 1].s - knots[i].s)
        return knots[i].t + (knots[i + 1].t - knots[i].t) * u * u * (3 - 2 * u)
      }
    }
    return 0
  }
}

/** A weave that crosses one cone's line on the wrong side. */
export function weaveWithMiss(stations: number[], sides: number[], finish: number, missIndex: number): (s: number) => number {
  const clean = weaveProfile(stations, sides, finish)
  return (s: number): number => (Math.abs(s - stations[missIndex]) < 35 ? -sides[missIndex] * 30 : clean(s))
}

/** Every Text component in the scene, used to see what a person would really see. */
export function allTexts(): Text[] {
  const texts: Text[] = []
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
    forEachComponentInSubtree<Text>(global.scene.getRootObject(i), ["Component.Text"], (text) => texts.push(text))
  }
  return texts
}

/** How many cue phrases are really visible right now, across every Text in the scene. The stance card is excluded while it shows, because it repeats "Arms forward". */
export function visibleCuePhrases(labelText: Text, stanceCardVisible: boolean): number {
  let visible = 0
  for (const text of allTexts()) {
    if (isNull(text) || !text.getSceneObject().isEnabledInHierarchy || CUE_PHRASES.indexOf(text.text) < 0) {
      continue
    }
    if (text === labelText) {
      if (text.textFill.color.a > 0.001) {
        visible++
      }
    } else if (!stanceCardVisible) {
      visible++
    }
  }
  return visible
}

export function isUnder(object: SceneObject, ancestorName: string): boolean {
  let current: SceneObject | null = object
  while (current) {
    if (current.name === ancestorName) {
      return true
    }
    current = current.hasParent() ? current.getParent() : null
  }
  return false
}

export interface PlacedDrill {
  state: SlalomCoachSnapshot
  parts: DrillParts
  stations: number[]
  sides: number[]
  finish: number
  weave: (s: number) => number
}

export async function waitForLens(): Promise<void> {
  // UI Kit builds and starts its buttons over the first frames after launch.
  await sleep(1500)
  snap()
}

export const SPACING_MIN_M = 0.8
export const SPACING_MAX_M = 1.5

/** The setup slider as the UI Kit sees it. */
export class SliderProbe {
  readonly object: SceneObject
  readonly slider: Slider

  constructor() {
    this.object = findRequired("SpacingSliderCell")
    this.slider = this.object.getComponent(Slider.getTypeName()) as Slider
    if (!this.slider) {
      throw new Error("SpacingSliderCell has no UI Kit Slider")
    }
  }

  /** Track length in world cm: the slider's size times the world scale. */
  trackLengthCm(): number {
    return this.slider.size.x * this.object.getTransform().getWorldScale().x
  }

  rightAxis(): vec3 {
    return this.object.getTransform().right
  }

  /** The live UI Kit value, 0 to 1. */
  componentValue(): number {
    return this.slider.currentValue
  }
}

/** True when m is one of 0.8, 0.9 ... 1.5. */
export function isOnStep(m: number): boolean {
  return m >= SPACING_MIN_M - 1e-6 && m <= SPACING_MAX_M + 1e-6 && Math.abs(m * 10 - Math.round(m * 10)) < 1e-6
}

/** The slider is gone (the setup strip uses steppers). Kept only so older scenarios still compile. */
export async function dragSliderBy(_pincher: Pincher, _probe: SliderProbe, _deltaM: number, _overshootCm: number = 0, _onFrame?: (state: SlalomCoachSnapshot) => void): Promise<void> {
  throw new Error("The setup slider was replaced by - and + steppers")
}

/** Steps one of the two setup rows with real pinches on its - or + button. */
export async function stepRow(pincher: Pincher, row: "Cones" | "Spacing", direction: -1 | 1): Promise<void> {
  await pincher.pinch(`${row}${direction < 0 ? "Minus" : "Plus"}Button`)
  await frames(2)
}

/** Sets the spacing with real pinches on the spacing - and + buttons, one 0.1 m step at a time. */
export async function setSpacingByDrag(pincher: Pincher, targetM: number, onFrame?: (state: SlalomCoachSnapshot) => void): Promise<number> {
  let presses = 0
  while (Math.abs(snap().sliderValueM - targetM) > 0.001 && presses < 12) {
    presses++
    await stepRow(pincher, "Spacing", targetM > snap().sliderValueM ? 1 : -1)
    if (onFrame) {
      onFrame(snap())
    }
  }
  print(`[SLALOM][steps] spacing now ${snap().sliderValueM} wanted ${targetM} after ${presses} press(es)`)
  return presses
}

/** Sets the cone count with real pinches on the cones - and + buttons. */
export async function setCountBySteps(pincher: Pincher, target: number): Promise<number> {
  let presses = 0
  while (snap().coneCount !== target && presses < 12) {
    presses++
    await stepRow(pincher, "Cones", target > snap().coneCount ? 1 : -1)
  }
  print(`[SLALOM][steps] cones now ${snap().coneCount} wanted ${target} after ${presses} press(es)`)
  return presses
}

/** Places the drill with a real Place drill pinch, after a real slider drag when the spacing is not the default 1.0 m. */
export async function placeWithPinches(pincher: Pincher, config?: ScenarioConfig, spacingM: number = 1.0, coneCount: number = 6): Promise<PlacedDrill> {
  const settleMs = parseFloat((config && config.get("settleMs")) || "2000")
  if (Math.abs(spacingM - 1.0) > 0.001) {
    await setSpacingByDrag(pincher, spacingM)
  }
  if (coneCount !== 6) {
    await setCountBySteps(pincher, coneCount)
  }
  await sleep(settleMs)
  await pincher.pinch("PlaceDrillButton")
  await frames(3)
  const state = snap()
  if (state.setupState !== "placed") {
    throw new Error(`Pinching PlaceDrillButton left setupState=${state.setupState} slider=${state.sliderValueM}. See the [SLALOM][trace] lines.`)
  }
  if (state.spacingCm !== Math.round(spacingM * 100)) {
    throw new Error(`Wanted ${spacingM} m but the drill was placed at ${state.spacingCm} cm`)
  }
  const parts = new DrillParts("Drill")
  const stations = measuredConeStations(state, parts)
  const finish = stations[stations.length - 1] + 100
  return {state, parts, stations, sides: state.coneSides, finish, weave: weaveProfile(stations, state.coneSides, finish)}
}

/** Where a point is against the real camera frustum, and how far from the eye. */
export function frustumOf(rig: SkaterRig, point: vec3): string {
  const view = rig.viewOf(point)
  return `screen=(${fmt(view.x)},${fmt(view.y)}) inFrustum=${view.inView} behind=${view.behind} eyeDistance=${fmt(point.distance(rig.actualEye()))}`
}

export async function stepOntoPad(rig: SkaterRig): Promise<void> {
  await rig.walk(-120, 0, 200, () => 0)
  await frames(3)
}
