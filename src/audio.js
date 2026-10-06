export class LoungeAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.isMusicEnabled = true;
    this.isMusicPlaying = false;

    this.bubbleGain = null;
    this.bubbleTimeout = null;
    this.isBubbling = false;

    this.musicGain = null;
    this.reverbDelay = null;
    this.reverbFeedback = null;
    this.reverbFilter = null;
    this.musicTimer = null;

    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) {
      this.resume();
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.bubbleGain = this.ctx.createGain();
      this.bubbleGain.gain.value = 0.0;
      this.bubbleGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.55;
      this.musicGain.connect(this.masterGain);

      this.reverbDelay = this.ctx.createDelay();
      this.reverbDelay.delayTime.value = 0.36;

      this.reverbFeedback = this.ctx.createGain();
      this.reverbFeedback.gain.value = 0.28;

      this.reverbFilter = this.ctx.createBiquadFilter();
      this.reverbFilter.type = 'lowpass';
      this.reverbFilter.frequency.value = 1400;

      this.reverbDelay.connect(this.reverbFilter);
      this.reverbFilter.connect(this.reverbFeedback);
      this.reverbFeedback.connect(this.reverbDelay);
      this.reverbDelay.connect(this.musicGain);

      this.isInitialized = true;
      this.resume();

      if (this.isMusicEnabled) {
        this.startAmbientMusic();
      }
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(mute) {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.85, now, 0.05);
    }
    return this.isMuted;
  }

  toggleMute() {
    return this.setMuted(!this.isMuted);
  }

  setMusicEnabled(enable) {
    this.isMusicEnabled = enable;
    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.setTargetAtTime(enable ? 0.55 : 0, now, 0.15);
    }
    if (enable && !this.isMusicPlaying && this.isInitialized) {
      this.startAmbientMusic();
    } else if (!enable && this.isMusicPlaying) {
      this.stopAmbientMusic();
    }
  }

  startBubbling(intensity = 1.0) {
    if (!this.isInitialized || this.isBubbling) return;
    this.resume();
    this.isBubbling = true;

    const spawnBubble = () => {
      if (!this.isBubbling || !this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      const startFreq = 220 + Math.random() * 260;
      const endFreq = startFreq + 150 + Math.random() * 220;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.06);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(startFreq * 1.5, now);
      filter.Q.value = 4.0;

      const duration = 0.05 + Math.random() * 0.05;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.45 * intensity, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bubbleGain);

      this._playGurgleNoise(now, duration, intensity);

      osc.start(now);
      osc.stop(now + duration);

      const nextDelay = 35 + Math.random() * 50;
      this.bubbleTimeout = setTimeout(spawnBubble, nextDelay);
    };

    if (this.bubbleGain) {
      this.bubbleGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.05);
    }
    spawnBubble();
  }

  _playGurgleNoise(time, duration, intensity) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.05);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450 + Math.random() * 300, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18 * intensity, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.bubbleGain);

    noise.start(time);
  }

  stopBubbling() {
    this.isBubbling = false;
    if (this.bubbleTimeout) {
      clearTimeout(this.bubbleTimeout);
      this.bubbleTimeout = null;
    }
    if (this.bubbleGain && this.ctx) {
      this.bubbleGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  playExhale(duration = 1.2, volume = 0.7) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.95 * b1 + white * 0.1;
      b2 = 0.85 * b2 + white * 0.2;
      data[i] = (b0 + b1 + b2) * 0.35;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(750, now + duration * 0.3);
    filter.frequency.exponentialRampToValueAtTime(280, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.4 * volume, now + duration * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
  }

  playCoalCrackle() {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 + Math.random() * 800, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  _playRhodesTine(freq, time, volume = 0.038) {
    if (!this.ctx || !this.isMusicEnabled || this.isMuted) return;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, time);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.756, time);

    const tineGain = this.ctx.createGain();
    tineGain.gain.setValueAtTime(0.0001, time);
    tineGain.gain.linearRampToValueAtTime(volume, time + 0.015);
    tineGain.gain.exponentialRampToValueAtTime(0.0001, time + 1.8);

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.setValueAtTime(volume * 0.16, time);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);

    osc1.connect(tineGain);
    osc2.connect(overtoneGain);
    overtoneGain.connect(tineGain);

    tineGain.connect(this.musicGain);
    if (this.reverbDelay) {
      tineGain.connect(this.reverbDelay);
    }

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 1.85);
    osc2.stop(time + 0.5);
  }

  startAmbientMusic() {
    if (!this.ctx || this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.resume();

    const romanticChords = [
      {
        name: 'Fmaj9',
        bass: 87.31,
        harmony: [130.81, 164.81, 196.00, 220.00, 261.63],
        tines: [
          { freq: 261.63, delay: 0.3 },
          { freq: 329.63, delay: 2.2 },
          { freq: 392.00, delay: 4.0 }
        ]
      },
      {
        name: 'Dm9',
        bass: 73.42,
        harmony: [110.00, 130.81, 146.83, 174.61, 220.00],
        tines: [
          { freq: 220.00, delay: 0.4 },
          { freq: 349.23, delay: 2.4 },
          { freq: 329.63, delay: 4.2 }
        ]
      },
      {
        name: 'Gm9',
        bass: 98.00,
        harmony: [116.54, 146.83, 174.61, 220.00, 293.66],
        tines: [
          { freq: 293.66, delay: 0.3 },
          { freq: 233.08, delay: 2.2 },
          { freq: 261.63, delay: 4.0 }
        ]
      },
      {
        name: 'C13sus',
        bass: 65.41,
        harmony: [116.54, 146.83, 174.61, 220.00, 261.63],
        tines: [
          { freq: 196.00, delay: 0.4 },
          { freq: 220.00, delay: 2.3 },
          { freq: 329.63, delay: 4.1 }
        ]
      },
      {
        name: 'Bbmaj9',
        bass: 116.54,
        harmony: [146.83, 174.61, 220.00, 261.63, 293.66],
        tines: [
          { freq: 293.66, delay: 0.3 },
          { freq: 349.23, delay: 2.2 },
          { freq: 440.00, delay: 4.0 }
        ]
      },
      {
        name: 'Am9 / A7alt',
        bass: 110.00,
        harmony: [130.81, 164.81, 196.00, 246.94, 293.66],
        tines: [
          { freq: 329.63, delay: 0.4 },
          { freq: 293.66, delay: 2.3 },
          { freq: 246.94, delay: 4.1 }
        ]
      }
    ];

    let chordIdx = 0;
    const chordDuration = 5.8;

    const scheduleNextChord = () => {
      if (!this.isMusicEnabled || !this.ctx || !this.isMusicPlaying) return;

      const chord = romanticChords[chordIdx];
      chordIdx = (chordIdx + 1) % romanticChords.length;
      const now = this.ctx.currentTime;

      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      const bassFilter = this.ctx.createBiquadFilter();

      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(chord.bass, now);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(140, now);

      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.linearRampToValueAtTime(0.08, now + 1.2);
      bassGain.gain.setValueAtTime(0.08, now + chordDuration - 1.5);
      bassGain.gain.linearRampToValueAtTime(0.0001, now + chordDuration);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicGain);

      bassOsc.start(now);
      bassOsc.stop(now + chordDuration + 0.1);

      chord.harmony.forEach((freq, i) => {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const voiceGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq, now);
        osc2.detune.setValueAtTime((i % 2 === 0 ? 5 : -5), now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, now);
        filter.frequency.linearRampToValueAtTime(620, now + chordDuration * 0.45);
        filter.frequency.linearRampToValueAtTime(360, now + chordDuration);

        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.linearRampToValueAtTime(0.036, now + 1.6);
        voiceGain.gain.setValueAtTime(0.036, now + chordDuration - 1.6);
        voiceGain.gain.linearRampToValueAtTime(0.0001, now + chordDuration);

        osc1.connect(voiceGain);
        osc2.connect(voiceGain);
        voiceGain.connect(filter);
        filter.connect(this.musicGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + chordDuration + 0.1);
        osc2.stop(now + chordDuration + 0.1);
      });

      chord.tines.forEach((tine) => {
        this._playRhodesTine(tine.freq, now + tine.delay, 0.06);
      });

      this.musicTimer = setTimeout(scheduleNextChord, (chordDuration - 1.2) * 1000);
    };

    scheduleNextChord();
  }

  stopAmbientMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
