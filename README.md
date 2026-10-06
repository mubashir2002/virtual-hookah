# Hookah Gesture Lounge 💨

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision-00897B?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Procedural-blueviolet?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Ready-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg?style=for-the-badge)](LICENSE)

> A virtual, webcam-controlled hookah lounge experience powered by computer vision hand tracking, face tracking, procedural physics, and real-time audio synthesis.  
> **100% Virtual Entertainment & Smoke-Free**.

---

## ✨ Features

- **👌 Natural Hand Tracking**: Pinch your thumb and index finger to grab the mouthpiece; drag to guide the hose naturally in 3D space.
- **🪄 Verlet Physics Hose**: A 24-node Verlet physics simulation with resting catenary curve dynamics.
- **👄 Open-Mouth Exhale Gating**: Hold smoke in virtual lungs until your mouth opens—releasing realistic vapor clouds with natural turbulence.
- **⭕ Toroidal Smoke Rings**: Shape your lips into an "O" shape while exhaling to launch expanding smoke rings.
- **🎵 Romantic Lounge Music**: Procedural Web Audio API sound synthesis playing lush jazz lounge chord progressions (`Fmaj9`, `Dm9`, `Gm9`, `C13sus`, `Bbmaj9`, `Am9/A7alt`) with Fender Rhodes bell chime accents and spatial delay.
- **🫧 Liquid Sound FX**: Real-time synthesized water bubbling, coal sizzling, and soft exhalation whoosh.
- **🍓 4 Signature Flavors**: Fresh Mint, Grape Fusion, Watermelon Chill, and Double Apple with custom vapor tints and vase illumination. Switch anytime via open-palm swipe or keyboard shortcuts.
- **📱 Fully Responsive**: Specially scaled and tested across mobile phones, tablets, and desktop displays.
- **🔒 100% Private & Client-Side**: All camera computer vision runs locally via WebAssembly on your device. No video frames are ever recorded or transmitted.

---

## 🎮 Gesture Controls

| Gesture | Action |
|---|---|
| **Pinch** (Thumb + Index tip) near pipe | **Grab & Hold** mouthpiece |
| **Move Pinching Hand** | **Drag** pipe naturally with physics |
| **Open Hand** | **Release** pipe into resting loop |
| **Bring Pipe to Mouth** | **Inhale** (coals ignite, water bubbles, lungs charge) |
| **Open Mouth (after inhaling)** | **Exhale** realistic vapor clouds |
| **Rounded Lips ("O" shape)** | Launch expanding **smoke rings** |
| **Open-Palm Swipe** (Left / Right) | Cycle hookah **flavor** |

### Keyboard Shortcuts
- `1` / `2` / `3` / `4`: Select Mint, Grape, Watermelon, or Double Apple
- `M`: Toggle audio / romantic music
- `S`: Toggle hand & face vision skeleton mesh overlay

---

## 🚀 Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Modern webcam-enabled browser (Chrome, Edge, Safari, Firefox)

### Setup & Run
```bash
# 1. Clone repository
git clone https://github.com/<your-username>/hookah-gesture-lounge.git
cd hookah-gesture-lounge

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:3000` to run the lounge locally.

---

## ⚡ Deployment to Cloudflare Pages

This project is built and optimized for static hosting on **Cloudflare Pages**.

### Option A: Via Cloudflare Dashboard (Recommended)
1. Push your repository to **GitHub**.
2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages**.
3. Click **Create Application** > **Pages** > **Connect to Git**.
4. Select your `hookah-gesture-lounge` repository.
5. Configure build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
6. Click **Save and Deploy**.

### Option B: Via Wrangler CLI
```bash
# 1. Build production bundle
npm run build

# 2. Deploy directly with Wrangler
npx wrangler pages deploy dist --project-name=hookah-gesture-lounge
```

> **Note on WASM headers**: Pre-configured in `public/_headers` to ensure `.wasm` assets are served with the correct `application/wasm` MIME type and long-term caching.

---

## 📦 Project Structure

```
├── .gitignore          # Git exclusion rules
├── index.html          # HTML structure & glassmorphic interface
├── package.json        # Project metadata & dependencies
├── vite.config.js      # Vite build configuration
├── public/
│   ├── _headers        # Cloudflare Pages MIME & cache configuration
│   ├── favicon.svg     # SVG luxury icon
│   └── wasm/           # MediaPipe local vision WASM binaries
└── src/
    ├── camera.js       # Webcam stream & mirrored video manager
    ├── handTracking.js # MediaPipe HandLandmarker & pinch gesture engine
    ├── faceTracking.js # MediaPipe FaceLandmarker & mouth metrics
    ├── hookah.js       # Hookah model, crystal vase & 24-node Verlet hose
    ├── smoke.js        # Vapor simulation & toroidal smoke rings
    ├── audio.js        # Romantic lounge music & sound FX synthesizer
    ├── ui.js           # Screens, HUD, meter & settings modal
    ├── main.js         # Master 60 FPS vision & render loop coordinator
    └── style.css       # Luxury editorial aesthetic stylesheet & mobile media queries
```

---

## 🛠️ Tech Stack

- **Frontend Build**: [Vite 5](https://vitejs.dev/)
- **Computer Vision**: [@mediapipe/tasks-vision](https://developers.google.com/mediapipe/solutions/vision)
- **Canvas Rendering**: HTML5 Canvas 2D with subpixel interpolation
- **Physics**: 24-point Verlet integration with distance constraint relaxation
- **Audio Synthesis**: Web Audio API (Multi-oscillator detuned analog pads, Fender Rhodes tines, feedback delay line)
- **Typography**: Playfair Display & Plus Jakarta Sans

---

## 🔒 Privacy & Terms

- **Zero Server Uploads**: The camera feed never leaves your browser.
- **Client-Side Only**: All inference happens on device via WebAssembly.
- **Entertainment Purpose**: This application is a creative interactive simulation created strictly for artistic and entertainment purposes.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
