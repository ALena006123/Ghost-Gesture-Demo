# Tokyo Spirit Gesture

A browser-only Vite + React hand gesture demo inspired by Japanese supernatural action aesthetics. It uses the webcam, MediaPipe hand landmarks, a canvas effects layer, and Web Audio synthesis.

## Features

- Realtime one- or two-hand tracking through the webcam
- Gesture effects:
  - Open palm circle: create one large held ofuda that follows the hand
  - Fist then open palm while holding the ofuda: launch it in the wrist-to-middle-finger direction
  - Two hands forming an O: charge a fireball
  - Release the O shape: fireball launches forward
  - Finger-gun hand: shoot green bullets independently
- Dark urban fantasy interface with neon cyan, blue, and purple effects
- Rotating seal glyphs, rain streaks, and ward-grid atmosphere
- Small mirrored webcam preview
- Current gesture and mode HUD
- Simple synthesized sound effects, no audio files needed

## Run Locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually:

```bash
http://localhost:5173
```

Allow webcam access when the browser asks. The MediaPipe model and WASM files are loaded from public CDNs, so the first launch needs internet access.

## Build

```bash
npm run build
npm run preview
```

## Notes

- Best results come from a well-lit room and keeping one hand clearly inside the camera frame.
- The gesture classifier is intentionally simple for the MVP. It uses MediaPipe hand landmarks and fingertip positions rather than a trained custom gesture model.
- If your browser blocks camera access, use localhost or HTTPS. Webcam APIs are restricted on ordinary insecure origins.
