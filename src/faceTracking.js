import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class FaceTrackingEngine {
  constructor() {
    this.faceLandmarker = null;
    this.isLoaded = false;
    this.hasFace = false;
    this.mouthPos = { x: 0, y: 0 };
    this.smoothedMouthPos = { x: 0, y: 0 };
    this.mouthOpenness = 0;
    this.isMouthOpen = false;
    this.isLipsRounded = false;
    this.lerpFactor = 0.35;
    this.lastResults = null;
  }

  async init(onProgress = () => {}) {
    if (this.isLoaded) return;

    onProgress('Loading Face Tracking Vision Models...');

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
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

    try {
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true
      });
    } catch (gpuError) {
      console.warn('FaceLandmarker GPU delegate failed, falling back to CPU:', gpuError);
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true
      });
    }

    this.isLoaded = true;
    onProgress('Face Landmarker Ready');
  }

  detect(videoElement, timestamp) {
    if (!this.isLoaded || !this.faceLandmarker || !videoElement || videoElement.readyState < 2) {
      return null;
    }

    try {
      const results = this.faceLandmarker.detectForVideo(videoElement, timestamp);
      this.lastResults = results;
      this._processFace(results);
      return results;
    } catch (e) {
      console.error('FaceLandmarker detection error:', e);
      return null;
    }
  }

  _processFace(results) {
    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
      this.hasFace = false;
      return;
    }

    this.hasFace = true;
    const landmarks = results.faceLandmarks[0];

    const upperLipInner = landmarks[13] || landmarks[0];
    const lowerLipInner = landmarks[14] || landmarks[17];
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];

    const leftCornerX = 1.0 - leftCorner.x;
    const rightCornerX = 1.0 - rightCorner.x;
    const upperX = 1.0 - upperLipInner.x;
    const lowerX = 1.0 - lowerLipInner.x;

    const mouthCenterX = (leftCornerX + rightCornerX + upperX + lowerX) / 4;
    const mouthCenterY = (upperLipInner.y + lowerLipInner.y + leftCorner.y + rightCorner.y) / 4;

    this.mouthPos = { x: mouthCenterX, y: mouthCenterY };

    if (this.smoothedMouthPos.x === 0 && this.smoothedMouthPos.y === 0) {
      this.smoothedMouthPos = { x: mouthCenterX, y: mouthCenterY };
    } else {
      this.smoothedMouthPos.x += (mouthCenterX - this.smoothedMouthPos.x) * this.lerpFactor;
      this.smoothedMouthPos.y += (mouthCenterY - this.smoothedMouthPos.y) * this.lerpFactor;
    }

    const mouthHeight = Math.abs(lowerLipInner.y - upperLipInner.y);
    const mouthWidth = Math.hypot(rightCornerX - leftCornerX, rightCorner.y - leftCorner.y);

    const opennessRatio = mouthHeight / (mouthWidth || 0.001);
    this.mouthOpenness = Math.min(1.0, Math.max(0, (opennessRatio - 0.10) / 0.32));
    this.isMouthOpen = this.mouthOpenness > 0.18 || opennessRatio > 0.18;

    const aspect = mouthWidth / (mouthHeight || 0.001);
    this.isLipsRounded = this.isMouthOpen && aspect >= 1.0 && aspect <= 1.95;
  }

  drawMesh(ctx, canvasWidth, canvasHeight) {
    if (!this.hasFace || !this.lastResults || !this.lastResults.faceLandmarks) return;

    ctx.save();
    const landmarks = this.lastResults.faceLandmarks[0];

    const lipIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];

    ctx.beginPath();
    lipIndices.forEach((idx, i) => {
      const lm = landmarks[idx];
      if (!lm) return;
      const x = (1.0 - lm.x) * canvasWidth;
      const y = lm.y * canvasHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.isMouthOpen ? '#ff5e13' : '#ffb86c';
    ctx.stroke();

    if (this.isMouthOpen) {
      ctx.fillStyle = this.isLipsRounded ? 'rgba(32, 227, 178, 0.25)' : 'rgba(255, 94, 19, 0.2)';
      ctx.fill();
    }

    const cx = this.smoothedMouthPos.x * canvasWidth;
    const cy = this.smoothedMouthPos.y * canvasHeight;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = this.isLipsRounded ? '#20e3b2' : '#ff9a3d';
    ctx.fill();

    ctx.restore();
  }
}
