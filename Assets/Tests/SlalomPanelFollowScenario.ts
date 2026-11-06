/**
 * Setup panel follow. A small head turn must not move the panel. A turn of more than about 30 degrees makes
 * it follow lazily: panelFollowing goes true and its real position changes, then it settles in front again.
 * Nothing is pinched. The turn is made by the camera rig, as a wearer turning their head.
 */

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {Checks, findRequired, fmt, fmtV, frames, hold, SkaterRig, snap, v3, waitForLens} from "./SlalomLeafHarness"

@component
export class SlalomPanelFollowScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const c = new Checks("panel_follow")
    await waitForLens()
    const rig = new SkaterRig(this, config)
    await frames(5)
    const panel = findRequired("SetupPanel").getTransform()
    c.ok("the panel has the follow behaviour", snap().panelHasFollowBehavior)

    const angleOffAxisDeg = (): number => {
      const eye = rig.actualEye()
      const position = panel.getWorldPosition()
      const toPanel = new vec3(position.x - eye.x, 0, position.z - eye.z).normalize()
      const heading = rig.heading()
      return (Math.acos(Math.max(-1, Math.min(1, toPanel.dot(heading)))) * 180) / Math.PI
    }
    const start = panel.getWorldPosition()
    c.info("start", `panel=${fmtV(start)} offAxis=${fmt(angleOffAxisDeg())} deg following=${snap().panelFollowing}`)

    // Small turns.
    for (const turn of [10, 12]) {
      let followingSeen = false
      const before = panel.getWorldPosition()
      rig.turnRight(turn)
      await hold(3, (state) => {
        followingSeen = followingSeen || state.panelFollowing
      })
      const moved = panel.getWorldPosition().distance(before)
      c.ok(`turned ${turn} degrees (${fmt(angleOffAxisDeg())} deg off axis now): panel did not move`, moved < 0.5, `moved=${fmt(moved)} cm`)
      c.ok(`turned ${turn} degrees: panelFollowing never went true`, !followingSeen, `seen=${followingSeen}`)
    }
    c.ok("after 22 degrees in total, still inside the 30 degree dead zone", angleOffAxisDeg() < 30, `offAxis=${fmt(angleOffAxisDeg())}`)

    // A big turn.
    const beforeBig = panel.getWorldPosition()
    rig.turnRight(35)
    const offAxisAfterTurn = angleOffAxisDeg()
    c.ok("a 57 degree total turn puts the panel more than 30 degrees off axis", offAxisAfterTurn > 30, `offAxis=${fmt(offAxisAfterTurn)}`)
    let followingFrames = 0
    let firstFollowAt = -1
    const startedAt = getTime()
    let maxMoved = 0
    await hold(8, (state) => {
      if (state.panelFollowing) {
        followingFrames++
        if (firstFollowAt < 0) {
          firstFollowAt = getTime() - startedAt
        }
      }
      maxMoved = Math.max(maxMoved, panel.getWorldPosition().distance(beforeBig))
    })
    const state = snap()
    c.ok("the panel followed: panelFollowing went true", followingFrames > 0, `followingFrames=${followingFrames} firstAt=${fmt(firstFollowAt)}s`)
    c.ok("the panel followed: its real position changed", maxMoved > 10, `maxMoved=${fmt(maxMoved)} cm`)
    c.ok("the panel stopped following once it arrived", !state.panelFollowing, `following=${state.panelFollowing}`)
    c.between("the panel is back in front, degrees off axis", angleOffAxisDeg(), 0, 15)
    c.between("the panel is again about 60 cm ahead along the floor", new vec3(panel.getWorldPosition().x - rig.actualEye().x, 0, panel.getWorldPosition().z - rig.actualEye().z).length, 55, 65)
    c.between("the panel is again about 25 cm below eye level", state.panelBelowEyeCm, 20, 30)
    c.between("the panel is again slightly to the left, cm", state.panelLeftOfViewCm, 1, 15)
    c.ok("the panel still faces the wearer", v3(state.panelFacing).dot(rig.actualEye().sub(panel.getWorldPosition()).normalize()) > 0.9, "")
    c.info("follow", `lazy: started ${fmt(firstFollowAt)} s after the turn, ${followingFrames} frames of following, moved up to ${fmt(maxMoved)} cm`)
    c.near("rig tracks the camera", rig.trackingErrorCm(), 0, 1)
    c.finish()
  }
}
