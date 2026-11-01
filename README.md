# Invaders

Challenge 2 from [codebar's opencode AI workshop](https://github.com/codebar/ai-workshop-opencode):
a complete arcade game in one page, with no assets and no dependencies.

## Run it

```bash
npx serve .
```

Open the printed URL, then press **Space**.

## Controls

| Key | Action |
| --- | --- |
| `←` `→` | Move |
| `Space` | Fire (max one shot every 220ms) |

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Canvas and page shell |
| `styles.css` | Responsive 4:3 frame, palette, hints |
| `game.js` | Simulation, rendering, audio, input |
| `SPEC.md` | Mechanics, scoring, acceptance criteria |
| `AGENTS.md` | Rules for future changes |

## Implementation notes

- **Sprites** are 11×8 and 12×6 string bitmaps drawn as 4px blocks, so every
  alien and the ship are code, not images.
- **Physics** run on a fixed 800×600 logical field with `dt` in seconds, so a
  slow frame cannot speed up the aliens.
- **Sound** is synthesized on the fly: square-wave shots, triangle pops, and a
  low-passed noise burst for damage. The audio context is created on the first
  key press so browsers do not block it.
- **High score** lives in `localStorage` under `invaders-high-score` and is
  only written when it is beaten.

## Tweaking difficulty

All the knobs are at the top of their functions in `game.js`:

- `spawnWave()` — formation size, gaps, starting speed.
- `updateAliens()` — drop distance, speed ramp as aliens die.
- `updateEnemyFire()` — fire interval, bullet cap, bullet speed.
- `firePlayerBullet()` — cooldown and bullet speed.
