export interface Person {
  id?: string;
  name: string;
  relationship: string;
  biography?: string;
  lastVisit?: string;
  imageUrl?: string;
  images?: string[]; // Multiple photos for better recognition
  sharedMemories?: string[];
  recentEvents?: string[];
  interests?: string[];
}

export interface Memory {
  id?: string;
  title: string;
  description: string;
  date: string;
  tags?: string[];
  isEmotional?: boolean;
  people?: string[];
  emotionalTone?: string;
}

export interface Routine {
  id?: string;
  title: string;
  time: string;
  type: 'medication' | 'exercise' | 'meal' | 'appointment' | 'other';
  isCompleted: boolean;
  notes?: string;
  medicationName?: string;
  pillColor?: string;
  pillShape?: string;
  pillDescription?: string;
  voiceNoteUrl?: string;
  voiceNoteSenderName?: string;
}

export interface HomeLocation {
  address: string;
  lat: number;
  lng: number;
}

export interface PillVerificationResult {
  isMatch: boolean;
  confidence: 'high' | 'medium' | 'low';
  message: string;
}

export interface MedicationLog {
  routineId: string;
  medicationName: string;
  takenAt: any;
  verified: boolean;
}

export interface GeofenceAlert {
  userId: string;
  lat: number;
  lng: number;
  timestamp: any; // Firestore Timestamp
  resolved: boolean;
}

export interface HydrationSettings {
  hydrationEnabled: boolean;
  hydrationIntervalMinutes: number;
  hydrationStartHour: number;
  hydrationEndHour: number;
}

export interface HydrationLog {
  drankAt: any; // Firestore Timestamp
}

export interface VoiceNote {
  url: string;
  senderName: string;
  uploadedAt: any;
}

export type InteractionEvent =
  | { type: 'routine_completed'; routineId: string; completedAt: string }
  | { type: 'routine_skipped'; routineId: string }
  | { type: 'pill_verified'; routineId: string; isMatch: boolean }
  | { type: 'hydration_logged' }
  | { type: 'navigation_used' } // Take Me Home button used
  | { type: 'geofence_breach' }
  | { type: 'session_start'; hour: number }
  | { type: 'mood_self_report'; mood: 'happy' | 'confused' | 'tired' | 'anxious' };

export interface BehaviorSummary {
  totalEvents: number;
  routineCompletionRate: number;
  geofenceBreaches: number;
  hydrationLogs: number;
  moodDistribution: Record<string, number>;
  sessionStartHours: number[];
}

export interface WeeklyHealthReport {
  overallTrend: 'stable' | 'improving' | 'concerning';
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  doctorNotes: string;
}

export interface DateContext {
  greeting: string;
  timeOfDay: string;
  timeOfDayEmoji: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  year: number;
  season: string;
  formattedTime: string;
  contextSentence: string;
}

export interface SceneAnalysis {
  sceneDescription: string;
  itemsDetected: string[];
  roomGuess: string;
}

export interface ObjectFinderResult {
  found: boolean;
  confidence: 'high' | 'medium' | 'low';
  location: string;
  explanation: string;
  suggestion: string;
  bestSnapshotId?: string;
}

export interface SceneSnapshot {
  id?: string;
  imageBase64: string;
  sceneDescription: string;
  itemsDetected: string[];
  roomGuess: string;
  capturedAt: any;
}
