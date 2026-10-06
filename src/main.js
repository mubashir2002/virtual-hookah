import { CameraManager } from './camera.js';
import { HandTrackingEngine } from './handTracking.js';
import { FaceTrackingEngine } from './faceTracking.js';
import { Hookah } from './hookah.js';
import { SmokeSystem, FLAVOR_PALETTES } from './smoke.js';
import { LoungeAudioEngine } from './audio.js';
import { UIManager } from './ui.js';

class HookahLoungeApp {
  constructor() {
    this.canvas = document.getElementById('experience-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.video = document.getElementById('webcam-video');

    this.camera = new CameraManager(this.video);
    this.hands = new HandTrackingEngine();
    this.faces = new FaceTrackingEngine();
    this.audio = new LoungeAudioEngine();
    this.smoke = new SmokeSystem();
    this.ui = new UIManager();
    this.hookah = null;

    this.isRunning = false;
    this.isMouseMode = false;
    this.showSkeleton = false;
    this.reducedMotion = false;

    this.inhaleMeter = 0.0;
    this.smokeInLungs = 0.0;
    this.isInhaling = false;
    this.isExhaling = false;
    this.isDemoMouthOpen = false;
    this.lastRingTime = 0;
    this.lastFrameTime = performance.now();

    this.mousePos = { x: 0, y: 0 };
    this.isMouseDown = false;
    this.isGrabbedByMouse = false;
    this.isGrabbedByHand = false;

    this.demoFacePos = { x: 0.5, y: 0.35 };

    this.dpr = 1;
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.frameCount = 0;

    this._setupResize();
    this._setupEvents();
  }

  _setupResize() {
    const handleResize = () => {
      const vv = window.visualViewport;
      const width = Math.round(vv ? vv.width : window.innerWidth);
      const height = Math.round(vv ? vv.height : window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.viewW = width;
      this.viewH = height;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!this.hookah) {
        this.hookah = new Hookah(width, height);
      } else {
        this.hookah.resize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 200));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    handleResize();
  }

  _setupEvents() {
    this.ui.on('start-camera', async () => {
      this.audio.init();
      await this.startCameraMode();
    });

    this.ui.on('start-mouse-demo', () => {
      this.audio.init();
      this.startMouseDemoMode();
    });

    this.ui.on('toggle-sound', () => {
      this.audio.init();
      const isMuted = this.audio.toggleMute();
      this.ui.updateSoundState(isMuted);
    });

    this.ui.on('toggle-skeleton', (active) => {
      this.showSkeleton = active;
    });

    this.ui.on('toggle-music', (active) => {
      this.audio.setMusicEnabled(active);
    });

    this.ui.on('toggle-reduced-motion', (active) => {
      this.reducedMotion = active;
    });

    this.ui.on('change-sensitivity', (val) => {
      this.hands.setPinchSensitivity(val);
    });

    this.ui.on('change-flavor', (flavorKey) => {
      this.setFlavor(flavorKey);
    });

    this.ui.on('take-screenshot', () => {
      this.takeScreenshot();
    });

    const flavorKeys = ['mint', 'grape', 'watermelon', 'double-apple'];
    this.hands.onSwipe((dir) => {
      const currentIdx = flavorKeys.indexOf(this.smoke.currentFlavorKey);
      let nextIdx;
      if (dir === 'right') {
        nextIdx = (currentIdx + 1) % flavorKeys.length;
      } else {
        nextIdx = (currentIdx - 1 + flavorKeys.length) % flavorKeys.length;
      }
      this.setFlavor(flavorKeys[nextIdx]);
    });

    const updatePointerPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      this.mousePos.x = clientX - rect.left;
      this.mousePos.y = clientY - rect.top;
    };

    const handlePointerDown = (e) => {
      if (!this.isRunning) return;
      updatePointerPos(e);
      this.isMouseDown = true;

      if (this.hookah && this.hookah.isNearMouthpiece(this.mousePos.x, this.mousePos.y, 140)) {
        this.isGrabbedByMouse = true;
        this.isGrabbedByHand = false;
        this.hookah.grab(this.mousePos.x, this.mousePos.y);
      } else if (this.isMouseMode) {
        this.isDemoMouthOpen = !this.isDemoMouthOpen;
      }
    };

    const handlePointerMove = (e) => {
      if (!this.isRunning) return;
      updatePointerPos(e);

      if (this.hookah) {
        const isNear = this.hookah.isNearMouthpiece(this.mousePos.x, this.mousePos.y, 140);
        this.hookah.setHovered(isNear || this.isGrabbedByMouse || this.isGrabbedByHand);

        if (this.isMouseDown && this.isGrabbedByMouse) {
          this.hookah.updateGrab(this.mousePos.x, this.mousePos.y);
        }
      }
    };

    const handlePointerUp = () => {
      this.isMouseDown = false;
      if (this.isGrabbedByMouse) {
        this.isGrabbedByMouse = false;
        if (!this.isGrabbedByHand && this.hookah) {
          this.hookah.release();
        }
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    window.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.isMouseMode) {
        this.isDemoMouthOpen = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.isMouseMode) {
        this.isDemoMouthOpen = false;
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audio.setMuted(true);
      } else {
        this.audio.setMuted(false);
      }
    });
  }

  setFlavor(flavorKey) {
    if (!FLAVOR_PALETTES[flavorKey]) return;
    this.smoke.setFlavor(flavorKey);
    const palette = FLAVOR_PALETTES[flavorKey];
    this.hookah.setFlavorColor(palette.glow, palette.rgb);
    this.ui.setFlavor(flavorKey);
    this.audio.playCoalCrackle();
  }

  async startCameraMode() {
    try {
      this.ui.showLoading('Requesting camera permissions...');
      await this.camera.start();

      this.ui.updateLoadingProgress('Loading hand and face vision models...', 40);
      await Promise.all([
        this.hands.init((msg) => this.ui.updateLoadingProgress(msg, 65)),
        this.faces.init((msg) => this.ui.updateLoadingProgress(msg, 90))
      ]);

      this.ui.updateLoadingProgress('Igniting the lounge coals...', 100);
      setTimeout(() => {
        this.isMouseMode = false;
        this.isRunning = true;
        this.ui.showExperience('Camera Tracking Active');
        this.setFlavor('mint');
        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
      }, 500);
    } catch (err) {
      console.error('Failed to start camera mode:', err);
      this.ui.showError(
        'Camera Access Required',
        err.message || 'We were unable to access your webcam.'
      );
    }
  }

  startMouseDemoMode() {
    this.isMouseMode = true;
    this.isRunning = true;
    this.camera.stop();
    this.ui.showExperience('Mouse / Touch Mode');
    this.setFlavor('mint');
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(timestamp) {
    if (!this.isRunning) return;

    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = timestamp;

    const cw = this.viewW;
    const ch = this.viewH;
    this.frameCount++;

    let mouthX = this.demoFacePos.x * cw;
    let mouthY = this.demoFacePos.y * ch;
    let isFaceDetected = false;
    let isMouthOpen = false;
    let isLipsRounded = false;

    if (!this.isMouseMode && this.camera.isActive) {
      this.hands.detect(this.video, timestamp);
      if (this.frameCount % 2 === 0) {
        this.faces.detect(this.video, timestamp);
      }

      isFaceDetected = this.faces.hasFace;
      if (isFaceDetected) {
        mouthX = this.faces.smoothedMouthPos.x * cw;
        mouthY = this.faces.smoothedMouthPos.y * ch;
        isMouthOpen = this.faces.isMouthOpen;
        isLipsRounded = this.faces.isLipsRounded;
      }
    } else {
      isFaceDetected = true;
      const isPortrait = cw < 768 || cw < ch;
      mouthX = isPortrait ? cw * 0.46 : cw * 0.42;
      mouthY = isPortrait ? ch * 0.28 : ch * 0.35;
      isMouthOpen = this.isDemoMouthOpen;
      isLipsRounded = true;
    }

    if (this.isMouseDown && this.isGrabbedByMouse) {
      this.hookah.updateGrab(this.mousePos.x, this.mousePos.y);
    } else if (!this.isMouseMode) {
      if (this.hands.isPinching) {
        const pinchCanvasX = this.hands.smoothedPinchPos.x * cw;
        const pinchCanvasY = this.hands.smoothedPinchPos.y * ch;

        if (!this.hookah.isGrabbed) {
          const isNear = this.hookah.isNearMouthpiece(pinchCanvasX, pinchCanvasY, 140);
          this.hookah.setHovered(isNear);
          if (isNear) {
            this.isGrabbedByHand = true;
            this.hookah.grab(pinchCanvasX, pinchCanvasY);
          }
        } else if (this.isGrabbedByHand) {
          this.hookah.updateGrab(pinchCanvasX, pinchCanvasY);
        }
      } else {
        if (this.isGrabbedByHand) {
          this.isGrabbedByHand = false;
          this.hookah.release();
        }

        if (this.hands.smoothedPinchPos.x && this.hands.smoothedPinchPos.y) {
          const handX = this.hands.smoothedPinchPos.x * cw;
          const handY = this.hands.smoothedPinchPos.y * ch;
          this.hookah.setHovered(this.hookah.isNearMouthpiece(handX, handY, 140));
        }
      }
    }

    const nozzle = this.hookah.getNozzleTipPosition();
    const distToMouth = Math.hypot(nozzle.x - mouthX, nozzle.y - mouthY);
    const inhaleThreshold = 140 * this.hookah.scale;

    const isNearMouth = isFaceDetected && distToMouth < inhaleThreshold;

    if (isNearMouth && this.hookah.isGrabbed) {
      if (!this.isInhaling) {
        this.isInhaling = true;
        this.audio.startBubbling();
      }

      this.inhaleMeter = Math.min(1.0, this.inhaleMeter + dt * 0.42);
      this.hookah.setSmoking(true, this.inhaleMeter);
      this.ui.updateInhaleMeter(this.inhaleMeter);
      this.ui.updateCoaching('inhaling', this.isMouseMode);

      if (Math.random() > 0.6) {
        this.audio.playCoalCrackle();
      }
    } else {
      if (this.isInhaling) {
        this.isInhaling = false;
        this.audio.stopBubbling();
        this.hookah.setSmoking(false);

        if (this.inhaleMeter > 0.12) {
          this.smokeInLungs = this.inhaleMeter;
          this.inhaleMeter = 0.0;
          this.ui.updateInhaleMeter(0.0);
          if (this.isMouseMode) {
            this.isDemoMouthOpen = true;
          }
        }
      }

      if (this.smokeInLungs > 0.01) {
        if (isMouthOpen) {
          if (!this.isExhaling) {
            this.isExhaling = true;
            this.audio.playExhale(2.4, this.smokeInLungs);
          }

          this.smoke.emitContinuousPlume(mouthX, mouthY, this.smokeInLungs, 3);
          this.smokeInLungs = Math.max(0, this.smokeInLungs - dt * 0.36);

          if (isLipsRounded && (timestamp - this.lastRingTime > 680)) {
            this.lastRingTime = timestamp;
            this.smoke.emitSmokeRing(mouthX, mouthY, { x: 0, y: -0.8 });
          }

          this.ui.updateCoaching('exhaling', this.isMouseMode);
        } else {
          this.isExhaling = false;
          this.ui.updateCoaching('mouth-closed', this.isMouseMode);
        }
      } else {
        this.isExhaling = false;
        if (this.hookah.isGrabbed) {
          this.ui.updateCoaching('grabbed', this.isMouseMode);
        } else {
          this.ui.updateCoaching('idle', this.isMouseMode);
        }
      }
    }

    const isPipeHigh = nozzle.y < ch * 0.55;
    if (this.hookah.isGrabbed && isPipeHigh && !isFaceDetected && !this.isMouseMode) {
      this.ui.setFaceWarning(true);
    } else {
      this.ui.setFaceWarning(false);
    }

    this.hookah.update(dt, this.isInhaling);
    this.smoke.update(dt);

    const bowlPos = this.hookah.getBowlPosition();
    this.smoke.emitBowlWisp(bowlPos.x, bowlPos.y);

    this._renderCanvas(cw, ch, mouthX, mouthY, isFaceDetected);

    requestAnimationFrame((t) => this.loop(t));
  }

  _renderCanvas(cw, ch, mouthX, mouthY, isFaceDetected) {
    this.ctx.clearRect(0, 0, cw, ch);

    if (this.camera.isActive && !this.isMouseMode) {
      this.ctx.save();
      this.ctx.translate(cw, 0);
      this.ctx.scale(-1, 1);

      const vw = this.video.videoWidth || 1280;
      const vh = this.video.videoHeight || 720;
      const videoRatio = vw / vh;
      const canvasRatio = cw / ch;

      let drawW = cw;
      let drawH = ch;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasRatio > videoRatio) {
        drawH = cw / videoRatio;
        offsetY = (ch - drawH) / 2;
      } else {
        drawW = ch * videoRatio;
        offsetX = (cw - drawW) / 2;
      }

      this.ctx.drawImage(this.video, offsetX, offsetY, drawW, drawH);

      this.ctx.fillStyle = 'rgba(10, 6, 18, 0.45)';
      this.ctx.fillRect(0, 0, cw, ch);

      this.ctx.restore();
    } else {
      const bgGrad = this.ctx.createLinearGradient(0, 0, 0, ch);
      bgGrad.addColorStop(0, '#0c0715');
      bgGrad.addColorStop(0.5, '#07030b');
      bgGrad.addColorStop(1, '#030106');
      this.ctx.fillStyle = bgGrad;
      this.ctx.fillRect(0, 0, cw, ch);

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(mouthX, mouthY, 28, 0, Math.PI * 2);
      this.ctx.lineWidth = 2.5;
      const isOpen = this.isDemoMouthOpen;
      this.ctx.strokeStyle = this.isInhaling ? '#2dd4bf' : (isOpen ? '#38bdf8' : 'rgba(255, 255, 255, 0.65)');
      this.ctx.fillStyle = this.isInhaling ? 'rgba(45, 212, 191, 0.25)' : (isOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)');
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
      this.ctx.shadowBlur = 6;
      const label = this.isInhaling
        ? '🔥 INHALING...'
        : (isOpen ? '💨 MOUTH OPEN (EXHALING)' : '👄 MOUTH TARGET (CLICK TO OPEN)');
      this.ctx.fillText(label, mouthX, mouthY - 38);
      this.ctx.restore();
    }

    this.hookah.draw(this.ctx);
    this.smoke.draw(this.ctx, this.dpr);

    if (!this.isMouseMode && this.camera.isActive) {
      this.hands.drawHandCursor(this.ctx, cw, ch);
    }

    if (this.showSkeleton && !this.isMouseMode) {
      this.hands.drawSkeleton(this.ctx, cw, ch);
      this.faces.drawMesh(this.ctx, cw, ch);
    }
  }

  takeScreenshot() {
    this.ui.triggerFlash();
    this.audio.playCoalCrackle();

    setTimeout(() => {
      try {
        const link = document.createElement('a');
        link.download = `hookah-gesture-lounge-${Date.now()}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
      } catch (e) {
        console.error('Screenshot capture failed:', e);
      }
    }, 80);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new HookahLoungeApp();
});
