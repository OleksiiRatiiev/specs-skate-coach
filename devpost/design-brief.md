---
status: approved
---

# Design brief: Slalom Coach AR

A drill coach for beginner inline skaters learning alone. Pick a drill, lay it on the ground, get short cues at the exact spot where you need them.

## The one spatial moment
I'm on skates in an empty parking lot. Ahead on the ground there are 6 cones 1 m apart and a glowing path weaving between them. As I move through the drill, a 2–3 word cue appears ("Eyes up", "Bend knees") and the next pole to pass glows brighter.

## Why it belongs on glasses
- Uses: draws in the world (cones, path and cues sit on and above the real ground) and leaves your body free (hands free, eyes forward).
- Why it's better than the phone or laptop version: video tutorials are watched standing still, but you need the advice while moving. Glasses keep hands free and eyes forward; a phone can't do that while skating.

## Product or overlay
- Type: product. The virtual drill is the experience.
- What the real version would sense: the ground surface and where the skater is. It doesn't need to recognize any real object.
- Stand-in for the preview: a virtual floor stands in for the parking lot, large enough for the whole drill. Walking with the keyboard stands in for skating.

## Where things live
- Where the user is looking during the main task: forward, 2–3 cones ahead, which is exactly the "Eyes up" habit the drill teaches. Cues never sit on the ground.
- Drill layout: 6 cones in a line, fixed in the world on the floor. Spacing is 1.0 m on Standard and 1.2 m on Easy. Each cone is about 30 cm tall (default).
- Marker poles: one thin glowing pole on each cone, about 1 m tall and about 2 cm thick (default), so the slalom line stays visible without looking down.
- Path line: glowing, on the floor, weaving between the cones. About 10 cm wide (default), swinging about 50 cm to each side of the cone line (default). The correct side alternates, starting with cone 1 on the left (default).
- Start pad: on the floor before cone 1, about 1 m x 1 m (default), centered about 1.5 m before cone 1 (default).
- Finish line: on the floor, about 1 m past cone 6 (default).
- Cue text: one line of 2–3 words, floating above the path about 2–3 m ahead of me, roughly 1.2 m above the floor (a bit below eye level), offset slightly to the side of the path so it never blocks the line I'm skating. World-anchored to the path, not stuck to my head. Letters about 8–10 cm tall, high-contrast and light-colored, no panel behind it.
- Stance card: floats about 1 m in front of the start pad, slightly below eye level, facing the pad and fixed in the world (default). About 40 cm tall (default). A simple figure plus "Knees bent", "Arms forward", "Eyes 2–3 cones ahead", in light colors with no dark background (default).
- Setup panel: small, floating at arm's length, about 55 cm away (default), slightly below eye level. Holds Slalom, the Easy/Standard toggle and "Place here".
- Ghost drill: a faint copy of the whole drill on the floor, with its start pad about 2 m ahead (default for which end), pointing the way I'm facing. Follows as I turn my head until placed.
- Finish card: floats about 70 cm in front of me (default), slightly below eye level, facing me (default). Shows cones cleared next to "Again" and "Move drill".
- Edge arrow: small, at the lower edge of the view. This is the one element that stays attached to the view, and only while it's needed.

## Hands and input
- Choose a size: pinch the Easy or Standard toggle on the setup panel. Slalom is the only drill.
- Place the drill: pinch the big "Place here" button.
- While skating: hands do nothing. No buttons, no gestures.
- Restart mid-session: hands-free. Skating back onto the start pad resets the run.
- At the finish: pinch the big "Again" or "Move drill" button, once I've stopped. "Move drill" brings back the setup panel and ghost (default).
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Setup panel: shows on launch and after "Move drill" (default), hides when "Place here" is pinched.
- Ghost drill: shows when a size is picked, hides when the drill is placed.
- Stance card: shows while I stand on the start pad, before I leave it, including when I walk back onto it (default). Hides when I leave the pad.
- Cues: only one cue is ever on screen. Cues belong to phases of the drill, not to individual cones:
  - Entry (start pad to cone 1): "Eyes up", shows when I leave the start pad (default).
  - Middle (cones 2–4): "Bend knees", shows on reaching cone 2.
  - Exit (cones 5–6): "Arms forward", shows on reaching cone 5.
  - A new cue replaces the old one with a quick fade, stays about 2 s, then fades out. Most of the time there's no text at all.
- Highlighted pole: the pole of the next cone to pass glows brighter, and switches to the following cone once I pass. At any moment I see the path, one highlighted "next" pole, and at most one short cue.
- Passing a cone: a cone counts as passed when I cross the line through it perpendicular to the drill. It's cleared if I'm on its correct side at that moment.
- Missed cone: if I'm on the wrong side at that moment, the cone turns amber and stays amber for the rest of the run. The highlight moves on, so I never have to turn back. No sounds, no red X.
- Drifting off the path: more than about 1.5 m from the path line, the line glows brighter for a moment. If I stay off it for 2 s, the current cue is replaced by "Back to line".
- Finish card: shows when I cross the finish line, with cones cleared (for example "5/6"). This is the only feedback on mistakes, and it comes after I've stopped, not while I'm moving. Hides when a button is pinched or when I walk back onto the start pad (default).
- If something needs attention out of view: a small arrow at the lower edge of the view points toward the highlighted pole whenever it's out of view, and disappears as soon as it's visible again. If I'm more than about 5 m from the drill, the arrow points to the start pad instead. No sounds.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. **Setup:** On launch, a panel appears at arm's length with Slalom and an Easy/Standard toggle. Picking Standard shows a ghost of 6 cones on the floor about 2 m ahead that turns with my view. Clicking "Place here" fixes the drill on the floor and hides the panel.
2. **Correct layout:** The placed drill has 6 cones exactly 1.0 m apart (1.2 m on Easy), each with a glowing pole about 1 m tall, plus a path line weaving between them and a start pad before cone 1.
3. **One cue at a time:** Walking from the start pad through the drill, I see "Eyes up", then "Bend knees" at cone 2, then "Arms forward" at cone 5. Never more than one cue on screen, each fading after about 2 s, and the highlighted pole always moves to the next cone after I pass one.
4. **Recovery:** If I walk straight past a cone without weaving, it turns amber and the highlight moves on. If I turn around so the highlighted pole is out of view, an edge arrow appears pointing to it and disappears when I face it again.
5. **Finish and restart:** Crossing the line after cone 6 shows a card with cones cleared (6/6 on a clean run, 5/6 with one miss) and "Again" / "Move drill" buttons. "Again" resets all cones and highlights cone 1. Walking back onto the start pad resets the run the same way.

## Out of scope
- More than one drill. One drill done well; the Easy/Standard toggle only changes spacing.
- Sensing how the skater moves (knee bend, arm position, speed). Cues are timed by position in the drill, not by watching the skater.
- Detecting the real parking lot or real obstacles. The preview uses a virtual floor.
- Saving progress between sessions.
- Sounds and mid-run scoring.

## Risks and open questions
- Cue distance: cues sit 2–3 m ahead, past the display's comfortable focus distance of about 1 m. Check that they stay readable at a glance. Feel unproven.
- Timing at real speed: walking in the preview is slower than skating, and 1 m cone spacing goes by quickly. Whether a 2 s cue and a per-cone highlight keep up on skates can't be judged in the preview. Feel unproven.
- Narrow view: the whole drill won't fit in view at once, including the ghost during placement. Check that the ghost still makes the direction clear.
- Safety on real skates: virtual content can distract or hide real hazards, and real glasses haven't been tried while skating. Empty lot only. Feel unproven.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
