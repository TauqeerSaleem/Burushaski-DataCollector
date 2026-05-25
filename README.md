# 🎙️ Burushaski Audio Collection App

A Progressive Web App (PWA) built to collect audio recordings of the **Burushaski language** from native speakers. Designed with offline-first support for use in low-connectivity regions like Hunza, Northern Pakistan.

---

## 📖 About

Burushaski is a language isolate spoken primarily in the Hunza-Nagar region of Gilgit-Baltistan, Pakistan. This app was built to facilitate structured audio data collection from native speakers as part of a language documentation effort.

Participants are given a unique ID to log in, select sentence categories, record themselves speaking, review their recordings, and submit — all without needing a stable internet connection.

---

## ✨ Features

- 🔐 **Participant login** via unique participant ID
- 📂 **Category-based sentence selection** — browse and record sentences by topic
- 🎤 **Audio recording** directly in the browser
- 🔁 **Playback before submission** — listen and re-record if needed
- ✅ **Progress tracking** — prevents duplicate submissions
- 📴 **Offline support** — works without internet connectivity
- 🔔 **Daily reminders** — push notifications to encourage consistent recording (when installed as PWA)
- 📱 **Installable as an app** — add to home screen via browser (no App Store required)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| PWA | Service Workers + Web App Manifest |
| Backend | Node.js (in `/backend`) |
| Deployment | Vercel |

---

## 📲 Installation (as a PWA)

This app does not require the App Store or Play Store. To install it as an app on your device:

**Android (Chrome):**
1. Open the app link in Chrome
2. Tap the three-dot menu → "Add to Home Screen"
3. Tap "Install"

**iOS (Safari):**
1. Open the app link in Safari
2. Tap the Share button → "Add to Home Screen"
3. Tap "Add"


---

## 🌍 Why a PWA?

Many of our participants are native Burushaski speakers living in Hunza, a mountainous region in Northern Pakistan with limited and inconsistent internet connectivity. A PWA was the ideal solution because:

- It works **offline** after the first load
- It can be **installed without an app store**
- It runs on both **Android and iOS**
- It is lightweight and works on **low-end devices**

---

## 📁 Project Structure
├── backend/          # Backend API
├── public/           # Static assets and PWA manifest
├── src/              # React source code
├── index.html        # App entry point
├── vite.config.js    # Vite configuration
├── tailwind.config.js
└── vercel.json       # Deployment config
