import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

export class HandTrackingEngine {
  constructor() {
    this.handLandmarker = null;
    this.isLoaded = false;
    this.isPinching = false;
    this.pinchPos = { x: 0, y: 0 };
    this.smoothedPinchPos = { x: 0, y: 0 };
    this.pinchThreshold = 0.65;
    this.lerpFactor = 0.45;
    this.swipeHistory = [];
    this.lastSwipeTime = 0;
    this.onSwipeCallback = null;
    this.lastResults = null;
  }

  async init(onProgress = () => {}) {
    if (this.isLoaded) return;

    onProgress('Loading Hand Tracking Vision Models...');

    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks('/wasm');
    } catch (e) {
      console.warn('Local WASM fallback to CDN:', e);
      vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
    }

    const modelAssetPath =
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

    try {
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45
      });
    } catch (gpuError) {
      console.warn('HandLandmarker GPU delegate failed, falling back to CPU:', gpuError);
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45
      });
    }

    this.isLoaded = true;
    onProgress('Hand Landmarker Ready');
  }

  setPinchSensitivity(val) {
    this.pinchThreshold = val;
  }

  onSwipe(cb) {
    this.onSwipeCallback = cb;
  }

  detect(videoElement, timestamp) {
    if (!this.isLoaded || !this.handLandmarker || !videoElement || videoElement.readyState < 2) {
      return null;
    }

    try {
      const results = this.handLandmarker.detectForVideo(videoElement, timestamp);
      this.lastResults = results;
      this._processGestures(results, timestamp);
      return results;
    } catch (e) {
      console.error('HandLandmarker detection error:', e);
      return null;
    }
  }

  _processGestures(results, timestamp) {
    if (!results || !results.landmarks || results.landmarks.length === 0) {
      this.isPinching = false;
      return;
    }

    let foundPinch = false;
    let closestPinchDist = Infinity;
    let bestPinchPos = null;

    results.landmarks.forEach((landmarks) => {
      const thumb = landmarks[4];
      const index = landmarks[8];
      const wrist = landmarks[0];
      const middleMCP = landmarks[9];

      const thumbX = 1.0 - thumb.x;
      const indexX = 1.0 - index.x;
      const wristX = 1.0 - wrist.x;
      const middleMCPX = 1.0 - middleMCP.x;

      const pinchDx = thumbX - indexX;
      const pinchDy = thumb.y - index.y;
      const rawPinchDist = Math.hypot(pinchDx, pinchDy);

      const scaleDx = wristX - middleMCPX;
      const scaleDy = wrist.y - middleMCP.y;
      const handScale = Math.hypot(scaleDx, scaleDy) || 0.12;

      const normalizedPinch = rawPinchDist / handScale;
      const isPinchActive = normalizedPinch < this.pinchThreshold || rawPinchDist < 0.085;

      if (isPinchActive) {
        foundPinch = true;
        if (normalizedPinch < closestPinchDist) {
          closestPinchDist = normalizedPinch;
          bestPinchPos = {
            x: (thumbX + indexX) / 2,
            y: (thumb.y + index.y) / 2
          };
        }
      } else if (!foundPinch && !bestPinchPos) {
        bestPinchPos = {
          x: (thumbX + indexX) / 2,
          y: (thumb.y + index.y) / 2
        };
      }

      this._checkSwipeGesture(landmarks, timestamp, handScale);
    });

    this.isPinching = foundPinch;
    if (bestPinchPos) {
      this.pinchPos = bestPinchPos;
      if (this.smoothedPinchPos.x === 0 && this.smoothedPinchPos.y === 0) {
        this.smoothedPinchPos = { ...bestPinchPos };
      } else {
        this.smoothedPinchPos.x += (bestPinchPos.x - this.smoothedPinchPos.x) * this.lerpFactor;
        this.smoothedPinchPos.y += (bestPinchPos.y - this.smoothedPinchPos.y) * this.lerpFactor;
      }
    }
  }

  _checkSwipeGesture(landmarks, timestamp, handScale) {
    if (timestamp - this.lastSwipeTime < 600) return;

    const isIndexOpen = landmarks[8].y < landmarks[6].y;
    const isMiddleOpen = landmarks[12].y < landmarks[10].y;
    const isRingOpen = landmarks[16].y < landmarks[14].y;
    const isPinkyOpen = landmarks[20].y < landmarks[18].y;

    if (!(isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen)) {
      return;
    }

    const palmX = 1.0 - landmarks[9].x;
    this.swipeHistory.push({ x: palmX, time: timestamp });

    this.swipeHistory = this.swipeHistory.filter((entry) => timestamp - entry.time <= 250);

    if (this.swipeHistory.length >= 3) {
      const oldest = this.swipeHistory[0];
      const newest = this.swipeHistory[this.swipeHistory.length - 1];
      const deltaX = newest.x - oldest.x;
      const deltaTime = (newest.time - oldest.time) / 1000;

      if (deltaTime > 0.05) {
        const velocity = deltaX / deltaTime;
        const speedThreshold = 0.85;

        if (velocity > speedThreshold) {
          this.lastSwipeTime = timestamp;
          this.swipeHistory = [];
          if (this.onSwipeCallback) this.onSwipeCallback('right');
        } else if (velocity < -speedThreshold) {
          this.lastSwipeTime = timestamp;
          this.swipeHistory = [];
          if (this.onSwipeCallback) this.onSwipeCallback('left');
        }
      }
    }
  }

  drawHandCursor(ctx, canvasWidth, canvasHeight) {
    if (!this.smoothedPinchPos.x || !this.smoothedPinchPos.y) return;
    const x = this.smoothedPinchPos.x * canvasWidth;
    const y = this.smoothedPinchPos.y * canvasHeight;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, this.isPinching ? 18 : 12, 0, Math.PI * 2);
    ctx.fillStyle = this.isPinching ? 'rgba(45, 212, 191, 0.45)' : 'rgba(248, 250, 252, 0.25)';
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = this.isPinching ? '#2dd4bf' : '#f8fafc';
    ctx.shadowColor = this.isPinching ? '#2dd4bf' : '#f8fafc';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  drawSkeleton(ctx, canvasWidth, canvasHeight) {
    if (!this.lastResults || !this.lastResults.landmarks) return;

    ctx.save();
    this.lastResults.landmarks.forEach((landmarks) => {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.65)';
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];

        const x1 = (1.0 - p1.x) * canvasWidth;
        const y1 = p1.y * canvasHeight;
        const x2 = (1.0 - p2.x) * canvasWidth;
        const y2 = p2.y * canvasHeight;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      landmarks.forEach((lm, idx) => {
        const x = (1.0 - lm.x) * canvasWidth;
        const y = lm.y * canvasHeight;

        ctx.beginPath();
        ctx.arc(x, y, idx === 4 || idx === 8 ? 6 : 3.5, 0, Math.PI * 2);
        if (idx === 4 || idx === 8) {
          ctx.fillStyle = this.isPinching ? '#2dd4bf' : '#ffffff';
          ctx.strokeStyle = '#2dd4bf';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#cbd5e1';
        }
        ctx.fill();
      });
    });

    ctx.restore();
  }
}
