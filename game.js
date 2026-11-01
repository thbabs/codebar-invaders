'use strict';

/* ------------------------------------------------------------------ setup */

const W = 800;
const H = 600;
const STORAGE_KEY = 'invaders-high-score';

const COLORS = {
  bg: '#0E1116',
  ship: '#84B59F',
  alienA: '#69A297',
  alienB: '#50808E',
  text: '#E6EEE9',
  dim: '#50808E',
  accent: '#84B59F',
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const isTouch = window.matchMedia('(pointer: coarse)').matches
  || navigator.maxTouchPoints > 0;

if (isTouch) {
  document.body.classList.add('is-touch');
}

/* ---------------------------------------------------------------- sprites */

const ALIEN_FRAMES = [
  [
    '00000100000',
    '00001110000',
    '00011111000',
    '00110101100',
    '01111111110',
    '11011111011',
    '00100000100',
    '01000000010',
  ],
  [
    '00000100000',
    '10001110001',
    '10011111001',
    '10110101101',
    '11111111111',
    '01111111110',
    '00100000100',
    '01000000010',
  ],
];

const SHIP = [
  '000001100000',
  '000011110000',
  '000111111000',
  '001111111100',
  '011111111110',
  '111111111111',
];

const ROW_POINTS = [50, 40, 30, 20, 10];

/* ------------------------------------------------------------ game state */

const game = {
  mode: 'intro',
  score: 0,
  high: loadHighScore(),
  wave: 1,
  lives: 3,
  time: 0,
  keys: new Set(),
  player: {
    x: W / 2,
    y: H - 64,
    w: 48,
    h: 24,
    speed: 430,
    cooldown: 0,
    invuln: 0,
  },
  aliens: [],
  bullets: [],
  enemyBullets: [],
  particles: [],
  alienDir: 1,
  alienSpeed: 36,
  animTime: 0,
  animFrame: 0,
  fireTimer: 1,
  shake: 0,
  flash: 0,
  banner: null,
  overCooldown: 0,
};

/* ------------------------------------------------------------------ audio */

let audioCtx = null;
let noiseBuffer = null;

function ensureAudio() {
  try {
    if (!audioCtx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      audioCtx = new Audio();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (error) {
    return null;
  }
}

function playTone(startFreq, endFreq, duration, type, volume, delay = 0) {
  const ac = ensureAudio();
  if (!ac) return;

  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(24, startFreq), start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), start + duration);

  gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function playNoise(duration, volume, cutoff) {
  const ac = ensureAudio();
  if (!ac) return;

  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  const start = ac.currentTime;
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer;

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  source.start(start);
  source.stop(start + duration);
}

function playPew() {
  playTone(880, 180, 0.09, 'square', 0.04);
}

function playAlienDown() {
  playTone(420, 90, 0.12, 'triangle', 0.05);
  playNoise(0.08, 0.025, 2200);
}

function playPlayerHurt() {
  playNoise(0.45, 0.1, 700);
  playTone(160, 40, 0.5, 'sine', 0.08);
}

function playWaveClear() {
  playTone(523, 523, 0.09, 'square', 0.035, 0);
  playTone(659, 659, 0.09, 'square', 0.035, 0.1);
  playTone(784, 784, 0.16, 'square', 0.04, 0.2);
}

/* ---------------------------------------------------------------- helpers */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y
  );
}

function loadHighScore() {
  try {
    const stored = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch (error) {
    return 0;
  }
}

function saveHighScore() {
  try {
    localStorage.setItem(STORAGE_KEY, String(game.high));
  } catch (error) {
    // Private mode: the run still counts, it just will not be remembered.
  }
}

function drawSprite(rows, x, y, cell, color) {
  ctx.fillStyle = color;
  for (let row = 0; row < rows.length; row += 1) {
    const line = rows[row];
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] === '1') {
        ctx.fillRect(Math.round(x + col * cell), Math.round(y + row * cell), cell, cell);
      }
    }
  }
}

/* ------------------------------------------------------------- simulation */

function startGame() {
  game.mode = 'playing';
  game.score = 0;
  game.wave = 1;
  game.lives = 3;
  game.bullets = [];
  game.enemyBullets = [];
  game.particles = [];
  game.shake = 0;
  game.flash = 0;
  game.banner = null;
  game.overCooldown = 0;
  game.player.x = W / 2;
  game.player.cooldown = 0;
  game.player.invuln = 0;
  spawnWave();
}

function spawnWave() {
  const cols = 8;
  const rows = 5;
  const alienW = 44;
  const alienH = 32;
  const gapX = 14;
  const gapY = 16;
  const totalW = cols * alienW + (cols - 1) * gapX;
  const startX = (W - totalW) / 2;
  const startY = 78;

  game.aliens = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      game.aliens.push({
        x: startX + col * (alienW + gapX),
        y: startY + row * (alienH + gapY),
        w: alienW,
        h: alienH,
        row,
        col,
        alive: true,
      });
    }
  }

  game.alienDir = 1;
  game.alienSpeed = 36 * Math.pow(1.1, game.wave - 1);
  game.animTime = 0;
  game.animFrame = 0;
  game.fireTimer = 1.1;
}

function nextWave() {
  game.wave += 1;
  game.banner = { text: `WAVE ${game.wave}`, t: 1.6 };
  game.bullets = [];
  game.enemyBullets = [];
  spawnWave();
  playWaveClear();
}

function firePlayerBullet() {
  const player = game.player;
  if (game.mode !== 'playing' || player.cooldown > 0) return;

  player.cooldown = 0.22;
  game.bullets.push({
    x: player.x - 2,
    y: player.y - 16,
    w: 4,
    h: 16,
    vy: -640,
  });
  playPew();
}

function updatePlayer(dt) {
  const player = game.player;
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  const direction = (game.keys.has('ArrowRight') ? 1 : 0)
    - (game.keys.has('ArrowLeft') ? 1 : 0);

  if (direction !== 0) {
    player.x = clamp(
      player.x + direction * player.speed * dt,
      player.w / 2 + 14,
      W - player.w / 2 - 14,
    );
  }

  if (game.keys.has('Space')) {
    firePlayerBullet();
  }
}

function updateAliens(dt) {
  const alive = game.aliens.filter((alien) => alien.alive);
  if (alive.length === 0) {
    nextWave();
    return;
  }

  game.animTime += dt * (1.6 + (1 - alive.length / 40) * 2.2);
  if (game.animTime > 0.5) {
    game.animTime = 0;
    game.animFrame = game.animFrame === 0 ? 1 : 0;
  }

  const speedScale = 1 + (1 - alive.length / 40) * 1.4;
  const step = game.alienDir * game.alienSpeed * speedScale * dt;

  let minX = Infinity;
  let maxX = -Infinity;
  for (const alien of alive) {
    minX = Math.min(minX, alien.x);
    maxX = Math.max(maxX, alien.x + alien.w);
  }

  const hitsEdge = (
    (game.alienDir > 0 && maxX + step > W - 24)
    || (game.alienDir < 0 && minX + step < 24)
  );

  if (hitsEdge) {
    game.alienDir *= -1;
    for (const alien of alive) {
      alien.y += 22;
      alien.x += game.alienDir * 2;
    }
  } else {
    for (const alien of alive) {
      alien.x += step;
    }
  }

  for (const alien of alive) {
    if (alien.y + alien.h >= game.player.y - 6) {
      endGame();
      return;
    }
  }
}

function updateEnemyFire(dt) {
  const alive = game.aliens.filter((alien) => alien.alive);
  if (alive.length === 0 || game.enemyBullets.length >= 6) return;

  game.fireTimer -= dt;
  if (game.fireTimer > 0) return;

  const shooter = alive[Math.floor(Math.random() * alive.length)];
  game.enemyBullets.push({
    x: shooter.x + shooter.w / 2 - 2,
    y: shooter.y + shooter.h,
    w: 4,
    h: 14,
    vy: 210 + game.wave * 18,
  });

  const pressure = Math.max(0.45, 1 - game.wave * 0.05);
  game.fireTimer = (0.55 + Math.random() * 0.7) * pressure;
}

function damagePlayer() {
  const player = game.player;

  game.lives -= 1;
  game.flash = 1;
  game.shake = 11;
  burst(player.x, player.y + player.h / 2, 16, COLORS.ship);
  game.enemyBullets = [];
  playPlayerHurt();

  if (game.lives <= 0) {
    endGame();
    return;
  }

  player.invuln = 1.2;
}

function endGame() {
  if (game.mode !== 'playing') return;

  game.mode = 'gameover';
  game.overCooldown = 0.8;
  game.shake = 12;
  game.bullets = [];
  game.enemyBullets = [];

  if (game.score > game.high) {
    game.high = game.score;
    saveHighScore();
  }
}

function collide() {
  const player = game.player;
  const playerBox = {
    x: player.x - player.w / 2,
    y: player.y,
    w: player.w,
    h: player.h,
  };

  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = game.bullets[i];
    for (const alien of game.aliens) {
      if (!alien.alive || !overlaps(bullet, alien)) continue;

      alien.alive = false;
      game.bullets.splice(i, 1);
      game.score += ROW_POINTS[alien.row];
      burst(
        alien.x + alien.w / 2,
        alien.y + alien.h / 2,
        9,
        alien.row < 2 ? COLORS.alienB : COLORS.alienA,
      );
      game.shake = Math.max(game.shake, 4);
      playAlienDown();
      break;
    }
  }

  if (player.invuln > 0) return;

  for (let i = game.enemyBullets.length - 1; i >= 0; i -= 1) {
    if (overlaps(game.enemyBullets[i], playerBox)) {
      game.enemyBullets.splice(i, 1);
      damagePlayer();
      return;
    }
  }
}

function burst(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 180;
    const life = 0.35 + Math.random() * 0.45;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life,
      maxLife: life,
      size: 2 + Math.random() * 2,
      color,
    });
  }
}

function updateParticles(dt) {
  for (const particle of game.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 220 * dt;
    particle.life -= dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function update(dt) {
  game.time += dt;

  game.shake = Math.max(0, game.shake - 55 * dt);
  game.flash = Math.max(0, game.flash - 2.6 * dt);
  game.overCooldown = Math.max(0, game.overCooldown - dt);

  if (game.banner) {
    game.banner.t -= dt;
    if (game.banner.t <= 0) game.banner = null;
  }

  updateParticles(dt);

  if (game.mode !== 'playing') return;

  updatePlayer(dt);

  for (const bullet of game.bullets) {
    bullet.y += bullet.vy * dt;
  }
  game.bullets = game.bullets.filter((bullet) => bullet.y + bullet.h > -20);

  for (const bullet of game.enemyBullets) {
    bullet.y += bullet.vy * dt;
  }
  game.enemyBullets = game.enemyBullets.filter((bullet) => bullet.y < H + 20);

  updateAliens(dt);
  if (game.mode !== 'playing') return;

  updateEnemyFire(dt);
  collide();
}

/* ----------------------------------------------------------------- render */

function drawHorizon() {
  ctx.fillStyle = 'rgba(80, 128, 142, 0.35)';
  ctx.fillRect(24, 572, W - 48, 2);
}

function drawAliens() {
  const frame = ALIEN_FRAMES[game.animFrame];
  for (const alien of game.aliens) {
    if (!alien.alive) continue;
    drawSprite(frame, alien.x, alien.y, 4, alien.row < 2 ? COLORS.alienB : COLORS.alienA);
  }
}

function drawPlayer() {
  const player = game.player;
  const blinking = player.invuln > 0 && Math.floor(game.time * 14) % 2 === 0;
  if (blinking) return;

  drawSprite(SHIP, player.x - player.w / 2, player.y, 4, COLORS.ship);
}

function drawBullets() {
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = COLORS.accent;

  for (const bullet of game.bullets) {
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
  }

  ctx.shadowColor = COLORS.alienA;
  for (const bullet of game.enemyBullets) {
    ctx.fillStyle = COLORS.alienA;
    ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
  }

  ctx.restore();
}

function drawParticles() {
  for (const particle of game.particles) {
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      Math.round(particle.x),
      Math.round(particle.y),
      particle.size,
      particle.size,
    );
  }
  ctx.globalAlpha = 1;
}

function drawScanlines() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1);
  }
}

function drawFlash() {
  if (game.flash <= 0) return;
  ctx.fillStyle = `rgba(230, 238, 233, ${game.flash * 0.5})`;
  ctx.fillRect(0, 0, W, H);
}

function drawHud() {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 17px "Courier New", monospace';
  ctx.fillStyle = COLORS.text;

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${String(game.score).padStart(6, '0')}`, 24, 34);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`WAVE ${game.wave}`, W / 2, 34);

  for (let i = 0; i < game.lives; i += 1) {
    drawSprite(SHIP, W - 24 - 26 - i * 30, 22, 2, COLORS.ship);
  }

  ctx.restore();
}

function drawBanner() {
  if (!game.banner) return;

  ctx.save();
  ctx.globalAlpha = clamp(game.banner.t * 2, 0, 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 26px "Courier New", monospace';
  ctx.fillText(game.banner.text, W / 2, 122);
  ctx.restore();
}

function drawIntro() {
  ctx.save();
  ctx.textAlign = 'center';

  ctx.fillStyle = COLORS.ship;
  ctx.font = '700 72px "Courier New", monospace';
  ctx.fillText('INVADERS', W / 2, 172);

  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 14px "Courier New", monospace';
  ctx.fillText('ONE PAGE · ONE CANVAS · NO MERCY', W / 2, 206);

  drawSprite(ALIEN_FRAMES[0], W / 2 - 132, 262, 4, COLORS.alienB);
  drawSprite(ALIEN_FRAMES[1], W / 2 - 22, 262, 4, COLORS.alienA);
  drawSprite(ALIEN_FRAMES[0], W / 2 + 88, 262, 4, COLORS.alienB);

  ctx.fillStyle = COLORS.text;
  ctx.font = '600 20px "Courier New", monospace';
  ctx.fillText(`HIGH SCORE ${String(game.high).padStart(6, '0')}`, W / 2, 372);

  if (Math.floor(game.time * 2) % 2 === 0) {
    ctx.fillStyle = COLORS.accent;
    ctx.font = '700 20px "Courier New", monospace';
    ctx.fillText(isTouch ? 'TAP TO START' : 'PRESS SPACE TO START', W / 2, 404);
  }

  drawSprite(SHIP, W / 2 - 24, 452, 4, COLORS.ship);

  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 14px "Courier New", monospace';
  ctx.fillText(
    isTouch ? 'USE THE CONTROLS BELOW' : '← →  MOVE      SPACE  SHOOT',
    W / 2,
    536,
  );

  ctx.restore();
}

function drawGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(14, 17, 22, 0.78)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.ship;
  ctx.font = '700 56px "Courier New", monospace';
  ctx.fillText('GAME OVER', W / 2, 236);

  ctx.fillStyle = COLORS.text;
  ctx.font = '600 22px "Courier New", monospace';
  ctx.fillText(`FINAL SCORE ${String(game.score).padStart(6, '0')}`, W / 2, 308);

  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 17px "Courier New", monospace';
  ctx.fillText(`HIGH SCORE ${String(game.high).padStart(6, '0')}`, W / 2, 344);

  if (Math.floor(game.time * 2) % 2 === 0 && game.overCooldown <= 0) {
    ctx.fillStyle = COLORS.accent;
    ctx.font = '700 20px "Courier New", monospace';
    ctx.fillText(isTouch ? 'TAP TO RETRY' : 'PRESS SPACE TO RETRY', W / 2, 436);
  }

  ctx.restore();
}

function draw() {
  ctx.save();

  if (game.shake > 0.1) {
    ctx.translate(
      (Math.random() - 0.5) * game.shake,
      (Math.random() - 0.5) * game.shake,
    );
  }

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(-30, -30, W + 60, H + 60);

  drawHorizon();
  drawAliens();
  if (game.mode !== 'intro') {
    drawPlayer();
  }
  drawBullets();
  drawParticles();

  ctx.restore();

  drawFlash();
  drawScanlines();

  if (game.mode !== 'intro') {
    drawHud();
  }

  if (game.mode === 'intro') {
    drawIntro();
  } else if (game.mode === 'gameover') {
    drawGameOver();
  }

  drawBanner();
}

/* ------------------------------------------------------------------ input */

const CONTROL_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
]);

function eventCode(event) {
  if (event.code) return event.code;
  if (event.key === ' ') return 'Space';
  return event.key;
}

function primaryAction() {
  if (game.mode === 'intro') {
    startGame();
    return true;
  }
  if (game.mode === 'gameover' && game.overCooldown <= 0) {
    startGame();
    return true;
  }
  return false;
}

window.addEventListener('keydown', (event) => {
  const code = eventCode(event);

  if (CONTROL_KEYS.has(code)) {
    event.preventDefault();
  }

  ensureAudio();
  game.keys.add(code);

  if (event.repeat) return;

  if (code === 'Space') {
    primaryAction();
  }
});

window.addEventListener('keyup', (event) => {
  game.keys.delete(eventCode(event));
});

window.addEventListener('blur', () => {
  game.keys.clear();
});

document.addEventListener('visibilitychange', () => {
  lastTime = performance.now();
  if (document.hidden) {
    game.keys.clear();
  }
});

/* Touch and click: start or retry from the canvas, then use the on-screen pad. */

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  ensureAudio();
  primaryAction();
});

const pad = document.getElementById('pad');
const PAD_KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  fire: 'Space',
};

for (const button of document.querySelectorAll('[data-control]')) {
  const code = PAD_KEYS[button.dataset.control];
  if (!code) continue;

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    ensureAudio();

    button.classList.add('is-held');
    game.keys.add(code);

    if (button.setPointerCapture) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch (error) {
        // Some browsers refuse capture on synthetic pointers; holding still works.
      }
    }

    if (code === 'Space') {
      primaryAction();
    }
  });

  const release = () => {
    button.classList.remove('is-held');
    game.keys.delete(code);
  };

  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

/* ------------------------------------------------------------------- loop */

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  draw();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
