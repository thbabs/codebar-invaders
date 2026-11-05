# AGENTS.md

Rules for anyone — human or agent — changing this project.

## Hard constraints

- **Vanilla only.** No frameworks, no bundlers, no npm dependencies, no CDN
  scripts. `npx serve .` must remain the only command needed.
- **Three source files.** `index.html`, `styles.css`, `game.js`. New files are
  documentation (`SPEC.md`, `README.md`, `AGENTS.md`) or they are not added.
- **One canvas.** All gameplay renders to `#game` at 800×600 logical pixels.
  Do not add DOM overlays for HUD, menus, or dialogs; draw them.
- **No external assets.** No images, no sprite sheets, no audio files, no web
  fonts. Sprites are string bitmaps; sound is synthesized with WebAudio.
- **No gradients** in the rendered game. Flat colours and pixel edges only.
- **Touch is first-class.** The pad must write to the same `game.keys` set and
  call the same `primaryAction()` as the keyboard. Never fork the simulation.

## Architecture

- `game.js` is a single classic script (no modules) so it runs from `file://`
  as well as a static server.
- Simulation is separated from rendering: `update(dt)` mutates `game`,
  `draw()` only reads it.
- The loop is `requestAnimationFrame` with `dt` clamped to 50ms. Do not assume
  60fps; every movement is per-second and multiplied by `dt`.
- All mutable state lives on the `game` object. Avoid module-level variables
  other than the audio context, the noise buffer, and `lastTime`.
- Positions are logical pixels. The canvas is scaled with CSS and the context
  is transformed by `devicePixelRatio` once at startup.

## Gameplay invariants

- The player fires at most once per 220ms (`player.cooldown`).
- Three lives; damage grants 1.2s of invulnerability and clears enemy bullets.
- Aliens reverse and drop at the walls; they never leave the field.
- Reaching the player's row ends the run immediately.
- The high score key is `invaders-high-score` and is only written when beaten.
- `Space` must never restart the game during the 0.8s `overCooldown` window.
- Pausing must freeze `update()` completely: no alien movement, bullets, firing
  timers, particles or banner decay. Only `game.time` keeps advancing.
- Hiding the tab auto-pauses a running game.

## Style

- Two-space indentation, semicolons, single quotes, trailing commas in
  multiline literals.
- Prefer small pure helpers (`clamp`, `overlaps`, `burst`) over inline maths.
- Keep the palette in `COLORS`; never hardcode a hex value in a draw call.
- Guard `localStorage` and `AudioContext` in `try`/`catch`; both can fail in
  private mode or unsupported browsers.

## Verifying a change

1. `node --check game.js`.
2. `npx serve .`, open the page.
3. Start a run, fire, take a hit, clear a wave, and reach game over.
4. Confirm no console errors and that the high score survives a reload.
