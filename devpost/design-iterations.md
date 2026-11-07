# Design iterations: what changed and why

The brief from `plan-lens` was the starting point. Testing in Preview, and thinking about the glasses' narrow view, changed these decisions.

| # | First version | What changed | Why |
|---|---|---|---|
| 1 | A cue placed at each cone, on the ground | Cues float 2–3 m ahead, at about eye level, beside the path | With your eyes up, as the drill teaches, the ground right in front of your skates is outside the narrow view. |
| 2 | A cue at every cone | One cue per phase of the drill, so there's mostly no text | With cones 1 m apart, several cues competed for the same glance. |
| 3 | A cue appears at its cone | A cue appears 2 cones early and is anchored above its cone | A cue that pops up at the cone is gone before you can read it. |
| 4 | "Eyes up" as an in-ride cue at cone 1 | Moved to the stance card on the start pad | The first cue landed before the run had really started. |
| 5 | A tall floating setup card in the centre, with an Easy/Standard toggle and later a slider | A compact neon strip to the right of the drill, with −/+ steppers for cone count and spacing | The card worked like a floating website: it blocked the drill, its text didn't read, and a slider is hard to pinch precisely. |
| 6 | The setup strip low on the pad | Beside the drill, slightly below eye level, placed from the real view width | Looking 35–40° down is uncomfortable. A fixed side offset fell outside the narrow view or covered the cones. |
| 7 | Change the drill only from the finish card | A CHANGE DRILL button beside the drill whenever no run is in progress | Once placed, there was no way to fix the setup before riding. |
| 8 | A large finish card listing every missed cone | A compact card with tiered headlines and one icon per cone | It filled most of the view, and long text overflowed at 10–12 cones. |
| 9 | Celebration shards burst from the finish band | Neon rain falls in front of you for about 5 s | You've just crossed the finish band, so it's behind you and out of view. |
| 10 | The skateboard icon on the stance card | Removed; three short lines instead | Wrong sport. |
| 11 | "Inline skaters" | "Roller skaters (quads or inlines)" | Slalom drills work on both. |

## What I learned
- **The field of view is the design constraint.** Almost every fix came from asking what is actually in view at that moment: with eyes up, while moving, while standing on the pad.
- **Show, don't sense.** The Lens can't see your knees or arms, so it teaches the right stance instead of pretending to judge it. That keeps it honest and buildable.
- **Progressive disclosure matters more on glasses.** Fewer, earlier, shorter cues beat complete ones.
- **Agents build fast; done criteria keep them honest.** Precise numbers in the brief (centimetres, degrees, seconds) gave CLAD and the LEAF tests something concrete to aim at.
