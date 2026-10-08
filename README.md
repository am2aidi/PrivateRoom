# Private Room: Private Chat Website with No Records

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org)
[![Vite](https://img.shields.io/badge/Vite-React-646CFF.svg)](https://vitejs.dev)

A zero-record, end-to-end encrypted private chat web application with view-once media and modified voice calls. Built according to strict privacy and zero-footprint specifications.

---

## 🔒 Core Privacy Features

- **Zero Database & Zero Storage**: No disk saving, no database, no `localStorage`, no `sessionStorage`, no `cookies`, and no server request logs.
- **RAM-Only Signaling Server**: Active room IDs and socket connections exist strictly in server RAM and are wiped instantly when users leave or idle timeouts occur.
- **End-to-End Encryption (E2EE)**: Key derivation happens locally in the browser via Web Crypto API using PBKDF2 (SHA-256, 100,000 iterations). All text, images, and signals are encrypted using AES-GCM (256-bit). The secret key never leaves your device.
- **Strict 2-Person Limit**: Maximum 2 participants allowed per room ID. Any 3rd person attempting to join is immediately rejected.
- **4-Word Safety Fingerprint**: Generates a 4-word cryptographic safety code from the secret key (e.g. `echo-falcon-velvet-shield`) for manual verification.
- **Delete-After-Read Messages**: Messages feature Sent, Delivered, and Seen status marks. Once seen, a visual countdown timer auto-erases the message from DOM and memory on both ends.
- **View-Once Images**: Images strip EXIF metadata (location, device model, timestamp) via Canvas redrawing before encryption. Images render on `<canvas>` *only while held down and tab is active*, overlaid with a faint moving watermark. Memory buffers are zeroed immediately upon release.
- **WebRTC Voice Calls with Voice Modifier**: Direct P2P audio calls processed in real-time via Web Audio API. Offers `Deep`, `High`, `Robot`, and `Whisper` voice transformation presets, plus dual-effect stacking. Original raw voice never leaves the client device.
- **Strict UI Color Hierarchy**:
  - **Base**: Obsidian dark black theme (`#08080a`).
  - **Green**: Reserved **ONLY** for typing indicators ("typing..." text and active input box glow).
  - **Blue**: Reserved **ONLY** for live/status marks (`Live`, `Connected`, `Seen`, `In call`, `Image opened`).
  - **Soft Red**: Reserved for soft error warnings, leave room, and hang-up controls.

---

## 📂 Repository Structure

```
PrivateRoom/
├── package.json              # Root npm scripts
├── README.md                 # Project documentation & deployment guide
├── backend/                  # Node.js + WebSocket (ws) signaling server
│   ├── package.json
│   └── server.js             # Memory-only room management & message relay
└── frontend/                 # Vite + React E2EE frontend client
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── capacitor.config.json # Android Capacitor app configuration
    └── src/
        ├── App.jsx           # Main application state machine & WebSockets
        ├── styles/
        │   └── global.css    # Dark mode & strict color hierarchy styles
        ├── crypto/
        │   └── webcrypto.js  # PBKDF2 key derivation & AES-GCM encryption
        ├── audio/
        │   └── voiceChanger.js # Web Audio API voice transformation engine
        ├── utils/
        │   ├── webrtc.js     # WebRTC audio calls & DataChannel manager
        │   └── screenshotGuard.js # PrintScreen & tab blur detection
        └── components/
            ├── JoinRoom.jsx       # Room join form & disclaimer
            ├── WaitingRoom.jsx    # Pulsing waiting screen
            ├── ChatRoom.jsx       # Main chat interface & topbar
            ├── MessageBubble.jsx  # Encrypted msg & auto-delete bar
            ├── ViewOnceImage.jsx  # Canvas press-and-hold view-once
            ├── CallOverlay.jsx    # Encrypted voice call & modifier UI
            └── RoomClosed.jsx     # Session wipe completion screen
```

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher

### Step 1: Clone Repository
```bash
git clone https://github.com/am2aidi/PrivateRoom.git
cd PrivateRoom
```

### Step 2: Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 3: Run Backend & Frontend

**Terminal 1 (Backend Server):**
```bash
cd backend
npm run dev
# Server will listen on ws://localhost:8080 (or next free port)
```

**Terminal 2 (Frontend App):**
```bash
cd frontend
npm run dev
# Frontend will open on http://localhost:5173
```

---

## ☁️ Free Deployment Guide

### 1. Backend Server Deployment (Render / Fly.io / Railway)
1. Push your repository to GitHub (`am2aidi/PrivateRoom`).
2. Create a new **Web Service** on [Render](https://render.com) or [Fly.io](https://fly.io).
3. Set Root Directory to `backend`.
4. Set Build Command to `npm install`.
5. Set Start Command to `node server.js`.
6. Render will assign a free URL (e.g., `https://privateroom-backend.onrender.com`).

### 2. Frontend Web App Deployment (Cloudflare Pages / Vercel / Netlify)
1. Create a new site on [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com).
2. Connect your GitHub repository.
3. Set Framework Preset to **Vite**.
4. Set Root Directory to `frontend`.
5. Add Environment Variable:
   - `VITE_WS_URL`: `wss://privateroom-backend.onrender.com` (use your backend WebSockets URL).
6. Deploy! Your private chat site is live.

---

## 📱 Real Android Screenshot Blocking (Capacitor `FLAG_SECURE`)

While browsers cannot completely block OS-level screenshots, building the app with Capacitor on Android enables native screenshot and screen recording blocking via `FLAG_SECURE`.

### Steps:
1. In the `frontend` folder, build the project and add Android:
   ```bash
   npm run build
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   ```
2. Open `android/app/src/main/java/com/privateroom/app/MainActivity.java` and add `FLAG_SECURE`:
   ```java
   package com.privateroom.app;

   import android.os.Bundle;
   import android.view.WindowManager;
   import com.getcapacitor.BridgeActivity;

   public class MainActivity extends BridgeActivity {
       @Override
       protected void onCreate(Bundle savedInstanceState) {
           super.onCreate(savedInstanceState);
           // Block screenshots and screen recordings (displays black screen)
           getWindow().setFlags(
               WindowManager.LayoutParams.FLAG_SECURE,
               WindowManager.LayoutParams.FLAG_SECURE
           );
       }
   }
   ```
3. Sync and build the APK:
   ```bash
   npx cap sync
   npx cap open android
   ```

---

## 🧪 Feature Verification Checklist

| Test Case | Step to Verify | Expected Result |
| :--- | :--- | :--- |
| **Room Join** | Join room `test-room` with password `secret123` on two browser tabs. | Both tabs join and display matching 4-word safety code (e.g. `echo-falcon-velvet-shield`). |
| **Max 2 Limit** | Open a 3rd browser tab and attempt to join `test-room`. | 3rd tab is refused with error `"Room is full (maximum 2 people allowed)"`. |
| **E2EE Chat** | Send text message from Tab A to Tab B. | Tab B receives and decrypts message. Status shows `Sent` -> `Delivered` -> `Seen` (in blue). |
| **Auto-Delete** | Keep Tab B open and visible until message is marked `Seen`. | Progress countdown bar runs; message vanishes from DOM and memory on both tabs after 10s. |
| **View-Once** | Send image from Tab A. Tab B presses and holds dark box. | Image renders on canvas with faint moving watermark. Releasing mouse/touch erases image and marks status `Opened` in blue. |
| **Voice Changer** | Tap Phone icon on Tab A to start call, accept on Tab B. Select `Deep` preset. | Microphones connect via WebRTC; Tab B hears pitch-shifted transformed voice. |
| **Room Closing** | Click `Leave` on Tab A. | Tab B receives `"Room closed. Nothing was saved"` banner and session is wiped. |

---

## 📄 License & Credits

Prepared by: **Zaidi** (Registration Number: 223008014, Year 3 Information Systems, CST University of Rwanda).  
Released under the [MIT License](LICENSE).
