# Slalom Coach AR

An AR drill coach for beginner roller skaters (quads or inlines), built for **SPECS** glasses with Lens Studio.

**Demo video:** https://youtu.be/QCICwdwm6_k

Video tutorials are watched standing still, but skating happens on the move. Slalom Coach AR puts a virtual slalom drill on the floor and shows short, eyes-up cues right where you need them, so you can practise anywhere without carrying cones.

## Who it's for
Beginner roller skaters who practise alone in an empty lot or a park and want a coach that keeps their eyes up and their hands free.

## What it does
1. **Set up.** A neon strip to the right of the drill sets the cone count (4–12) and spacing (0.8–1.5 m). A ghost of the drill follows your view and updates live. Press **PLACE DRILL**.
2. **Stance check.** Step onto the start pad. A card on the left shows: eyes up, knees bent, arms forward.
3. **Ride.** The next cone's pole glows brighter. One short cue at a time ("Bend knees", "Arms forward") floats beside the path, anchored to its cone, and appears two cones early so you can read it in time.
4. **Mistakes don't interrupt you.** A missed cone turns amber and the highlight moves on. Drift off the line and you get "Back to line". Lose the drill from view and a small arrow at the edge points back to it.
5. **Finish.** A card shows CLEAN RUN, NICE RUN or KEEP PRACTICING, one icon per cone (cyan for cleared, amber for missed), and **AGAIN** / **CHANGE DRILL**. A clean run celebrates in the world: the poles flash in a wave and neon shards rain down.
6. **Change the drill at any time** with the CHANGE DRILL button beside the drill, whenever no run is in progress.

## Designed for glasses
- **Eyes up, not down.** Cues float ahead, at about eye level, never on the ground.
- **One cue at a time.** Most of the time there's no text at all.
- **Hands free while moving.** You only use your hands before the run and after it.
- **Feedback after you stop.** There's no score mid-run.
- **Nothing in the centre of your view.** Controls sit to the side, and the drill stays clear.

The full design brief is in [`devpost/design-brief.md`](devpost/design-brief.md), and the decisions that changed along the way are in [`devpost/design-iterations.md`](devpost/design-iterations.md).

## How it was built
- **Plan:** the `plan-lens` skill from the Learn AR with SPECS skill pack produced the design brief and done criteria (`devpost/`).
- **Build:** CLAD agents in Claude Code, driving Lens Studio through the Lens Studio MCP. A few small layout tweaks were made by hand, as the brief allows.
- **Test:** LEAF scenarios in `Assets/Tests/` cover the done criteria: setup, layout, cues, missed cones, edge arrow, finish, stance card, Back to line and UI states. They run in Lens Studio Preview.

## Run it
1. Open `SpecsRollerSkate.esproj` in Lens Studio 5.23 or later.
2. Open the SPECS Preview and use Interactive Preview: **WASD** to move, **right-drag** to look around, **click** to pinch.
3. Set the cones and spacing, place the drill, step onto the pad and skate (walk) through it.

The Lens doesn't sense the real ground or the skater's pose. It uses an estimated floor height and the wearer's position, so the Preview's virtual floor stands in for the parking lot.

## Project layout
- `Assets/Scripts/`: Lens logic (drill layout, run logic, cues, setup strip, finish card, neon UI, celebration)
- `Assets/Tests/`: LEAF scenarios
- `Assets/Fonts/`: Chakra Petch (SIL Open Font License, see `ChakraPetch-OFL.txt`)
- `devpost/`: design brief and design iterations

## Credits
- Spectacles Interaction Kit and UI Kit by Snap Inc.
- Chakra Petch font by Cadson Demak, SIL OFL 1.1.
- Demo video: stock footage from Pexels (pexels.com/video/14725105) under the Pexels license; AI-generated narration (Google AI Studio); original music and sound effects.

Made for the [Learn AR with SPECS](https://learn-specs.devpost.com/) hackathon on Devpost.
