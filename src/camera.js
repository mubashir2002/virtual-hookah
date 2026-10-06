export class CameraManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.isActive = false;
    this.facingMode = 'user';
    this.width = 1280;
    this.height = 720;
  }

  async start() {
    if (this.isActive && this.stream) {
      return { success: true, video: this.video };
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support webcam access (getUserMedia).');
    }

    try {
      const constraints = {
        audio: false,
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(() => {
            this.width = this.video.videoWidth || 1280;
            this.height = this.video.videoHeight || 720;
            this.isActive = true;
            resolve();
          });
        };
      });

      return { success: true, video: this.video, width: this.width, height: this.height };
    } catch (err) {
      this.isActive = false;
      let userFriendlyMessage = 'Camera access was denied or unavailable.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendlyMessage = 'Permission to access your webcam was denied. Please allow camera permissions in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userFriendlyMessage = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userFriendlyMessage = 'Camera is already in use by another application.';
      }
      const error = new Error(userFriendlyMessage);
      error.original = err;
      throw error;
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.isActive = false;
  }

  async switchCamera() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.stop();
    return await this.start();
  }
}
