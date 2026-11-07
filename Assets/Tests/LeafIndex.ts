/**
 * LeafIndex - registers the Slalom Coach LEAF scenarios, one or more per done criterion.
 * Test-only. Remove this and the LeafIndex scene object to take the tests out of the Lens.
 */

import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {SlalomC1PanelLaunchScenario} from "./SlalomC1PanelLaunchScenario"
import {SlalomC1PlaceAtDefaultPoseScenario} from "./SlalomC1PlaceAtDefaultPoseScenario"
import {SlalomC1SliderDragScenario} from "./SlalomC1SliderDragScenario"
import {SlalomC2LayoutScenario} from "./SlalomC2LayoutScenario"
import {SlalomC3CuesScenario} from "./SlalomC3CuesScenario"
import {SlalomC4EdgeArrowScenario} from "./SlalomC4EdgeArrowScenario"
import {SlalomC4MissedConesScenario} from "./SlalomC4MissedConesScenario"
import {SlalomC5FinishScenario} from "./SlalomC5FinishScenario"
import {SlalomNegativeControlScenario} from "./SlalomNegativeControlScenario"
import {SlalomBackToLineScenario} from "./SlalomBackToLineScenario"
import {SlalomPanelFollowScenario} from "./SlalomPanelFollowScenario"
import {SlalomStanceCardScenario} from "./SlalomStanceCardScenario"
import {SlalomUiStatesScenario} from "./SlalomUiStatesScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1_panel_launch", typename: SlalomC1PanelLaunchScenario.getTypeName(), parameters: {pinch: "ik", lookDownDeg: "0"}},
    {id: "c1_panel_launch_tilted_5deg", typename: SlalomC1PanelLaunchScenario.getTypeName(), parameters: {pinch: "ik", lookDownDeg: "5"}},
    {id: "c2_layout_0_8", typename: SlalomC2LayoutScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", spacing: "0.8"}},
    {id: "c2_layout_1_0", typename: SlalomC2LayoutScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", spacing: "1.0"}},
    {id: "c2_layout_1_2", typename: SlalomC2LayoutScenario.getTypeName(), parameters: {pinch: "sik", lookDownDeg: "5", spacing: "1.2"}},
    {id: "c2_layout_1_5", typename: SlalomC2LayoutScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", spacing: "1.5"}},
    {id: "c2_layout_4_cones", typename: SlalomC2LayoutScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", spacing: "1.0", cones: "4"}},
    {id: "c2_layout_12_cones", typename: SlalomC2LayoutScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", spacing: "0.8", cones: "12"}},
    {id: "c3_cues_12_cones", typename: SlalomC3CuesScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", speed: "200", cones: "12"}},
    {id: "c3_cues_4_cones", typename: SlalomC3CuesScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", speed: "200", cones: "4"}},
    {id: "c1_steppers", typename: SlalomC1SliderDragScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", lookDownDeg: "5", middle: "false"}},
    {id: "c1_steppers_sik", typename: SlalomC1SliderDragScenario.getTypeName(), parameters: {pinch: "sik", lookDownDeg: "5"}},
    {id: "c1_place_tilted_5deg", typename: SlalomC1PlaceAtDefaultPoseScenario.getTypeName(), parameters: {pinch: "ik", placeHand: "right", lookDownDeg: "5", timeoutMs: "15000"}},
    {id: "c1_place_default_pose", typename: SlalomC1PlaceAtDefaultPoseScenario.getTypeName(), parameters: {pinch: "ik", placeHand: "right", lookDownDeg: "0", timeoutMs: "15000"}},
    {id: "c3_cues_slow", typename: SlalomC3CuesScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", speed: "60"}},
    {id: "c3_cues_fast", typename: SlalomC3CuesScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", speed: "200"}},
    {id: "c4_missed_cones", typename: SlalomC4MissedConesScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5"}},
    {id: "c4_edge_arrow", typename: SlalomC4EdgeArrowScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", holdMs: "0"}},
    {id: "c5_clean_again", typename: SlalomC5FinishScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", cardPitchDeg: "0", flow: "clean_again"}},
    {id: "c5_clean_again_sik", typename: SlalomC5FinishScenario.getTypeName(), parameters: {pinch: "sik", lookDownDeg: "5", cardPitchDeg: "0", flow: "clean_again"}},
    {id: "c5_miss_pad_reset", typename: SlalomC5FinishScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", cardPitchDeg: "0", flow: "miss_pad"}},
    {id: "c5_move_drill", typename: SlalomC5FinishScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", cardPitchDeg: "0", flow: "move_drill", movedSpacing: "1.5"}},
    {id: "c5_move_drill_sik", typename: SlalomC5FinishScenario.getTypeName(), parameters: {pinch: "sik", lookDownDeg: "5", cardPitchDeg: "0", flow: "move_drill", movedSpacing: "1.5"}},
    {id: "stance_card", typename: SlalomStanceCardScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5"}},
    {id: "back_to_line_no_cue", typename: SlalomBackToLineScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", mode: "no_cue"}},
    {id: "back_to_line_with_cue", typename: SlalomBackToLineScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", mode: "with_cue"}},
    {id: "back_to_line_return_early", typename: SlalomBackToLineScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", mode: "return_early"}},
    {id: "back_to_line_band", typename: SlalomBackToLineScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5", mode: "band"}},
    {id: "panel_follow", typename: SlalomPanelFollowScenario.getTypeName(), parameters: {pinch: "ik", lookDownDeg: "5"}},
    {id: "ui_states", typename: SlalomUiStatesScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5"}},
    {id: "negative_control_must_fail", typename: SlalomNegativeControlScenario.getTypeName(), parameters: {pinch: "ik", hand: "right", placeHand: "right", lookDownDeg: "5"}},
  ]
}
