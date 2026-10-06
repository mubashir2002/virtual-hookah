class VerletPoint {
  constructor(x, y, pinned = false) {
    this.x = x;
    this.y = y;
    this.oldX = x;
    this.oldY = y;
    this.pinned = pinned;
  }

  update(dt, damping = 0.965, gravity = 0.35) {
    if (this.pinned) return;
    const vx = (this.x - this.oldX) * damping;
    const vy = (this.y - this.oldY) * damping;

    this.oldX = this.x;
    this.oldY = this.y;

    this.x += vx;
    this.y += vy + gravity;
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export class Hookah {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.scale = 0.85;

    this.coalHeat = 0.5;
    this.targetCoalHeat = 0.5;
    this.coalFlickerTime = 0;

    this.bubbles = [];
    this._initBubbles();

    this.numNodes = 24;
    this.segmentLength = 32;
    this.nodes = [];
    this.isGrabbed = false;
    this.grabTarget = { x: 0, y: 0 };

    this.isHovered = false;
    this.beaconPulse = 0;

    this.flavorColor = 'rgba(45, 212, 191, 0.4)';
    this.waterBaseColor = { r: 45, g: 212, b: 191 };

    this.resize(canvasWidth, canvasHeight);
  }

  _initBubbles() {
    this.bubbles = Array.from({ length: 35 }, () => ({
      x: (Math.random() - 0.5) * 65,
      y: Math.random() * 80,
      size: 2.5 + Math.random() * 4,
      speed: 1.2 + Math.random() * 2,
      opacity: 0.4 + Math.random() * 0.5
    }));
  }

  resize(w, h) {
    this.canvasWidth = w;
    this.canvasHeight = h;

    const isPortrait = w < 768 || w < h;
    const availableHeight = h - 180;
    const hookahFullHeight = 500;

    if (isPortrait) {
      this.scale = Math.max(0.48, Math.min(0.82, Math.min(w * 0.45 / 150, availableHeight / hookahFullHeight)));
      this.baseX = Math.min(w - 110 * this.scale, w * 0.64);
      this.baseY = Math.min(h - 95, 95 + hookahFullHeight * this.scale);
      this.restMouthpieceX = Math.max(50, w * 0.26);
      this.restMouthpieceY = Math.min(h - 130, this.baseY - 140 * this.scale);
    } else {
      this.scale = Math.max(0.65, Math.min(1.05, Math.min(w * 0.35 / 170, availableHeight / hookahFullHeight)));
      this.baseX = Math.min(w - 180 * this.scale, w * 0.76);
      this.baseY = Math.min(h - 70, 90 + hookahFullHeight * this.scale);
      this.restMouthpieceX = Math.max(80, this.baseX - 290 * this.scale);
      this.restMouthpieceY = Math.min(h - 120, this.baseY - 170 * this.scale);
    }

    this.hoseAnchorX = this.baseX - 35 * this.scale;
    this.hoseAnchorY = this.baseY - 260 * this.scale;
    this.segmentLength = 34 * this.scale;
    this._initHoseChain();
  }

  _initHoseChain() {
    this.nodes = [];
    for (let i = 0; i < this.numNodes; i++) {
      const t = i / (this.numNodes - 1);
      const x = this.hoseAnchorX + (this.restMouthpieceX - this.hoseAnchorX) * t;
      const sag = Math.sin(t * Math.PI) * (140 * this.scale);
      const y = this.hoseAnchorY + (this.restMouthpieceY - this.hoseAnchorY) * t + sag;

      const pinned = i === 0;
      this.nodes.push(new VerletPoint(x, y, pinned));
    }
  }

  setFlavorColor(rgbaStr, rgb = { r: 45, g: 212, b: 191 }) {
    this.flavorColor = rgbaStr;
    this.waterBaseColor = rgb;
  }

  getMouthpieceGeometry() {
    const endIdx = this.nodes.length - 1;
    const baseNode = this.nodes[endIdx];
    const prevNode = this.nodes[endIdx - 1];
    const angle = Math.atan2(baseNode.y - prevNode.y, baseNode.x - prevNode.x);

    const handleLength = 100 * this.scale;
    const tipX = baseNode.x + Math.cos(angle) * handleLength;
    const tipY = baseNode.y + Math.sin(angle) * handleLength;
    const centerX = (baseNode.x + tipX) / 2;
    const centerY = (baseNode.y + tipY) / 2;

    return {
      baseX: baseNode.x,
      baseY: baseNode.y,
      tipX,
      tipY,
      centerX,
      centerY,
      angle,
      length: handleLength
    };
  }

  getMouthpiecePosition() {
    const geom = this.getMouthpieceGeometry();
    return { x: geom.centerX, y: geom.centerY, radius: 55 * this.scale };
  }

  getNozzleTipPosition() {
    const geom = this.getMouthpieceGeometry();
    return { x: geom.tipX, y: geom.tipY };
  }

  getBowlPosition() {
    return {
      x: this.baseX,
      y: this.baseY - 485 * this.scale
    };
  }

  isNearMouthpiece(x, y, threshold = 140) {
    const geom = this.getMouthpieceGeometry();
    const dist = distToSegment(x, y, geom.baseX, geom.baseY, geom.tipX, geom.tipY);
    const effectiveThreshold = Math.max(100, threshold * this.scale);
    return dist <= effectiveThreshold;
  }

  grab(x, y) {
    this.isGrabbed = true;
    this.grabTarget.x = x;
    this.grabTarget.y = y;
  }

  updateGrab(x, y) {
    if (this.isGrabbed) {
      this.grabTarget.x = x;
      this.grabTarget.y = y;
    }
  }

  release() {
    this.isGrabbed = false;
  }

  setHovered(hovered) {
    this.isHovered = hovered;
  }

  setSmoking(isSmoking, inhaleIntensity = 1.0) {
    if (isSmoking) {
      this.targetCoalHeat = 0.8 + 0.2 * inhaleIntensity;
    } else {
      this.targetCoalHeat = 0.5;
    }
  }

  update(dt, isSmoking = false) {
    this.coalHeat += (this.targetCoalHeat - this.coalHeat) * 0.12;
    this.coalFlickerTime += dt * 8;
    this.beaconPulse += dt * 4;

    const bubbleRateMultiplier = isSmoking ? 4.8 : 0.9;
    this.bubbles.forEach((b) => {
      b.y -= b.speed * bubbleRateMultiplier * (dt * 60);
      if (b.y < 0) {
        b.y = 80;
        b.x = (Math.random() - 0.5) * 70;
        b.size = isSmoking ? 3 + Math.random() * 5 : 2 + Math.random() * 3.5;
      }
    });

    this.nodes[0].x = this.hoseAnchorX;
    this.nodes[0].y = this.hoseAnchorY;
    this.nodes[0].oldX = this.hoseAnchorX;
    this.nodes[0].oldY = this.hoseAnchorY;

    const endIdx = this.numNodes - 1;

    if (this.isGrabbed) {
      const endNode = this.nodes[endIdx];
      endNode.x += (this.grabTarget.x - endNode.x) * 0.7;
      endNode.y += (this.grabTarget.y - endNode.y) * 0.7;
      endNode.oldX = endNode.x;
      endNode.oldY = endNode.y;
    } else {
      for (let i = 1; i < this.numNodes; i++) {
        const t = i / (this.numNodes - 1);
        const targetX = this.hoseAnchorX + (this.restMouthpieceX - this.hoseAnchorX) * t;
        const targetSag = Math.sin(t * Math.PI) * (130 * this.scale);
        const targetY = this.hoseAnchorY + (this.restMouthpieceY - this.hoseAnchorY) * t + targetSag;

        this.nodes[i].x += (targetX - this.nodes[i].x) * 0.045;
        this.nodes[i].y += (targetY - this.nodes[i].y) * 0.045;
      }
    }

    const gravity = 0.38 * this.scale;
    const damping = 0.96;
    for (let i = 1; i < this.numNodes; i++) {
      if (this.isGrabbed && i === endIdx) continue;
      this.nodes[i].update(dt, damping, gravity);
    }

    const iterations = 8;
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < this.numNodes - 1; i++) {
        const p1 = this.nodes[i];
        const p2 = this.nodes[i + 1];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const diff = (dist - this.segmentLength) / dist;

        if (p1.pinned) {
          if (!this.isGrabbed || i + 1 !== endIdx) {
            p2.x -= dx * diff;
            p2.y -= dy * diff;
          }
        } else if (this.isGrabbed && i + 1 === endIdx) {
          p1.x += dx * diff;
          p1.y += dy * diff;
        } else {
          p1.x += dx * diff * 0.5;
          p1.y += dy * diff * 0.5;
          p2.x -= dx * diff * 0.5;
          p2.y -= dy * diff * 0.5;
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    this._drawHookahBody(ctx);
    this._drawHose(ctx);
    this._drawMouthpiece(ctx);
    ctx.restore();
  }

  _drawHookahBody(ctx) {
    const bx = this.baseX;
    const by = this.baseY;
    const s = this.scale;

    ctx.save();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bx - 32 * s, by - 215 * s);
    ctx.lineTo(bx + 32 * s, by - 215 * s);
    ctx.bezierCurveTo(bx + 26 * s, by - 145 * s, bx + 100 * s, by - 105 * s, bx + 84 * s, by - 22 * s);
    ctx.bezierCurveTo(bx + 74 * s, by + 12 * s, bx + 52 * s, by + 16 * s, bx, by + 16 * s);
    ctx.bezierCurveTo(bx - 52 * s, by + 16 * s, bx - 74 * s, by + 12 * s, bx - 84 * s, by - 22 * s);
    ctx.bezierCurveTo(bx - 100 * s, by - 105 * s, bx - 26 * s, by - 145 * s, bx - 32 * s, by - 215 * s);
    ctx.closePath();

    const glassBodyGrad = ctx.createLinearGradient(bx - 90 * s, by - 150 * s, bx + 90 * s, by + 15 * s);
    glassBodyGrad.addColorStop(0, '#1c1328');
    glassBodyGrad.addColorStop(0.35, '#2e1c42');
    glassBodyGrad.addColorStop(0.7, '#150a20');
    glassBodyGrad.addColorStop(1, '#09040e');
    ctx.fillStyle = glassBodyGrad;
    ctx.fill();

    ctx.save();
    ctx.clip();

    const waterGrad = ctx.createLinearGradient(bx, by - 130 * s, bx, by + 16 * s);
    const rgb = this.waterBaseColor;
    waterGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
    waterGrad.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`);
    waterGrad.addColorStop(1, `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 0.85)`);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(bx - 110 * s, by - 130 * s, 220 * s, 160 * s);

    ctx.beginPath();
    ctx.ellipse(bx, by - 130 * s, 72 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.65)`;
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    this.bubbles.forEach((b) => {
      const bubbleX = bx + b.x * s;
      const bubbleY = by - 120 * s + b.y * s;
      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, b.size * s, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity})`;
      ctx.fill();
      ctx.lineWidth = 1 * s;
      ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.moveTo(bx - 60 * s, by - 30 * s);
    ctx.bezierCurveTo(bx - 75 * s, by - 80 * s, bx - 22 * s, by - 160 * s, bx - 20 * s, by - 210 * s);
    ctx.lineWidth = 6 * s;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.stroke();

    ctx.restore();

    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(bx, by - 70 * s, 80 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.lineWidth = 6 * s;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = '#fffbeb';
    ctx.stroke();

    ctx.restore();

    const stemX = bx - 14 * s;
    const stemW = 28 * s;
    const stemH = 245 * s;
    const stemY = by - 455 * s;

    const stemGrad = ctx.createLinearGradient(stemX, 0, stemX + stemW, 0);
    stemGrad.addColorStop(0, '#78350f');
    stemGrad.addColorStop(0.25, '#fef08a');
    stemGrad.addColorStop(0.55, '#d97706');
    stemGrad.addColorStop(0.85, '#fef08a');
    stemGrad.addColorStop(1, '#451a03');

    ctx.fillStyle = stemGrad;
    ctx.fillRect(stemX, stemY, stemW, stemH);
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = '#fef3c7';
    ctx.strokeRect(stemX, stemY, stemW, stemH);

    [by - 275 * s, by - 340 * s, by - 405 * s].forEach((ringY, idx) => {
      const rWidth = (idx === 1 ? 34 : 24) * s;
      const rHeight = 12 * s;

      ctx.beginPath();
      ctx.ellipse(bx, ringY, rWidth, rHeight, 0, 0, Math.PI * 2);
      ctx.fillStyle = stemGrad;
      ctx.fill();
      ctx.lineWidth = 2.5 * s;
      ctx.strokeStyle = '#fffbeb';
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.arc(this.hoseAnchorX + 6 * s, this.hoseAnchorY, 16 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#b45309';
    ctx.fill();
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.hoseAnchorX + 6 * s, this.hoseAnchorY, 7 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0702';
    ctx.fill();

    const trayY = by - 455 * s;
    ctx.beginPath();
    ctx.ellipse(bx, trayY, 75 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = stemGrad;
    ctx.fill();
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(bx, trayY - 4 * s, 70 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    const bowlY = by - 485 * s;
    ctx.beginPath();
    ctx.moveTo(bx - 16 * s, trayY);
    ctx.lineTo(bx - 30 * s, bowlY);
    ctx.lineTo(bx + 30 * s, bowlY);
    ctx.lineTo(bx + 16 * s, trayY);
    ctx.closePath();
    ctx.fillStyle = '#9a3412';
    ctx.fill();
    ctx.lineWidth = 2.5 * s;
    ctx.strokeStyle = '#fed7aa';
    ctx.stroke();

    const coalsY = bowlY - 10 * s;
    const flicker = Math.sin(this.coalFlickerTime) * 0.15;
    const currentHeat = Math.min(1.0, Math.max(0.2, this.coalHeat + flicker));

    const coalGlow = ctx.createRadialGradient(bx, coalsY, 4 * s, bx, coalsY, 55 * s * currentHeat);
    coalGlow.addColorStop(0, `rgba(255, 120, 30, ${0.85 * currentHeat})`);
    coalGlow.addColorStop(0.5, `rgba(255, 50, 0, ${0.4 * currentHeat})`);
    coalGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coalGlow;
    ctx.beginPath();
    ctx.arc(bx, coalsY, 55 * s * currentHeat, 0, Math.PI * 2);
    ctx.fill();

    [-13 * s, 0, 13 * s].forEach((offset, idx) => {
      const cx = bx + offset;
      const cy = coalsY + (idx === 1 ? -4 * s : 0);
      const cSize = 14 * s;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((idx - 1) * 0.14);

      ctx.fillStyle = '#140c0c';
      ctx.fillRect(-cSize / 2, -cSize / 2, cSize, cSize);

      const innerHeat = ctx.createRadialGradient(0, 0, 1, 0, 0, cSize * 0.7);
      innerHeat.addColorStop(0, `rgba(255, 255, 220, ${currentHeat})`);
      innerHeat.addColorStop(0.4, `rgba(255, 120, 20, ${0.9 * currentHeat})`);
      innerHeat.addColorStop(0.9, `rgba(220, 38, 38, ${0.6 * currentHeat})`);
      innerHeat.addColorStop(1, 'rgba(20, 10, 10, 0)');
      ctx.fillStyle = innerHeat;
      ctx.fillRect(-cSize / 2, -cSize / 2, cSize, cSize);

      ctx.strokeStyle = `rgba(255, 160, 50, ${currentHeat})`;
      ctx.lineWidth = 1.8 * s;
      ctx.strokeRect(-cSize / 2, -cSize / 2, cSize, cSize);

      ctx.restore();
    });

    ctx.restore();
  }

  _drawHose(ctx) {
    const s = this.scale;
    const len = this.nodes.length;
    if (len < 2) return;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
    for (let i = 1; i < len - 1; i++) {
      const xc = (this.nodes[i].x + this.nodes[i + 1].x) / 2;
      const yc = (this.nodes[i].y + this.nodes[i + 1].y) / 2;
      ctx.quadraticCurveTo(this.nodes[i].x, this.nodes[i].y, xc, yc);
    }
    ctx.lineTo(this.nodes[len - 1].x, this.nodes[len - 1].y);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineWidth = 26 * s;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.stroke();

    ctx.lineWidth = 20 * s;
    ctx.strokeStyle = '#1e112a';
    ctx.stroke();

    ctx.lineWidth = 10 * s;
    ctx.strokeStyle = '#321c46';
    ctx.stroke();

    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = '#fcd34d';
    ctx.setLineDash([6 * s, 8 * s]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  _drawMouthpiece(ctx) {
    const s = this.scale;
    const geom = this.getMouthpieceGeometry();

    ctx.save();
    ctx.translate(geom.baseX, geom.baseY);
    ctx.rotate(geom.angle);

    const handleLength = geom.length;

    const pulseScale = 1.0 + Math.sin(this.beaconPulse) * 0.12;
    const haloRadius = (this.isGrabbed ? 46 : 38) * s * pulseScale;

    ctx.beginPath();
    ctx.arc(handleLength * 0.5, 0, haloRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.isGrabbed ? 'rgba(45, 212, 191, 0.35)' : 'rgba(255, 255, 255, 0.2)';
    ctx.fill();

    ctx.lineWidth = 2.5 * s;
    ctx.strokeStyle = this.isGrabbed ? '#2dd4bf' : '#ffffff';
    ctx.shadowColor = this.isGrabbed ? '#2dd4bf' : '#ffffff';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (!this.isGrabbed) {
      ctx.save();
      ctx.translate(handleLength * 0.5, -46 * s);
      ctx.rotate(-geom.angle);
      ctx.font = `700 ${Math.round(11 * s)}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText('👌 GRAB PIPE', 0, 0);
      ctx.restore();
    }

    const gripGrad = ctx.createLinearGradient(0, -9 * s, 0, 9 * s);
    gripGrad.addColorStop(0, '#451a03');
    gripGrad.addColorStop(0.3, '#9a3412');
    gripGrad.addColorStop(0.7, '#d97706');
    gripGrad.addColorStop(1, '#290e02');

    ctx.fillStyle = gripGrad;
    ctx.beginPath();
    ctx.roundRect(14 * s, -9 * s, 58 * s, 18 * s, 7 * s);
    ctx.fill();
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = '#fed7aa';
    ctx.stroke();

    const goldGrad = ctx.createLinearGradient(0, -10 * s, 0, 10 * s);
    goldGrad.addColorStop(0, '#78350f');
    goldGrad.addColorStop(0.3, '#fef08a');
    goldGrad.addColorStop(0.7, '#d97706');
    goldGrad.addColorStop(1, '#451a03');

    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, -10 * s, 15 * s, 20 * s);
    ctx.strokeStyle = '#fffbeb';
    ctx.strokeRect(0, -10 * s, 15 * s, 20 * s);

    ctx.fillRect(72 * s, -8 * s, 12 * s, 16 * s);

    ctx.beginPath();
    ctx.moveTo(84 * s, -7 * s);
    ctx.lineTo(handleLength, -3.5 * s);
    ctx.lineTo(handleLength, 3.5 * s);
    ctx.lineTo(84 * s, 7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(handleLength, 0, 2.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0502';
    ctx.fill();

    ctx.restore();
  }
}
