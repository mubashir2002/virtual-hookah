export const FLAVOR_PALETTES = {
  mint: {
    name: 'Fresh Mint',
    colorHex: '#2dd4bf',
    rgb: { r: 45, g: 212, b: 191 },
    glow: 'rgba(45, 212, 191, 0.3)',
    vaporTint: { r: 226, g: 246, b: 242 }
  },
  grape: {
    name: 'Grape Fusion',
    colorHex: '#c084fc',
    rgb: { r: 192, g: 132, b: 252 },
    glow: 'rgba(192, 132, 252, 0.3)',
    vaporTint: { r: 238, g: 230, b: 250 }
  },
  watermelon: {
    name: 'Watermelon Chill',
    colorHex: '#fb7185',
    rgb: { r: 251, g: 113, b: 133 },
    glow: 'rgba(251, 113, 133, 0.3)',
    vaporTint: { r: 250, g: 232, b: 237 }
  },
  'double-apple': {
    name: 'Double Apple',
    colorHex: '#facc15',
    rgb: { r: 250, g: 204, b: 21 },
    glow: 'rgba(250, 204, 21, 0.3)',
    vaporTint: { r: 250, g: 244, b: 230 }
  }
};

const SPRITE_SIZE = 128;
const SPRITE_VARIANTS = 4;

function hash2(ix, iy, seed) {
  let h = ix * 374761393 + iy * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x, y, seed) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(x * freq, y * freq, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

function createVaporSprite(tint, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
  const half = SPRITE_SIZE / 2;

  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const d = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * SPRITE_SIZE + x) * 4;

      if (d >= 1) {
        img.data[idx + 3] = 0;
        continue;
      }

      const falloff = Math.pow(1 - d, 1.6);
      const warpX = fbm(x * 0.045 + 31, y * 0.045 + 7, seed + 91) * 2.4;
      const warpY = fbm(x * 0.045 + 5, y * 0.045 + 63, seed + 53) * 2.4;
      const n = fbm(x * 0.032 + warpX, y * 0.032 + warpY, seed);
      const density = Math.max(0, Math.min(1, (n - 0.22) * 2.1));
      const alpha = falloff * (0.18 + density * 0.95);
      const shade = 0.72 + 0.28 * n;

      img.data[idx] = Math.min(255, tint.r * shade);
      img.data[idx + 1] = Math.min(255, tint.g * shade);
      img.data[idx + 2] = Math.min(255, tint.b * (shade + 0.03));
      img.data[idx + 3] = Math.min(255, alpha * 255 * 0.62);
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 0;
    this.maxSize = 0;
    this.growth = 0;
    this.alpha = 0;
    this.maxAlpha = 0;
    this.age = 0;
    this.maxAge = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.turbulence = 0;
    this.phase = 0;
    this.variant = 0;
  }

  reset(x, y, vx, vy, size, maxSize, maxAlpha, maxAge, turbulence = 0.4) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.maxSize = maxSize;
    this.growth = (maxSize - size) / maxAge;
    this.alpha = 0;
    this.maxAlpha = maxAlpha;
    this.age = 0;
    this.maxAge = maxAge;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.014;
    this.turbulence = turbulence;
    this.phase = Math.random() * Math.PI * 2;
    this.variant = Math.floor(Math.random() * SPRITE_VARIANTS);
  }

  update(dt) {
    if (!this.active) return;

    this.age += dt;
    if (this.age >= this.maxAge) {
      this.active = false;
      return;
    }

    const t = this.age / this.maxAge;

    if (t < 0.12) {
      const k = t / 0.12;
      this.alpha = k * k * this.maxAlpha;
    } else {
      const k = (t - 0.12) / 0.88;
      this.alpha = Math.pow(1 - k, 1.35) * this.maxAlpha;
    }

    const growthEase = 1 - t * 0.55;
    this.size += this.growth * dt * 60 * growthEase;

    const f = dt * 60;
    this.vy -= 0.045 * f;
    const drag = Math.pow(0.978, f);
    this.vx *= drag;
    this.vy *= drag;

    const sway = Math.sin(this.age * 1.7 + this.phase) * this.turbulence * 0.5
      + Math.sin(this.age * 3.1 + this.y * 0.02 + this.phase * 2) * this.turbulence * 0.35;
    this.x += (this.vx + sway) * f;
    this.y += this.vy * f;

    this.rotation += this.rotationSpeed * f;
  }
}

class SmokeRing {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 18;
    this.thickness = 12;
    this.maxRadius = 130;
    this.alpha = 0;
    this.age = 0;
    this.maxAge = 2.6;
    this.rotation = 0;
    this.variant = 0;
  }

  reset(x, y, vx, vy, initialRadius, maxRadius) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = initialRadius;
    this.thickness = 10;
    this.maxRadius = maxRadius;
    this.alpha = 0.4;
    this.age = 0;
    this.maxAge = 2.8;
    this.rotation = Math.atan2(vy, vx) + Math.PI / 2;
    this.variant = Math.floor(Math.random() * SPRITE_VARIANTS);
  }

  update(dt) {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= this.maxAge) {
      this.active = false;
      return;
    }

    const t = this.age / this.maxAge;
    this.alpha = Math.pow(1 - t, 1.2) * 0.4;
    this.radius += (this.maxRadius - this.radius) * 0.035 * (dt * 60);
    this.thickness += 0.25 * (dt * 60);

    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vy -= 0.04 * dt * 60;
  }

  draw(ctx, sprites) {
    if (!this.active || this.alpha <= 0.01) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const numPuffs = 16;
    const puffRadius = this.thickness * 1.5;
    const puffAlpha = this.alpha * 0.7;

    for (let i = 0; i < numPuffs; i++) {
      const angle = (i / numPuffs) * Math.PI * 2;
      const px = Math.cos(angle) * this.radius;
      const py = Math.sin(angle) * (this.radius * 0.55);
      const sprite = sprites[(this.variant + i) % sprites.length];

      ctx.globalAlpha = puffAlpha;
      ctx.drawImage(sprite, px - puffRadius, py - puffRadius, puffRadius * 2, puffRadius * 2);
    }

    ctx.restore();
  }
}

export class SmokeSystem {
  constructor(maxParticles = 520, maxRings = 12) {
    this.maxParticles = maxParticles;
    this.pool = Array.from({ length: maxParticles }, () => new Particle());
    this.rings = Array.from({ length: maxRings }, () => new SmokeRing());
    this.cursor = 0;
    this.currentFlavorKey = 'mint';
    this.palette = FLAVOR_PALETTES.mint;

    this.spriteCache = {};
    this._initSprites();
  }

  _initSprites() {
    Object.keys(FLAVOR_PALETTES).forEach((key) => {
      const tint = FLAVOR_PALETTES[key].vaporTint;
      this.spriteCache[key] = Array.from({ length: SPRITE_VARIANTS }, (_, i) =>
        createVaporSprite(tint, 11 + i * 29)
      );
    });
  }

  setFlavor(flavorKey) {
    if (FLAVOR_PALETTES[flavorKey]) {
      this.currentFlavorKey = flavorKey;
      this.palette = FLAVOR_PALETTES[flavorKey];
    }
  }

  spawnParticle(x, y, vx, vy, size, maxSize, maxAlpha, maxAge, turbulence = 0.4) {
    for (let i = 0; i < this.maxParticles; i++) {
      const idx = (this.cursor + i) % this.maxParticles;
      const p = this.pool[idx];
      if (!p.active) {
        this.cursor = (idx + 1) % this.maxParticles;
        p.reset(x, y, vx, vy, size, maxSize, maxAlpha, maxAge, turbulence);
        return;
      }
    }
  }

  emitContinuousPlume(mouthX, mouthY, intensity = 1.0, count = 2) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + (Math.random() - 0.5) * 0.9;
      const speed = 0.9 + Math.random() * (1.8 * intensity);
      const vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 0.8;
      const vy = Math.sin(angle) * speed * 0.55 - (0.15 + Math.random() * 0.4);

      const size = 16 + Math.random() * 14;
      const maxSize = size + 70 + Math.random() * 80;
      const maxAlpha = 0.26 + Math.random() * 0.16;
      const maxAge = 3.0 + Math.random() * 1.8;

      this.spawnParticle(
        mouthX + (Math.random() - 0.5) * 14,
        mouthY + (Math.random() - 0.5) * 10,
        vx,
        vy,
        size,
        maxSize,
        maxAlpha,
        maxAge,
        0.55
      );
    }
  }

  emitSmokeRing(mouthX, mouthY, direction = { x: 0, y: -1 }) {
    const ring = this.rings.find((r) => !r.active);
    if (!ring) return;

    const speed = 2.6;
    const vx = direction.x * speed + (Math.random() - 0.5) * 0.4;
    const vy = direction.y * speed - 0.7;

    ring.reset(mouthX, mouthY, vx, vy, 16, 120);

    for (let i = 0; i < 4; i++) {
      this.spawnParticle(
        mouthX + (Math.random() - 0.5) * 12,
        mouthY + (Math.random() - 0.5) * 12,
        vx * 0.7,
        vy * 0.7,
        14,
        55,
        0.2,
        2.0,
        0.3
      );
    }
  }

  emitBowlWisp(bowlX, bowlY) {
    if (Math.random() > 0.3) return;
    const vx = (Math.random() - 0.5) * 0.4;
    const vy = -0.7 - Math.random() * 0.6;
    const size = 7 + Math.random() * 6;
    const maxSize = 34 + Math.random() * 22;

    this.spawnParticle(
      bowlX + (Math.random() - 0.5) * 12,
      bowlY - 8,
      vx,
      vy,
      size,
      maxSize,
      0.2,
      2.4,
      0.35
    );
  }

  update(dt) {
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.pool[i].active) {
        this.pool[i].update(dt);
      }
    }

    for (let i = 0; i < this.rings.length; i++) {
      if (this.rings[i].active) {
        this.rings[i].update(dt);
      }
    }
  }

  draw(ctx, dpr = 1) {
    const sprites = this.spriteCache[this.currentFlavorKey] || this.spriteCache.mint;

    ctx.save();
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.pool[i];
      if (!p.active || p.alpha <= 0.004) continue;

      const cos = Math.cos(p.rotation) * dpr;
      const sin = Math.sin(p.rotation) * dpr;
      ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(sprites[p.variant], -p.size, -p.size, p.size * 2, p.size * 2);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (let i = 0; i < this.rings.length; i++) {
      if (this.rings[i].active) {
        this.rings[i].draw(ctx, sprites);
      }
    }

    ctx.restore();
  }
}
