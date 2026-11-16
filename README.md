# SafeCircle: AI Cognitive Bridge

**SafeCircle** is a compassionate, full-stack AI companion and safety platform built for individuals living with dementia or Alzheimer's—and the family caregivers who support them. By combining **Gemini-powered vision and conversational intelligence**, **PrecisionFace™ recognition**, **safe-zone geofencing**, **medication verification**, and a **PIN-protected Caregiver Dashboard**, SafeCircle restores daily independence while giving families peace of mind.

---

## Table of Contents

- [Screenshots](#screenshots)
- [Core Mission & Dual-Experience Design](#core-mission--dual-experience-design)
- [Patient Companion Features](#patient-companion-features)
- [Caregiver Portal Features](#caregiver-portal-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Server-Side AI API Endpoints](#server-side-ai-api-endpoints)
- [Firestore Data Model & Security](#firestore-data-model--security)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Building & Publishing](#building--publishing)

---

## Screenshots

### Patient Home & Daily Orientation Dashboard
![SafeCircle Patient Home Dashboard](docs/screenshots/patient-dashboard.jpg)

### PrecisionFace™ AI Lens & Heart Memories Recognition
![SafeCircle PrecisionFace AI Lens](docs/screenshots/ai-lens-recognition.jpg)

### Caregiver Portal & Live Safe-Zone Monitoring
![SafeCircle Caregiver Dashboard](docs/screenshots/caregiver-dashboard.jpg)

---

## Core Mission & Dual-Experience Design

SafeCircle is organized around two seamlessly connected experiences inside one application:

1. **Patient Experience** — A warm, low-friction, dignity-first interface (`#F8F8F5` warm parchment, `#8A9A5B` calming olive accents, generous typography, and voice feedback) designed to orient, reassure, and assist without cognitive overload.
2. **Caregiver Portal** — A PIN-protected command center (`1234` default, customizable in Security settings, with a 3-attempt 5-minute lockout) for live location monitoring, weekly AI health insights, voice-note recording, schedule management, and safety configuration.

---

## Patient Companion Features

- **Warm Welcome & Time Orientation (`DayWidget`, `dateContextUtils.ts`)**
  - Dynamic greeting (`Good morning!`, `Good afternoon!`, `Good evening!`, `It's nighttime.`), day of week, season badge, formatted date, and a gentle grounding sentence updated automatically.
  - Real-time AI companion message box powered by Google Gemini (`gemini-4-hydrogen`) with strict anti-hallucination grounding—only referencing real stored memories, people, and routines.
  - Built-in Text-to-Speech (`speechService.ts`) using the Web Speech API at a calm, slower cadence (`rate: 0.9`).

- **PrecisionFace™ AI Lens (`precisionFace.ts`, `App.tsx`)**
  - Live camera recognition with **Adaptive Contrast Enhancement (ACE)** for low-light environments and pre-flight **brightness & edge-sharpness quality gates** to filter dark, overexposed, or blurry frames before calling AI.
  - **Temporal Confidence Stabilization** across frame history to reduce flicker and improve recognition accuracy.
  - **Adaptive Sample Learning**: Automatically captures and compresses clear high-confidence frames (up to 8 samples per person) to improve future recognition.
  - **Fallback Gallery Upload**: Automatically prompts photo selection if camera access is unavailable or restricted.
  - **Passive Scene Snapshotting (`snapshotService.ts`)**: Periodically captures compressed room snapshots (rolling buffer of up to 50 snapshots) and indexes detected household objects and room guesses for later retrieval.

- **Heart Memories (`App.tsx`, `memoryService.ts`, `ConversationStartersPanel.tsx`)**
  - Visual directory of family members and loved ones with relationship tags, biographies, and up to 5 compressed reference photos per person.
  - One-tap **"Ask about [Name]"** spoken memory recall.
  - AI-generated **Conversation Starters** (`Things to Talk About`) tailored to shared memories, recent life events, and interests—with per-card audio playback.

- **Daily Timeline & Pill Safety Verification (`PillVerificationModal.tsx`, `VoiceNotePlayer.tsx`)**
  - Chronological checklist of daily tasks (`medication`, `exercise`, `meal`, `appointment`, `other`).
  - Completing a medication task triggers **camera-based Pill Verification** against the expected medication description via Gemini multimodal vision, logging verified doses to `medicationLogs`.
  - Automatically plays **family voice notes** attached to routines (`VoiceNotePlayer`) with a heart/like reaction saved to Firestore (`voiceNoteLikes`).

- **Find My Things / Neural Object Finder (`ObjectFinderPanel.tsx`)**
  - Voice-activated (`SpeechRecognition` / `webkitSpeechRecognition`) and one-tap quick-find search (**Glasses**, **Keys**, **Wallet**).
  - Searches recent `sceneSnapshots` with Gemini to pinpoint the most likely room, timestamp, explanation, practical tip, and matching snapshot image.

- **Narrative History (`App.tsx`, `memoryService.ts`)**
  - Chronological life-story timeline where patients or caregivers can log and review meaningful personal and family memories.

- **Daily Mood Check-In (`MoodCheckIn.tsx`)**
  - Gentle daily self-report (`Happy`, `Confused`, `Tired`, `Anxious`) logged once per day to `behaviorLogs` for caregiver trend analysis.

- **Proactive Hydration Reminders (`hydrationService.ts`, `HydrationReminderToast.tsx`)**
  - Configurable interval and active-hour reminders (default every 60 minutes between 8 AM and 8 PM) with one-tap *"I Drank Water!"* logging to `hydrationLogs`.

- **Take Me Home & Safe-Zone Geofencing (`TakeMeHomeButton.tsx`, `locationService.ts`, `geofenceService.ts`)**
  - **Find My Way Home** button fetches the user's current GPS coordinates and opens Google Maps walking directions straight to the saved home location.
  - Continuous background geofence monitoring using the **Haversine distance formula** against `homeLatLng` and `safeZoneRadiusMeters`.
  - If the safe zone is breached (throttled every 10 minutes), logs a `geofence_alerts` record, triggers a `behaviorLogs` event, and displays a calm blue **"You are safe!"** reassurance overlay.

---

## Caregiver Portal Features

- **PIN-Protected Access (`CaregiverPinEntry.tsx`)**
  - 4-digit keypad entry verified against `users/{userId}.caregiverPin` (defaults to `1234` until customized), with shake feedback and automatic 5-minute lockout after 3 failed attempts.

- **AI Weekly Health Insights (`WeeklyReportCard.tsx`, `behaviorTrackingService.ts`)**
  - Aggregates 7 days of `behaviorLogs` (routine completion rate, geofence breaches, hydration logs, mood distribution, session start hours).
  - Generates a plain-English **Weekly Health Report** (`overallTrend`, `highlights`, `concerns`, `recommendations`, and a one-click copyable **Doctor's Summary**) persisted to `weeklyReports`.

- **Live Location & Safe-Zone Map (`MonitoringMap.tsx`)**
  - Powered by `@vis.gl/react-google-maps` (`GOOGLE_MAPS_PLATFORM_KEY`), displaying real-time patient coordinates alongside the Home Base safe-zone marker and online/offline indicator.

- **Family Voice Note Recorder (`VoiceNoteRecorder.tsx`, `voiceNoteService.ts`)**
  - Records up to 60 seconds of WebM audio directly in the browser, previews playback, uploads to **Firebase Storage** (`voiceNotes/{userId}/{routineId}/...`), and links the note to a daily routine.

- **Integrated Management Tabs (`CaregiverDashboard.tsx`)**
  - **Dashboard**: Weekly health insights, recent events timeline, and live monitoring map.
  - **Heart Memories**: Manage loved ones and profile photos.
  - **Care Schedules**: View daily protocols and record routine-specific voice notes.
  - **Find Objects**: Integrated view of `ObjectFinderPanel` for reviewing home snapshots.
  - **Security Settings**: Configure `homeAddress`, `homeLatLng` (`lat`, `lng`), `safeZoneRadiusMeters`, and the 4-digit `caregiverPin`.

---

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), Motion (`motion/react`), Lucide Icons (`lucide-react`).
- **Backend Server**: Express.js (`server.ts`) running on port `3000`, serving Vite middleware in development, static production assets from `dist/` in production, and secure `/api/*` endpoints.
- **Generative AI**: `@google/genai` SDK (`gemini-4-hydrogen`) executed strictly server-side in `server.ts`.
- **Database, Auth & Storage**:
  - **Firebase Authentication** (Google Sign-In via `signInWithPopup`).
  - **Cloud Firestore** (real-time `onSnapshot` listeners + connection verification via `getDocFromServer`).
  - **Firebase Storage** (caregiver audio voice notes).
- **Maps & Speech**: `@vis.gl/react-google-maps` (Google Maps Platform) and Web Speech API (`speechSynthesis` & `SpeechRecognition`).

---

## Server-Side AI API Endpoints

All Gemini API calls are routed through `server.ts` so `GEMINI_API_KEY` stays strictly on the server:

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend health check and AI configuration status |
| `POST` | `/api/ai/chat` | Context-grounded companion conversation response |
| `POST` | `/api/ai/identify-person` | PrecisionFace™ multimodal comparison against Heart Memories |
| `POST` | `/api/ai/verify-pill` | Multimodal pill verification against expected medication |
| `POST` | `/api/ai/conversation-starters` | Generates 3 warm, personalized conversation starters |
| `POST` | `/api/ai/weekly-report` | Synthesizes 7-day behavioral logs into a caregiver health report |
| `POST` | `/api/ai/analyze-scene` | Detects everyday household items and estimates room from a frame |
| `POST` | `/api/ai/find-object` | Matches a lost-item query against recent scene snapshots |

---

## Firestore Data Model & Security

Defined in `firebase-blueprint.json` and enforced by `firestore.rules` (default-deny catch-all, strict ownership via `request.auth.uid == userId`, document ID regex validation, field allowlists on updates, and payload size bounds):

- `/users/{userId}` — User profile & settings (`caregiverPin`, `homeAddress`, `homeLatLng`, `safeZoneRadiusMeters`, hydration preferences, `currentLocation`)
  - `/people/{personId}` — Heart Memories (`name`, `relationship`, `biography`, `imageUrl`, `images[]`, `lastVisit`, `sharedMemories`, `recentEvents`, `interests`)
  - `/memories/{memoryId}` — Narrative History journal entries (`title`, `description`, `date`, `tags`, `isEmotional`)
  - `/routines/{routineId}` — Daily schedule & medication items (`title`, `time`, `type`, `isCompleted`, `notes`, `medicationName`, `pillColor`, `pillShape`, `pillDescription`, `voiceNoteUrl`, `voiceNoteSenderName`)
  - `/behaviorLogs/{logId}` — Interaction & mood telemetry (`type`, `mood`, `routineId`, `hour`, `timestamp`)
  - `/hydrationLogs/{logId}` — Water intake timestamps (`drankAt`)
  - `/medicationLogs/{logId}` — Verified medication adherence logs (`routineId`, `medicationName`, `takenAt`, `verified`)
  - `/sceneSnapshots/{snapshotId}` — Compressed scene captures & detected object tags (`imageBase64`, `sceneDescription`, `itemsDetected`, `roomGuess`, `capturedAt`)
  - `/weeklyReports/{reportId}` — Persisted AI weekly health reports
  - `/voiceNoteLikes/{routineId}` — Patient appreciation reactions on caregiver voice notes
- `/geofence_alerts/{alertId}` — Safe-zone breach alerts (`userId`, `lat`, `lng`, `timestamp`, `resolved`)

---

## Project Structure

```text
SafeCircle/
├── server.ts                          # Express server, /api/ai/* Gemini proxy routes & Vite integration
├── index.html                         # App HTML entry point & SEO/OpenGraph metadata
├── metadata.json                      # App manifest & server-side Gemini capability declaration
├── package.json                       # Dependencies and dev/build/start/lint scripts
├── vite.config.ts                     # Vite + React + Tailwind v4 configuration
├── firebase-applet-config.json        # Firebase project, Auth & Firestore database configuration
├── firebase-blueprint.json            # Canonical Firestore entity & collection blueprint
├── firestore.rules                    # Hardened Firestore security rules
├── .env.example                       # Required environment variables template
├── docs/
│   └── screenshots/                   # UI screenshots embedded in README.md
│       ├── patient-dashboard.jpg
│       ├── ai-lens-recognition.jpg
│       └── caregiver-dashboard.jpg
└── src/
    ├── App.tsx                        # Main Patient Experience, navigation, AI Lens & forms
    ├── main.tsx                       # React entry point
    ├── index.css                      # Global Tailwind v4 theme & custom styles
    ├── types/
    │   └── index.ts                   # TypeScript interfaces for entities, logs & AI responses
    ├── lib/
    │   ├── firebase.ts                # Firebase App, Auth, Firestore & Storage initialization
    │   ├── dateContextUtils.ts        # Time-of-day, greeting, and season helpers
    │   └── utils.ts                   # Classname merge (`cn`) & client-side image compression
    ├── services/
    │   ├── aiService.ts               # Client wrapper calling /api/ai/* server endpoints
    │   ├── precisionFace.ts           # PrecisionFace™ ACE, quality gating & temporal stabilization
    │   ├── memoryService.ts           # Firestore CRUD & real-time onSnapshot subscriptions
    │   ├── behaviorTrackingService.ts # Event logging & 7-day behavioral aggregation
    │   ├── geofenceService.ts         # Haversine safe-zone watch & alert reporting
    │   ├── hydrationService.ts        # Scheduled water reminders & hydration logging
    │   ├── locationService.ts         # Geolocation & Google Maps walking URL builder
    │   ├── snapshotService.ts         # Rolling 50-snapshot scene memory storage & compression
    │   ├── speechService.ts           # Calm Web Speech API narration helper
    │   ├── voiceNoteService.ts        # Firebase Storage upload & audio playback
    │   └── seeder.ts                  # First-run sample people, memories, routines & settings
    └── components/
        ├── CaregiverDashboard.tsx     # PIN-protected caregiver portal & management views
        ├── CaregiverPinEntry.tsx      # 4-digit PIN keypad with lockout protection
        ├── MonitoringMap.tsx          # Live Google Maps patient & safe-zone tracker
        ├── WeeklyReportCard.tsx       # AI weekly health summary & copyable doctor notes
        ├── ObjectFinderPanel.tsx      # Voice/quick-find lost object search & snapshot preview
        ├── PillVerificationModal.tsx  # Camera pill safety check & medication logger
        ├── VoiceNoteRecorder.tsx      # Caregiver browser audio recorder & uploader
        ├── VoiceNotePlayer.tsx        # Patient voice note playback & heart reaction
        ├── ConversationStartersPanel.tsx # AI-suggested conversation prompts per loved one
        ├── HydrationReminderToast.tsx # Timed hydration prompt with progress bar
        ├── MoodCheckIn.tsx            # Daily patient mood self-report card
        ├── TakeMeHomeButton.tsx       # One-tap walking directions home
        └── DayWidget.tsx              # Date, day, season & time orientation card
```

---

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

3. **Run the development server** (runs Express + Vite middleware on port `3000`)
   ```bash
   npm run dev
   ```

4. **Type-check**
   ```bash
   npm run lint
   ```

---

## Environment Variables

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server-only (`server.ts`) | Google Gemini API key used by `/api/ai/*` endpoints |
| `GOOGLE_MAPS_PLATFORM_KEY` | Client build (`vite.config.ts`) | Google Maps JavaScript API key for `MonitoringMap` |

---

## Building & Publishing

1. **Build frontend & server bundle**
   ```bash
   npm run build
   ```
   This compiles the React SPA to `dist/` via Vite and bundles `server.ts` to `dist/server.cjs` via esbuild.

2. **Run in production mode**
   ```bash
   NODE_ENV=production npm start
   ```

3. **Deploy Firestore Security Rules**
   Ensure `firestore.rules` is deployed to your configured Firebase project (`gen-lang-client-0657875929` / database `ai-studio-3acc937f-4519-4b11-8a0f-aab61fe8b655`).
