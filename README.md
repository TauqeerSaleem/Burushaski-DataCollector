<!-- # React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project. -->
🎙️ Burushaski Audio Collection App
A Progressive Web App (PWA) built to collect audio recordings of the Burushaski language from native speakers. Designed with offline-first support for use in low-connectivity regions like Hunza, Northern Pakistan.


📖 About
Burushaski is a language isolate spoken primarily in the Hunza-Nagar region of Gilgit-Baltistan, Pakistan. This app was built to facilitate structured audio data collection from native speakers as part of a language documentation effort.
Participants are given a unique ID to log in, select sentence categories, record themselves speaking, review their recordings, and submit — all without needing a stable internet connection.

✨ Features

🔐 Participant login via unique participant ID
📂 Category-based sentence selection — browse and record sentences by topic
🎤 Audio recording directly in the browser
🔁 Playback before submission — listen and re-record if needed
✅ Progress tracking — prevents duplicate submissions
📴 Offline support — works without internet connectivity
🔔 Daily reminders — push notifications to encourage consistent recording (when installed as PWA)
📱 Installable as an app — add to home screen via browser (no App Store required)


🛠️ Tech Stack
LayerTechnologyFrontendReact + ViteStylingTailwind CSSPWAService Workers + Web App ManifestBackendNode.js (in /backend)DeploymentVercel

📲 Installation (as a PWA)
This app does not require the App Store or Play Store. To install it as an app on your device:
Android (Chrome):

Open the app link in Chrome
Tap the three-dot menu → "Add to Home Screen"
Tap "Install"

iOS (Safari):

Open the app link in Safari
Tap the Share button → "Add to Home Screen"
Tap "Add"




Frontend
bashnpm install
npm run dev
Backend
bashcd backend
npm install
npm run dev



📁 Project Structure
├── backend/          # Backend API
├── public/           # Static assets and PWA manifest
├── src/              # React source code
├── index.html        # App entry point
├── vite.config.js    # Vite configuration
├── tailwind.config.js
└── vercel.json       # Deployment config


