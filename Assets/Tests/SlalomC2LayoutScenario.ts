/**
 * Criterion 2, Correct layout. The spacing is set with a REAL slider drag (0.8 and 1.5 by over-dragging to
 * the clamp, anything else by a closed-loop drag), the drill is placed with a REAL Place drill pinch, and
 * everything is then measured from real transforms, mesh vertices and material colours, not from the
 * configured values. Parameter "spacing" is in metres.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {
  boundsOf,
  Checks,
  colorOf,
  CONE_COUNT,
  findRequired,
  fmt,
  fmtV,
  frames,
  luminance,
  meshExtents,
  Pincher,
  placeWithPinches,
  SkaterRig,
  snap,
  v3,
  visualOf,
  waitForLens,
} from "./SlalomLeafHarness"

@component
export class SlalomC2LayoutScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const spacing = parseFloat((config && config.get("spacing")) || "1.0")
    const cm = Math.round(spacing * 100)
    const c = new Checks(`c2_layout_${spacing}`)
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    const pincher = new Pincher(config)
    c.info("pinch mode", `${pincher.mode} spacing wanted=${spacing}`)

    const placed = await placeWithPinches(pincher, config, spacing)
    await frames(5)
    const state = snap()
    const parts = placed.parts
    const pad = v3(state.padCentre)
    const forward = v3(state.drillForward)
    const right = v3(state.drillRight)
    const station = (p: vec3): number => p.sub(pad).dot(forward)
    const lateral = (p: vec3): number => p.sub(pad).dot(right)

    c.ok("placed with the slider's value", state.setupState === "placed" && state.sliderValueM === spacing && state.spacingCm === cm, `state=${state.setupState} slider=${state.sliderValueM} spacing=${state.spacingCm}`)
    c.near("basis: right is forward x up", forward.cross(vec3.up()).distance(right), 0, 0.001)

    // Six cones, exactly the slider's distance apart.
    for (let i = 0; i < CONE_COUNT; i++) {
      c.ok(`cone ${i + 1} enabled`, parts.cone(i).isEnabledInHierarchy)
    }
    c.ok("no seventh cone", !this.hasPart(parts.root, "Cone_7"))
    for (let i = 1; i < CONE_COUNT; i++) {
      c.near(`cones ${i} to ${i + 1}: real transform spacing, cm`, parts.cone(i).getTransform().getWorldPosition().distance(parts.cone(i - 1).getTransform().getWorldPosition()), cm, 0.01)
      c.near(`cones ${i} to ${i + 1}: rendered bounds spacing, cm`, boundsOf(parts.cone(i)).centre.distance(boundsOf(parts.cone(i - 1)).centre), cm, 0.05)
    }
    for (let i = 0; i < CONE_COUNT; i++) {
      c.near(`cone ${i + 1} on the drill's centre line, cm`, lateral(parts.cone(i).getTransform().getWorldPosition()), 0, 0.05)
      c.near(`cone ${i + 1} is ${150 + i * cm} cm past the pad centre`, station(parts.cone(i).getTransform().getWorldPosition()), 150 + i * cm, 0.05)
    }

    // Cone and pole sizes from the vertices.
    const next = parts.nextPoles()
    c.ok("only cone 1's thick PoleNext shows", JSON.stringify(next) === "[0]", `next=[${next}]`)
    c.ok("cone 1's thin Pole is switched off, the others' are on", !parts.pole(0).enabled && [1, 2, 3, 4, 5].every((i) => parts.pole(i).enabled))
    for (let i = 0; i < CONE_COUNT; i++) {
      const cone = meshExtents(parts.cone(i))
      const thin = meshExtents(parts.pole(i))
      const thick = meshExtents(parts.poleNext(i))
      c.near(`cone ${i + 1} height, cm`, cone.size.y, 30, 1)
      c.near(`cone ${i + 1} stands on the floor`, boundsOf(parts.cone(i)).min.y, state.floorY, 1)
      c.near(`pole ${i + 1} height, cm`, thin.size.y, 100, 1)
      c.near(`pole ${i + 1} thickness, cm`, Math.max(thin.size.x, thin.size.z), 2, 0.1)
      c.near(`PoleNext ${i + 1} height, cm`, thick.size.y, 100, 1)
      c.near(`PoleNext ${i + 1} thickness, cm (twice the other poles)`, Math.max(thick.size.x, thick.size.z), 4, 0.1)
      c.near(`pole ${i + 1} stands on the floor`, boundsOf(parts.pole(i)).min.y, state.floorY, 1)
      c.near(`pole ${i + 1} is on its cone`, new vec3(boundsOf(parts.pole(i)).centre.x - boundsOf(parts.cone(i)).centre.x, 0, boundsOf(parts.pole(i)).centre.z - boundsOf(parts.cone(i)).centre.z).length, 0, 0.5)
    }
    c.near("snapshot: highlighted pole thickness matches the real mesh", state.highlightedPoleThicknessCm, Math.max(meshExtents(parts.poleNext(0)).size.x, meshExtents(parts.poleNext(0)).size.z), 0.1)
    c.near("snapshot: other pole thickness matches the real mesh", state.otherPoleThicknessCm, Math.max(meshExtents(parts.pole(1)).size.x, meshExtents(parts.pole(1)).size.z), 0.1)

    // Colours: the next pole is clearly brighter than the rest, and every pole glows (opaque, not dark).
    const nextColour = colorOf(parts.poleNext(0))
    const thinColour = colorOf(parts.pole(1))
    c.info("pole colours", `next=(${fmt(nextColour.x)},${fmt(nextColour.y)},${fmt(nextColour.z)},${fmt(nextColour.w)}) lum=${fmt(luminance(nextColour))} thin=(${fmt(thinColour.x)},${fmt(thinColour.y)},${fmt(thinColour.z)},${fmt(thinColour.w)}) lum=${fmt(luminance(thinColour))}`)
    for (let i = 1; i < CONE_COUNT; i++) {
      c.ok(`pole 1's PoleNext is brighter than pole ${i + 1} by at least 0.3 luminance`, luminance(nextColour) - luminance(colorOf(parts.pole(i))) >= 0.3, `next=${fmt(luminance(nextColour))} other=${fmt(luminance(colorOf(parts.pole(i))))}`)
    }
    c.ok("the brightest visible pole is cone 1's", parts.brightestPole() === 0, `brightest=${parts.brightestPole()}`)
    c.ok("every pole is opaque and not dark", [0, 1, 2, 3, 4, 5].every((i) => colorOf(parts.visiblePole(i)).w >= 0.99 && luminance(colorOf(parts.visiblePole(i))) > 0.3), "")
    c.ok("cone 1 has a glow halo, and only cone 1", JSON.stringify(parts.litHalos()) === "[0]", `halos=[${parts.litHalos()}]`)

    // Start pad: from the vertices, in the drill's own axes.
    const padExtents = meshExtents(parts.part("StartPad"))
    c.ok("start pad enabled", parts.part("StartPad").isEnabledInHierarchy)
    c.near("start pad width, cm", padExtents.size.x, 100, 1)
    c.near("start pad depth, cm", padExtents.size.z, 100, 1)
    c.near("start pad on the floor", boundsOf(parts.part("StartPad")).min.y, state.floorY, 1.5)
    c.near("start pad centre is 150 cm before cone 1", station(parts.cone(0).getTransform().getWorldPosition()) - station(boundsOf(parts.part("StartPad")).centre), 150, 1)

    // Path line from its vertices.
    const pathObject = parts.part("PathLine")
    c.ok("path line enabled", pathObject.isEnabledInHierarchy)
    const pathColour = colorOf(pathObject)
    c.ok("path line is not dark", luminance(pathColour) > 0.3, `lum=${fmt(luminance(pathColour))}`)
    const samples = this.pathSamples(pathObject)
    c.ok("path line has vertices", samples.length > 40, `vertexPairs=${samples.length}`)
    if (samples.length > 0) {
      const widths = samples.map((sample) => sample.width)
      c.near("path line width, cm (mean)", widths.reduce((a, b) => a + b, 0) / widths.length, 10, 0.5)
      c.near("path ends at the finish band's centre", samples[samples.length - 1].s, placed.stations[CONE_COUNT - 1] + 100, 5)
      for (let i = 0; i < CONE_COUNT; i++) {
        let nearest = samples[0]
        for (const sample of samples) {
          if (Math.abs(sample.s - placed.stations[i]) < Math.abs(nearest.s - placed.stations[i])) {
            nearest = sample
          }
        }
        const side = i % 2 === 0 ? -1 : 1
        c.near(`path at cone ${i + 1} swings 50 cm to the ${side < 0 ? "left" : "right"}`, nearest.t, side * 50, 5)
      }
    }
    c.ok("correct sides alternate, starting left", JSON.stringify(state.coneSides) === "[-1,1,-1,1,-1,1]", JSON.stringify(state.coneSides))

    // Finish band: wide, bright and about 1 m past cone 6, brighter than the path.
    const band = parts.part("FinishBand")
    const bandExtents = meshExtents(band)
    c.ok("finish band enabled", band.isEnabledInHierarchy)
    c.ok("finish band glow enabled", parts.part("FinishBandGlow").isEnabledInHierarchy)
    c.near("finish band width, cm (as wide as the pad)", bandExtents.size.x, 100, 3)
    c.near("finish band depth, cm", bandExtents.size.z, 30, 3)
    c.near("finish band is 100 cm past cone 6", station(boundsOf(band).centre) - placed.stations[CONE_COUNT - 1], 100, 3)
    c.near("finish band on the floor", boundsOf(band).min.y, state.floorY, 2)
    const bandColour = colorOf(band)
    c.ok("finish band is opaque and brighter than the path line", bandColour.w >= 0.99 && luminance(bandColour) > luminance(pathColour) + 0.1, `band=${fmt(luminance(bandColour))} path=${fmt(luminance(pathColour))}`)
    c.near("snapshot: finish band width matches the real mesh", state.finishBandWidthCm, bandExtents.size.x, 3)
    c.near("snapshot: finish band depth matches the real mesh", state.finishBandDepthCm, bandExtents.size.z, 3)
    c.info("measured", `pad=${fmtV(pad)} stations=[${placed.stations.map(fmt)}] floorY=${fmt(state.floorY)} cone1=${fmtV(meshExtents(parts.cone(0)).size)} pole1=${fmtV(meshExtents(parts.pole(0)).size)} next1=${fmtV(meshExtents(parts.poleNext(0)).size)} band=${fmtV(bandExtents.size)}`)
    c.finish()
    void rig
  }

  private hasPart(root: SceneObject, name: string): boolean {
    if (root.name === name) {
      return true
    }
    for (let i = 0; i < root.getChildrenCount(); i++) {
      if (this.hasPart(root.getChild(i), name)) {
        return true
      }
    }
    return false
  }

  /** Reads the ribbon's vertices. Mesh local space is the drill's: x is right, -z is along the drill. */
  private pathSamples(pathObject: SceneObject): {s: number; t: number; width: number}[] {
    const positions = visualOf(pathObject).mesh.extractVerticesForAttribute("position")
    const samples: {s: number; t: number; width: number}[] = []
    for (let i = 0; i + 5 < positions.length; i += 6) {
      const ax = positions[i]
      const az = positions[i + 2]
      const bx = positions[i + 3]
      const bz = positions[i + 5]
      samples.push({s: -(az + bz) / 2, t: (ax + bx) / 2, width: Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz))})
    }
    return samples.sort((a, b) => a.s - b.s)
  }
}
