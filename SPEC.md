# SPEC — Invaders

## Objective

A complete arcade game in one page: a ship at the bottom, five rows of aliens
descending, bullets in both directions, three lives and a persistent high
score. Everything is drawn with code on a single `<canvas>`; there are no
images, fonts, or libraries to load.

Challenge 2 of codebar's opencode AI workshop.

## Stack

- HTML, CSS, vanilla JavaScript.
- One `<canvas>`, 800×600 logical pixels, scaled by CSS and rendered at device
  pixel ratio (capped at 2×).
- Three source files: `index.html`, `styles.css`, `game.js`.
- No dependencies, no build step, no external sprites or audio files.
- Runs from any static server: `npx serve .`.

## States

| State | Behaviour |
| --- | --- |
| `intro` | Title, high score, blinking "press space to start", controls |
| `playing` | HUD, aliens, player, bullets, particles |
| `gameover` | Dimmed field, final score, high score, blinking retry |

`Space` starts a run from `intro`, and retries from `gameover` after a 0.8s
guard so the shot that killed you cannot restart the game instantly.

## Mechanics

- **Player** 48×24 at the bottom, moves with `←` / `→` at 430 px/s, clamped
  14px inside the field. Drawn as a 12×6 pixel bitmap.
- **Shooting** `Space`, held or tapped, fires at most one bullet every 220ms.
  Player bullets travel upward at 640 px/s.
- **Aliens** 5 rows × 8 columns, 44×32 each, starting 78px from the top.
  The formation moves as a block, reverses on contact with either side wall,
  and drops 22px on every reversal.
- **Speed** starts at 36 px/s and multiplies by 1.1 per wave. It also ramps up
  to 2.4× as the formation is thinned out.
- **Alien fire** a random living alien fires every 0.55–1.25s, scaled down by
  wave, to a maximum of 6 bullets on screen. Speed is 210 + 18×wave px/s.
- **Collisions** AABB in both directions. A player bullet destroys one alien.
  An alien bullet costs one life.
- **Lives** three. On a hit the player is invulnerable for 1.2s and blinks.
  Enemy bullets are cleared on impact.
- **Losing** at zero lives, or if any alien reaches the player's row.

## Controls

| Input | Action |
| --- | --- |
| `←` / `→` | Move |
| `Space` | Shoot; hold to repeat at the 220ms cooldown |
| `P` / `Esc` | Pause or resume |
| Click or tap the canvas | Start, retry, or resume from pause |
| On-screen pad | `◀` `▶` `SHOOT`, plus a pause/resume button |

## Pause

- `P`, `Esc`, the pad button, or a tap on the canvas resumes a paused game.
- Pausing freezes the whole simulation: aliens, bullets, fire timers, particles.
  The overlay keeps the score and wave visible.
- Hiding the tab auto-pauses a running game, so a phone call does not cost a life.
- The button swaps to a play icon and reads "Resume" while paused.

The pad writes to the same `game.keys` set as the keyboard, so every input path
drives one simulation. On touch devices the keyboard hint is hidden and the
intro reads `TAP TO START`.

## Scoring

| Row (top to bottom) | Points |
| --- | --- |
| 1 | 50 |
| 2 | 40 |
| 3 | 30 |
| 4 | 20 |
| 5 | 10 |

Clearing the formation advances to the next wave with no bonus. Score and wave
survive waves, not runs.

## Game feel

- 4px screen shake on a kill, 11px on a hit.
- 9-particle burst per alien, 16 on the player, with gravity and fade.
- White flash on player damage, decaying over ~0.4s.
- WebAudio only, generated at runtime: square-wave pew, triangle + noise pop,
  filtered noise + sine for damage, three-note arpeggio on wave clear.
- Audio context is created on the first key press, per browser autoplay rules.
- CRT scanlines drawn as 1px black rows every 4px.

## Visual design

- Background `#0E1116`, ship `#84B59F`, aliens `#69A297` and `#50808E`,
  text `#E6EEE9`.
- Monospaced type, sharp pixel edges, no gradients, no images.
- Aliens animate between two bitmaps, faster as the wave thins.
- Canvas keeps a 4:3 aspect ratio at any window size, capped at 900px wide.

## Acceptance criteria

- [x] Starts, plays with the keyboard, ends at zero lives.
- [x] Playable on a phone with the on-screen pad.
- [x] Score and high score on screen; high score persists across reloads.
- [x] Collisions work both ways (bullet→alien and bullet→ship).
- [x] Difficulty increases each wave and as the formation thins.
- [x] Enemy fire is limited and dodgeable.
- [x] No external sprites: every pixel is drawn by code.
- [x] `SPEC.md` and `AGENTS.md` are present.
