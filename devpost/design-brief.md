---
status: approved
---

# Design brief: Slalom Coach AR

A drill coach for beginner roller skaters (quads or inlines) learning alone. Pick a drill, lay it on the ground, get short cues at the exact spot where you need them.

## The one spatial moment
I'm on skates in an empty parking lot. Ahead on the ground there are 6 cones (4–12, your choice) 1 m apart and a glowing path weaving between them. As I move through the drill, a 2–3 word cue appears above a cone ("Bend knees", "Arms forward") and the next pole to pass glows brighter.

## Why it belongs on glasses
- Uses: draws in the world (cones, path and cues sit on and above the real ground) and leaves your body free (hands free, eyes forward).
- Why it's better than the phone or laptop version: video tutorials are watched standing still, but you need the advice while moving. Glasses keep hands free and eyes forward; a phone can't do that while skating.

## Product or overlay
- Type: product. The virtual drill is the experience.
- What the real version would sense: the ground surface and where the skater is. It doesn't need to recognize any real object.
- Stand-in for the preview: a virtual floor stands in for the parking lot, large enough for the whole drill. Walking with the keyboard stands in for skating.

## Where things live
- Where the user is looking during the main task: forward, 2–3 cones ahead, which is exactly the eyes-up habit the drill teaches. Cues never sit on the ground.
- Drill layout: 4–12 cones (6 by default) in a line, fixed in the world on the floor. Count and spacing are set on the setup strip. Spacing is 0.8–1.5 m in 0.1 m steps, 1.0 m by default. Each cone is about 30 cm tall (default).
- Marker poles: one thin glowing pole on each cone, about 1 m tall and about 2 cm thick (default), so the slalom line stays visible without looking down. The highlighted "next" pole is clearly brighter and thicker than the others (about twice as thick, so about 4 cm).
- Path line: glowing, on the floor, weaving between the cones. About 10 cm wide (default), swinging about 50 cm to each side of the cone line (default). The correct side alternates, starting with cone 1 on the left (default).
- Start pad: on the floor before cone 1, about 1 m x 1 m (default), centered about 1.5 m before cone 1 (default).
- Finish line: a wide, bright band on the floor, about 1 m past cone 6 (default). About 30 cm deep and as wide as the start pad (about 1 m).
- Cue text: one line of 2–3 words, anchored to a cone: it floats above that cone, about 1.3 m above the floor (a bit below eye level), about 50 cm to the side of the path so it never blocks the line I'm skating. World-anchored, not stuck to my head. Letters about 8–10 cm tall, plain bold neon cyan (#3FF0FF) in Chakra Petch Bold, no panel behind it, no glitch or flicker.
- Stance card: compact (about 22 cm wide) in the neon HUD style (Chakra Petch, cyan chamfered outline, light fill), off the drill: about 70 cm to the left of the start pad's center, about 1.2 m above the floor, facing the pad and fixed in the world. No icon. Three uppercase lines: "EYES UP", "KNEES BENT", "ARMS FORWARD". No dark background.
- Setup strip: replaces the old floating setup card (no title, hint, slider, container, lazy follow or grab bar). A compact strip anchored to the ghost's start pad, on the right side of the drill: centered about 60 cm right of the pad's center, level with the pad's near edge, about 1.1 m above the floor (slightly below eye level), turned to face me and tilted back about 15° from vertical. It sits right of the path line and never overlaps the cones. It stays inside the glasses' view when I look at the drill; if it would fall outside, it moves closer to the path instead of shrinking. Scaled up 15% from its first size. It moves with the ghost. Rows, top to bottom:
  - Row 1: "−", the cone count (4–12, default 6) with a "CONES" label, "+".
  - Row 2: "−", the spacing value (0.8–1.5 m in 0.1 m steps, default 1.0 m) with a "CONE SPACING" label, "+".
  - Below the rows, a wide cyan "PLACE DRILL" button with a slow glow pulse.
  - Values are about 5 cm tall. Every button is at least 6 cm, with hover and pressed states, and works with far-field pinch and with mouse clicks. The ghost updates live on every press.
  - After placing, the strip hides and "STEP ONTO THE PAD" shows above the pad until I step on it.
- Ghost drill: a faint copy of the whole drill on the floor, using the strip's current count and spacing, with its start pad about 2 m ahead (default for which end), pointing the way I'm facing. Follows as I turn my head until placed. Updates live while I press the strip's buttons.
- Finish card: floats about 70 cm in front of me (default), slightly below eye level, facing me (default). Top to bottom: a small "RUN COMPLETE" label; the headline "CLEAN RUN" (all cones cleared) or "NICE RUN"; one cone icon per cone in order (cyan cleared, amber missed); a line with the real numbers ("6/6 cones · eyes up all the way" or "5/6 cones · cone 4 is marked on the drill"); then "AGAIN" (primary, cyan, restart icon) and "CHANGE DRILL" (white outline).
- Change-drill button: a small neon "CHANGE DRILL" button at the same right-side spot as the strip (about 60 cm right of the placed pad's center, level with its near edge, about 1.1 m above the floor, tilted back about 15°). Visible whenever a run isn't in progress (after placing, while on the pad, after the finish) and hidden while running.
- Edge arrow: small, at the lower edge of the view. This is the one element that stays attached to the view, and only while it's needed.

## Hands and input
- Choose the drill: pinch the − and + buttons on the strip for the cone count (4–12) and the spacing (0.8–1.5 m, 0.1 m steps). Slalom is the only drill.
- The strip rides on the ghost's start pad, so turning moves it with the ghost. Nothing to grab.
- Place the drill: pinch the big "PLACE DRILL" button.
- While skating: hands do nothing. No buttons, no gestures.
- Restart mid-session: hands-free. Skating back onto the start pad resets the run.
- At the finish: pinch the big "AGAIN" or "CHANGE DRILL" button, once I've stopped. "CHANGE DRILL" brings back the ghost and the strip with the last values.
- Change the drill at any time except mid-run: pinch the small "CHANGE DRILL" button at the pad's near edge. It brings back the ghost and the strip with the last values.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Setup strip: shows on launch and after "CHANGE DRILL" (default), hides when "PLACE DRILL" is pinched. After "CHANGE DRILL" the count and spacing keep their last values. After placing, "STEP ONTO THE PAD" shows above the pad until I step on it.
- Ghost drill: shows with the strip (from launch, at the strip's values), follows my view, and hides when the drill is placed.
- Stance card: shows while I stand on the start pad, before I leave it, including when I walk back onto it (default). Hides when I leave the pad. The "EYES UP" reminder lives here, not in the ride.
- Cues: only one cue is ever on screen. Cues are anchored to cones, by position in the drill (N = cone count, cone numbers start at 1):
  - "Bend knees" floats above cone ⌈N/2⌉+1; "Arms forward" floats above cone N.
  - Each becomes visible when I'm 2 cones before its cone (i.e. once I've passed the cone two before it) and hides once I pass its own cone. A newer cue replaces an older one.
  - With 6 cones: "Bend knees" above cone 4 (appears after cone 2), "Arms forward" above cone 6 (appears after cone 4).
  - There is no cue near the start; "Eyes up" lives on the stance card. Most of the time there's no text at all.
- Highlighted pole: the pole of the next cone to pass glows brighter and is thicker, and switches to the following cone once I pass. At any moment I see the path, one highlighted "next" pole, and at most one short cue.
- Passing a cone: a cone counts as passed when I cross the line through it perpendicular to the drill. It's cleared if I'm on its correct side at that moment.
- Missed cone: if I'm on the wrong side at that moment, the cone turns amber and stays amber for the rest of the run. The highlight moves on, so I never have to turn back. No sounds, no red X.
- Drifting off the path: more than about 1.5 m from the path line, the line glows brighter for a moment. If I stay off it for 2 s, the current cue is replaced by "Back to line".
- Finish card: shows when I cross the finish line, with the headline, one icon per cone and the real-numbers line. This is the only feedback on mistakes, and it comes after I've stopped, not while I'm moving. Hides when a button is pinched or when I walk back onto the start pad (default).
- Clean-run celebration (all cones cleared, and only then): the card frame turns magenta (#FF3DF0), the headline glitches briefly every few seconds, the poles flash in a wave from the first cone to the last, and neon shards (cyan, magenta, white, amber) burst above the finish band and keep falling for about 5 s, then fade out over about 1 s. World-anchored, no sound. With misses there is no celebration; the missed cones pulse amber once.
- If something needs attention out of view: a small arrow at the lower edge of the view points toward the highlighted pole whenever it's out of view, and disappears as soon as it's visible again. If I'm more than about 5 m from the drill, the arrow points to the start pad instead. No sounds.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. **Setup:** On launch, a compact strip sits to the right of the ghost's start pad (about 60 cm right of its center, level with the near edge, about 1.1 m above the floor, tilted back about 15°, scaled up 15%, inside the view and clear of the path and cones) with two rows, "−" / value / "+" for cones (default 6, range 4–12) and for cone spacing (default 1.0 m, range 0.8–1.5 m in 0.1 m steps), and a "PLACE DRILL" button. A ghost drill is on the floor about 2 m ahead and turns with my view, the strip moving with it. Pressing the steppers changes the values within their ranges and the ghost updates live. Clicking "PLACE DRILL" fixes the drill on the floor, hides the strip and ghost, and shows "STEP ONTO THE PAD" above the pad.
2. **Correct layout:** The placed drill has the chosen number of cones (6 by default, 4–12) exactly as far apart as the strip said (1.0 m by default, any value from 0.8 to 1.5 m), each with a glowing pole about 1 m tall (the next one brighter and thicker), plus a path line weaving between them, a start pad before cone 1 and a wide, bright finish band.
3. **One cue at a time:** Walking from the start pad through the drill, I see no cue near the start, then "Bend knees" above cone ⌈N/2⌉+1 and "Arms forward" above cone N (N cones), each appearing when I'm 2 cones before it and hiding once I pass it. Never more than one cue on screen, and the highlighted pole always moves to the next cone after I pass one.
4. **Recovery:** If I walk straight past a cone without weaving, it turns amber and the highlight moves on. If I turn around so the highlighted pole is out of view, an edge arrow appears pointing to it and disappears when I face it again.
5. **Finish and restart:** Crossing the line after the last cone shows a card with "RUN COMPLETE", "CLEAN RUN" or "NICE RUN", one cone icon per cone (cyan cleared, amber missed), the real-numbers line, and "AGAIN" / "CHANGE DRILL" buttons. A clean run celebrates (magenta frame, glitching headline, pole wave, shards that fall for about 5 s then fade over about 1 s); a run with misses doesn't, and its missed cones pulse amber once. "AGAIN" resets all cones and highlights cone 1. "CHANGE DRILL" brings back the ghost and strip with the last values; a small "CHANGE DRILL" button at the same right-side spot as the strip does the same whenever no run is in progress. Walking back onto the start pad resets the run the same way.

## Out of scope
- More than one drill. One drill done well; the strip only changes count and spacing.
- Sensing how the skater moves (knee bend, arm position, speed). Cues are timed by position in the drill, not by watching the skater.
- Detecting the real parking lot or real obstacles. The preview uses a virtual floor.
- Saving progress between sessions.
- Sounds and mid-run scoring.
- Sensing whether the skater really kept their eyes up. "Eyes up all the way" on a clean run is a fixed message, not a measurement.

## Risks and open questions
- Cue distance: cues sit 2–3 m ahead, past the display's comfortable focus distance of about 1 m. Check that they stay readable at a glance. Feel unproven.
- Timing at real speed: walking in the preview is slower than skating, and 1 m cone spacing goes by quickly. Whether a 2 s cue and a per-cone highlight keep up on skates can't be judged in the preview. Feel unproven.
- Narrow view: the whole drill won't fit in view at once, including the ghost during placement. Check that the ghost still makes the direction clear.
- Safety on real skates: virtual content can distract or hide real hazards, and real glasses haven't been tried while skating. Empty lot only. Feel unproven.

## Style (all UI)
Neon cyan (#3FF0FF) thin outlines with a soft glow, chamfered corners, HUD corner brackets on cards, light fills only (no dark colors). Chakra Petch from `Assets/Fonts`: Bold for headlines and values, SemiBold for buttons, Medium for small labels. Uppercase labels with letter spacing. Cyan for guidance and actions, amber (#FFB020) for mistakes, magenta (#FF3DF0) only for the celebration. In-ride cues stay plain bold cyan.

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
