import { FLAVOR_PALETTES } from './smoke.js';

export class UIManager {
  constructor() {
    this.landingScreen = document.getElementById('landing-screen');
    this.loadingScreen = document.getElementById('loading-screen');
    this.errorScreen = document.getElementById('error-screen');
    this.experienceHud = document.getElementById('experience-hud');

    this.loadingStatusText = document.getElementById('loading-status-text');
    this.loadingBarFill = document.getElementById('loading-bar-fill');

    this.errorTitle = document.getElementById('error-title');
    this.errorMessage = document.getElementById('error-message');
    this.btnErrorRetry = document.getElementById('btn-error-retry');
    this.btnErrorDemo = document.getElementById('btn-error-demo');

    this.btnEnableCamera = document.getElementById('btn-enable-camera');
    this.btnMouseDemo = document.getElementById('btn-mouse-demo');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.iconSoundOn = document.getElementById('icon-sound-on');
    this.iconSoundOff = document.getElementById('icon-sound-off');
    this.btnSkeletonToggle = document.getElementById('btn-skeleton-toggle');
    this.btnScreenshot = document.getElementById('btn-screenshot');
    this.btnSettings = document.getElementById('btn-settings');
    this.trackingModeBadge = document.getElementById('hud-tracking-mode');

    this.inhaleMeterFill = document.getElementById('inhale-meter-fill');
    this.inhaleMeterVal = document.getElementById('inhale-meter-val');
    this.inhaleMeterGlow = document.getElementById('inhale-meter-glow');

    this.coachingBanner = document.getElementById('coaching-banner');
    this.coachingText = document.getElementById('coaching-text');
    this.coachingIcon = document.getElementById('coaching-icon');
    this.faceWarning = document.getElementById('face-warning');

    this.activeFlavorBadge = document.getElementById('active-flavor-badge');
    this.flavorBadgeText = document.getElementById('flavor-badge-text');
    this.flavorBtns = document.querySelectorAll('.flavor-btn');

    this.settingsModal = document.getElementById('settings-modal');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.settingMeshToggle = document.getElementById('setting-mesh-toggle');
    this.settingMusicToggle = document.getElementById('setting-music-toggle');
    this.settingReducedMotion = document.getElementById('setting-reduced-motion');
    this.settingSensitivity = document.getElementById('setting-sensitivity');

    this.snapshotFlash = document.getElementById('snapshot-flash');

    this.callbacks = {};

    this._bindEvents();
  }

  on(event, cb) {
    this.callbacks[event] = cb;
  }

  emit(event, ...args) {
    if (this.callbacks[event]) {
      this.callbacks[event](...args);
    }
  }

  _bindEvents() {
    this.btnEnableCamera.addEventListener('click', () => {
      this.emit('start-camera');
    });

    if (this.btnMouseDemo) {
      this.btnMouseDemo.addEventListener('click', () => {
        this.emit('start-mouse-demo');
      });
    }

    if (this.btnErrorRetry) {
      this.btnErrorRetry.addEventListener('click', () => {
        this.emit('start-camera');
      });
    }

    if (this.btnErrorDemo) {
      this.btnErrorDemo.addEventListener('click', () => {
        this.emit('start-mouse-demo');
      });
    }

    this.btnSoundToggle.addEventListener('click', () => {
      this.emit('toggle-sound');
    });

    this.btnSkeletonToggle.addEventListener('click', () => {
      const active = this.btnSkeletonToggle.classList.toggle('active');
      this.settingMeshToggle.checked = active;
      this.emit('toggle-skeleton', active);
    });

    this.btnScreenshot.addEventListener('click', () => {
      this.emit('take-screenshot');
    });

    this.btnSettings.addEventListener('click', () => {
      this.settingsModal.classList.remove('hidden');
    });

    this.btnCloseSettings.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });

    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.settingsModal.classList.add('hidden');
      }
    });

    this.settingMeshToggle.addEventListener('change', (e) => {
      this.btnSkeletonToggle.classList.toggle('active', e.target.checked);
      this.emit('toggle-skeleton', e.target.checked);
    });

    this.settingMusicToggle.addEventListener('change', (e) => {
      this.emit('toggle-music', e.target.checked);
    });

    this.settingReducedMotion.addEventListener('change', (e) => {
      this.emit('toggle-reduced-motion', e.target.checked);
    });

    this.settingSensitivity.addEventListener('input', (e) => {
      this.emit('change-sensitivity', parseFloat(e.target.value));
    });

    this.flavorBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const flavor = btn.dataset.flavor;
        this.emit('change-flavor', flavor);
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        this.emit('toggle-sound');
      } else if (e.key === 's' || e.key === 'S') {
        this.btnSkeletonToggle.click();
      } else if (e.key === '1') {
        this.emit('change-flavor', 'mint');
      } else if (e.key === '2') {
        this.emit('change-flavor', 'grape');
      } else if (e.key === '3') {
        this.emit('change-flavor', 'watermelon');
      } else if (e.key === '4') {
        this.emit('change-flavor', 'double-apple');
      }
    });
  }

  showLoading(text = 'Preparing Experience...') {
    this.landingScreen.classList.remove('active');
    this.errorScreen.classList.remove('active');
    this.experienceHud.classList.add('hidden');
    this.loadingScreen.classList.add('active');
    this.loadingStatusText.textContent = text;
  }

  updateLoadingProgress(text, pct = null) {
    if (this.loadingStatusText) {
      this.loadingStatusText.textContent = text;
    }
    if (pct !== null && this.loadingBarFill) {
      this.loadingBarFill.style.width = `${pct}%`;
    }
  }

  showExperience(mode = 'Camera Active') {
    this.landingScreen.classList.remove('active');
    this.loadingScreen.classList.remove('active');
    this.errorScreen.classList.remove('active');
    this.experienceHud.classList.remove('hidden');
    this.trackingModeBadge.textContent = mode;
  }

  showError(title, message) {
    this.landingScreen.classList.remove('active');
    this.loadingScreen.classList.remove('active');
    this.experienceHud.classList.add('hidden');
    this.errorScreen.classList.add('active');
    this.errorTitle.textContent = title;
    this.errorMessage.textContent = message;
  }

  updateSoundState(isMuted) {
    if (isMuted) {
      this.iconSoundOn.classList.add('hidden');
      this.iconSoundOff.classList.remove('hidden');
      this.btnSoundToggle.classList.remove('active');
    } else {
      this.iconSoundOn.classList.remove('hidden');
      this.iconSoundOff.classList.add('hidden');
      this.btnSoundToggle.classList.add('active');
    }
  }

  updateInhaleMeter(progress) {
    const pct = Math.round(progress * 100);
    this.inhaleMeterFill.style.height = `${pct}%`;
    this.inhaleMeterVal.textContent = `${pct}%`;

    if (pct > 70) {
      this.inhaleMeterGlow.style.boxShadow = 'inset 0 0 16px rgba(32, 227, 178, 0.8)';
    } else if (pct > 20) {
      this.inhaleMeterGlow.style.boxShadow = 'inset 0 0 12px rgba(255, 140, 40, 0.6)';
    } else {
      this.inhaleMeterGlow.style.boxShadow = 'none';
    }
  }

  setFlavor(flavorKey) {
    const palette = FLAVOR_PALETTES[flavorKey];
    if (!palette) return;

    this.activeFlavorBadge.className = `flavor-capsule flavor-${flavorKey}`;
    this.flavorBadgeText.textContent = palette.name;

    this.flavorBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.flavor === flavorKey);
    });
  }

  updateCoaching(state, isMouseMode = false) {
    switch (state) {
      case 'idle':
        this.coachingIcon.textContent = isMouseMode ? '🖱️' : '👌';
        this.coachingText.textContent = isMouseMode
          ? 'Click & drag the pipe mouthpiece'
          : 'Pinch near the pipe mouthpiece to grab it';
        this.coachingBanner.classList.remove('active-drag');
        break;

      case 'grabbed':
        this.coachingIcon.textContent = '👄';
        this.coachingText.textContent = 'Bring mouthpiece close to your mouth to inhale';
        this.coachingBanner.classList.add('active-drag');
        break;

      case 'inhaling':
        this.coachingIcon.textContent = '🔥';
        this.coachingText.textContent = 'Inhaling... holding near mouth fills smoke';
        this.coachingBanner.classList.add('active-drag');
        break;

      case 'mouth-closed':
        this.coachingIcon.textContent = '👄';
        this.coachingText.textContent = isMouseMode
          ? 'Open your mouth to exhale (Click mouth target / Spacebar)'
          : 'Now open your mouth to exhale the smoke!';
        this.coachingBanner.classList.add('active-drag');
        break;

      case 'exhaling':
        this.coachingIcon.textContent = '💨';
        this.coachingText.textContent = 'Exhaling smooth smoke... (round lips for smoke rings)';
        this.coachingBanner.classList.add('active-drag');
        break;
    }
  }

  setFaceWarning(show) {
    if (show) {
      this.faceWarning.classList.remove('hidden');
    } else {
      this.faceWarning.classList.add('hidden');
    }
  }

  triggerFlash() {
    this.snapshotFlash.classList.add('flash-active');
    setTimeout(() => {
      this.snapshotFlash.classList.remove('flash-active');
    }, 150);
  }
}
