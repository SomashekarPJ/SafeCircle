# SafeCircle: AI Cognitive Bridge

SafeCircle is an intuitive, AI-driven assistant designed to restore independence and safety for individuals living with dementia. By leveraging facial recognition, safe-zone monitoring, and real-time caregiver intelligence, SafeCircle acts as a cognitive bridge between patients and their surroundings.

## Key Features

- **Neural Memory Retrieval**: AI-powered object finding and memory assistance.
- **Facial Recognition**: Real-time identification of family members and friends to reduce confusion.
- **Safe-Zone Monitoring**: High-precision geofencing with instant caregiver alerts.
- **Intelligent Briefings**: Daily routines and medication reminders with visual verification.
- **Caregiver Dashboard**: A comprehensive link for monitoring safety and wellness status remotely.

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Framer Motion.
- **Backend**: Express.js, Vite (Full-stack configuration).
- **AI**: Google Gemini API (Pro & Flash models) for vision analysis and emotional support.
- **Database & Auth**: Firebase Firestore and Firebase Authentication.

## Getting Started

1. **Install Dependencies**: `npm install`
2. **Setup Environment**: Copy `.env.example` to `.env` and provide your `GEMINI_API_KEY`.
3. **Run Development Server**: `npm run dev`
4. **Build for Production**: `npm run build`

## Project Structure

- `/src/components`: UI components (Dashboard, Camera, Voice Notes, etc.)
- `/src/services`: Integration logic for Gemini AI and Firebase.
- `/server.ts`: Express server handling API routes and Vite middleware.
- `firestore.rules`: Hardened security rules for data protection.
