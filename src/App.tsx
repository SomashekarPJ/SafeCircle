import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Users, 
  Calendar, 
  BookOpen, 
  Camera, 
  Bell, 
  ChevronRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Edit2,
  Trash2,
  Plus,
  Shield,
  Search,
  LogOut,
  ChevronLeft
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { memoryService } from './services/memoryService';

// Connection safety test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
import { generateResponse, identifyPersonFromImage } from './services/aiService';
import { seedInitialData } from './services/seeder';
import { speechService } from './services/speechService';
import { cn, compressImage } from './lib/utils';
import { TakeMeHomeButton } from './components/TakeMeHomeButton';
import { DayWidget } from './components/DayWidget';
import { HydrationReminderToast } from './components/HydrationReminderToast';
import { ConversationStartersPanel } from './components/ConversationStartersPanel';
import { PillVerificationModal } from './components/PillVerificationModal';
import { VoiceNotePlayer } from './components/VoiceNotePlayer';
import { MoodCheckIn } from './components/MoodCheckIn';
import { CaregiverPinEntry } from './components/CaregiverPinEntry';
import { CaregiverDashboard } from './components/CaregiverDashboard';
import { ObjectFinderPanel } from './components/ObjectFinderPanel';
import { scheduleHydrationReminders } from './services/hydrationService';
import { logInteractionEvent } from './services/behaviorTrackingService';
import { startGeofenceWatch, stopGeofenceWatch, reportBreachToFirestore } from './services/geofenceService';
import { saveSnapshot, compressImageBase64 } from './services/snapshotService';
import { analyzeSceneForObjects } from './services/aiService';
import { Person, Memory, Routine } from './types';

import { precisionFaceEngine } from './services/precisionFace';

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [activeTab, setActiveTab] = useState<'home' | 'people' | 'schedule' | 'memories' | 'lens'>('home');
  const [appMode, setAppMode] = useState<'patient' | 'caregiver' | 'pin'>('patient');
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [aiMessage, setAiMessage] = useState("Good morning. I'm SafeCircle, your companion. How are you feeling today?");
  const [isAiTalking, setIsAiTalking] = useState(false);
  const [camStreaming, setCamStreaming] = useState(false);
  const [showAddModal, setShowAddModal] = useState<'person' | 'memory' | 'routine' | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      logInteractionEvent(user.uid, { type: 'session_start', hour: new Date().getHours() });
      const intervalId = scheduleHydrationReminders(user.uid, () => setShowHydration(true));
      
      const geofenceId = startGeofenceWatch(user.uid, (lat, lng) => {
        reportBreachToFirestore(user.uid, lat, lng);
        setGeofenceBreached(true);
        logInteractionEvent(user.uid, { type: 'geofence_breach' });
      });

      return () => {
        if (intervalId) clearInterval(intervalId);
        if (geofenceId) stopGeofenceWatch(geofenceId);
      };
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
      const unsubRoutines = memoryService.getRoutines(setRoutines);
      return () => unsubRoutines();
    }
  }, [user]);

  const loadData = async () => {
    const [p, m] = await Promise.all([
      memoryService.getPeople(),
      memoryService.getMemories()
    ]);
    
    setPeople(p);
    setMemories(m);
  };

  const handleDeletePerson = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this person?")) {
      await memoryService.deletePerson(id);
      loadData();
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this memory?")) {
      await memoryService.deleteMemory(id);
      loadData();
    }
  };

  const handleDeleteRoutine = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this task?")) {
      await memoryService.deleteRoutine(id);
      // Data is loaded via snapshot listener for routines
    }
  };

  const handleRoutineToggle = async (routine: Routine, completed: boolean) => {
    if (completed && routine.type === 'medication' && !routine.isCompleted) {
      setActiveVerification(routine);
    } else {
      await memoryService.toggleRoutine(routine.id!, completed);
      if (completed) {
        logInteractionEvent(user!.uid, { type: 'routine_completed', routineId: routine.id!, completedAt: new Date().toISOString() });
      }
    }
  };

  const handleAiAsk = async (query: string) => {
    setIsAiTalking(true);
    const response = await generateResponse(query, {
      memories,
      people,
      routines,
    });
    setAiMessage(response);
    speechService.speak(response);
    setIsAiTalking(false);
  };

  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (activeTab === 'lens' && activeStream && videoRef.current) {
      // Ensure the video element gets the stream as soon as it's mounted
      videoRef.current.srcObject = activeStream;
      setCamStreaming(true);
    }
  }, [activeTab, activeStream]);

  useEffect(() => {
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeStream]);

  const startLens = async () => {
    setActiveTab('lens');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not available in this browser.");
      }

      let stream: MediaStream;
      try {
        // Try mobile back camera first
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
      } catch (e) {
        console.warn("Retrying with standard camera constraints...");
        // Fallback to any available camera (good for desktop)
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      setActiveStream(stream);
    } catch (err) {
      console.error("Camera error:", err);
      const errorMessage = err instanceof Error ? err.message : "Undefined error";
      setAiMessage(`I couldn't open the camera (${errorMessage}). You can select a photo from your gallery instead.`);
      // Auto-trigger upload on camera fail for better UX in restricted environments
      setTimeout(() => {
        document.getElementById('hidden-upload')?.click();
      }, 1500);
      setActiveTab('home');
    }
  };

  const stopLens = () => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setActiveStream(null);
    }
    setCamStreaming(false);
    if (activeTab === 'lens') setActiveTab('home');
  };

  const [identifiedPerson, setIdentifiedPerson] = useState<Person | null>(null);
  const [faceConfidence, setFaceConfidence] = useState<number>(0);
  const [qualityInfo, setQualityInfo] = useState<{ brightness: number; sharpness: number; isRejected: boolean; reason?: string } | null>(null);
  const [showHydration, setShowHydration] = useState(false);
  const [activeVerification, setActiveVerification] = useState<Routine | null>(null);
  const [showObjectFinder, setShowObjectFinder] = useState(false);
  const [geofenceBreached, setGeofenceBreached] = useState(false);
  const lastSnapshotTime = React.useRef<number>(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'lens' && camStreaming && !isAiTalking) {
      interval = setInterval(() => {
        // Silent recognition for learning and tracking update
        silentCaptureAndIdentify();
      }, 5000); // Check every 5 seconds
    }
    return () => clearInterval(interval);
  }, [activeTab, camStreaming, isAiTalking]);

  const silentCaptureAndIdentify = async () => {
    if (!videoRef.current || isAiTalking) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 400; // Efficient res for tracking
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.5);
      
      const result = await precisionFaceEngine.processFrame(base64, people);
      if (!result) return;
      
      setFaceConfidence(result.confidence || 0);
      setQualityInfo(result.quality || null);
      
      if (result.identified && result.name) {
        const person = people.find(p => p.name === result.name);
        if (person) {
          setIdentifiedPerson(person);
          // Only learn if engine suggests (high confidence + clear frame)
          if (result.shouldLearn && person.id) {
            const currentImages = person.images || [];
            if (currentImages.length < 8) { 
              try {
                // Standardizing the sample size for better performance and smaller storage footprint
                const learningImg = await compressImage(result.enhancedImage || canvas.toDataURL('image/jpeg', 0.6), 300, 300, 0.35);
                memoryService.updatePerson(person.id, {
                  images: [...currentImages, learningImg]
                });
                loadData();
              } catch (err) {
                console.error("Learning compression failed:", err);
              }
            }
          }
        }
      } else {
        setIdentifiedPerson(null);
        // If it's a manual scan and not identified, the AI message will already reflect it
      }

      // Feature 10: Passive Snapshot for Object Finder
      const now = Date.now();
      if (now - lastSnapshotTime.current > 30000) { // Every 30 seconds
        lastSnapshotTime.current = now;
        (async () => {
          try {
            const compressed = await compressImageBase64(base64);
            const analysis = await analyzeSceneForObjects(compressed);
            if (user) {
              await saveSnapshot(user.uid, compressed, analysis);
            }
          } catch (err) {
            console.error('[SnapshotCapture] Passive capture failed:', err);
          }
        })();
      }
    }
  };

  const captureAndIdentify = async () => {
    if (!videoRef.current) return;
    
    setIsAiTalking(true);
    setAiMessage("PrecisionFace™ processing...");
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg');
      
      // Force engine reset for manual check
      precisionFaceEngine.reset();
      const result = await precisionFaceEngine.processFrame(base64, people);
      if (!result) {
        setIsAiTalking(false);
        return;
      }
      
      setQualityInfo(result.quality || null);
      setAiMessage(result.message || "I see a friendly face here.");
      speechService.speak(result.message || "I see a friendly face here.");
      setFaceConfidence(result.confidence || 0);

      if (result.identified && result.name) {
        const person = people.find(p => p.name === result.name);
        if (person) {
          setIdentifiedPerson(person);
          
          if (result.shouldLearn && person.id) {
            const currentImages = person.images || [];
            if (currentImages.length < 8) { 
              try {
                const learningImg = await compressImage(result.enhancedImage || base64, 300, 300, 0.35);
                await memoryService.updatePerson(person.id, {
                  images: [...currentImages, learningImg]
                });
                loadData();
              } catch (err) {
                console.error("Adaptive learning failed:", err);
              }
            }
          }
        }
      } else {
        setIdentifiedPerson(null);
        // If high clarity but not identified, offer to add
        if (result.quality && !result.quality.isRejected && result.confidence < 0.3) {
           setAiMessage("I don't recognize this person yet. Would you like to add them to your Heart Memories?");
        }
      }
    }
    setIsAiTalking(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setIsAiTalking(true);
      setAiMessage("Let me see... looking at the photo now.");
      const result = await identifyPersonFromImage(base64, people);
      setAiMessage(result.message || "I see a friendly face here.");
      speechService.speak(result.message || "I see a friendly face here.");
      setIsAiTalking(false);
    };
    reader.readAsDataURL(file);
  };

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-warm-bg text-olive-accent">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="h-12 w-12 rounded-full bg-olive-accent opacity-20"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center space-y-8 bg-warm-bg">
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
             <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-xl">
                <Heart className="h-16 w-16 text-olive-accent" />
                <div className="pulsing-avatar absolute inset-0 rounded-full" />
             </div>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-serif font-semibold text-olive-accent"
          >
            SafeCircle
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="max-w-xs text-lg text-soft-text"
          >
            A gentle companion for your memories and daily routine.
          </motion.p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogin}
          className="flex items-center space-x-3 rounded-full bg-olive-accent px-8 py-4 text-white shadow-lg transition-colors hover:bg-olive-accent/90 text-lg font-medium"
        >
          <span>Continue with Google</span>
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-warm-bg text-ink-charcoal font-sans selection:bg-olive-accent selection:text-white">
      {/* Universal Sidebar - Responsive */}
      <aside className="hidden lg:flex w-24 bg-white border-r border-ink-charcoal/10 flex-col p-6 space-y-12 shrink-0 z-[100] items-center">
        <div className="space-y-4 flex flex-col items-center">
            <div className="h-12 w-12 bg-olive-accent rounded-2xl flex items-center justify-center text-white shadow-lg shadow-olive-accent/20">
              <Heart className="h-6 w-6" />
            </div>
            <div className="h-1 w-1 rounded-full bg-olive-accent" />
        </div>

        <nav className="flex-1 space-y-6 flex flex-col items-center">
           <SidebarIconLink active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Heart />} label="Home" />
           <SidebarIconLink active={activeTab === 'people'} onClick={() => setActiveTab('people')} icon={<Users />} label="People" />
           <SidebarIconLink active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} icon={<Calendar />} label="Day" />
           <SidebarIconLink active={activeTab === 'memories'} onClick={() => setActiveTab('memories')} icon={<BookOpen />} label="History" />
        </nav>

        <div className="pt-8 border-t border-ink-charcoal/10 space-y-6 flex flex-col items-center">
           <button 
             onClick={() => setAppMode('pin')}
             title="Caregiver Mode"
             className="p-4 rounded-22px bg-warm-bg hover:bg-olive-accent hover:text-white transition-all group"
           >
             <Shield className="h-5 w-5 opacity-40 group-hover:opacity-100" />
           </button>
           <button 
             onClick={() => signOut(auth)}
             title="Log Out"
             className="p-4 rounded-22px hover:bg-olive-accent hover:text-white transition-all group opacity-40 hover:opacity-100"
           >
             <LogOut className="h-5 w-5" />
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-6 bg-white border-b border-ink-charcoal/10 z-40">
           <h1 className="text-xl font-serif font-bold">SafeCircle</h1>
           <button onClick={() => setAppMode('pin')} className="p-2 bg-warm-bg rounded-xl"><Shield className="h-5 w-5 opacity-40" /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-12 pb-32 lg:pb-12 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto space-y-12"
              >
                {/* Hero Section - The Warm Welcome */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                   <div className="space-y-6">
                      <div className="inline-flex items-center space-x-3 px-4 py-2 bg-olive-accent/5 rounded-full">
                         <div className="h-2 w-2 rounded-full bg-olive-accent animate-pulse" />
                         <span className="text-[11px] font-black uppercase tracking-[0.2em] text-olive-accent">SafeCircle Active</span>
                      </div>
                      <h2 className="text-6xl lg:text-8xl font-serif font-black leading-[0.9] tracking-tighter text-ink-charcoal">
                        {new Date().getHours() < 12 ? 'Good morning.' : 'Hello there.'}
                      </h2>
                      <div className="max-w-xl p-8 bg-white rounded-[32px] shadow-2xl shadow-olive-accent/[0.05] border border-ink-charcoal/10">
                        <p className="text-2xl text-ink-charcoal font-serif italic leading-snug">"{aiMessage}"</p>
                      </div>
                   </div>
                   <div className="hidden lg:block shrink-0">
                      <DayWidget />
                   </div>
                </div>

                {/* The Discovery Grid - Everything Accessible */}
                <div className="grid grid-cols-12 gap-8">
                   
                   {/* Primary Assistant Tools */}
                   <div className="col-span-12 lg:col-span-8 flex flex-col space-y-8">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-60 px-2 text-olive-accent">Primary Tools</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Identify Person Action */}
                        <button 
                          onClick={startLens}
                          className="group relative h-[360px] bg-olive-dark rounded-[48px] overflow-hidden p-12 flex flex-col justify-between text-left shadow-2xl shadow-olive-dark/20 active:scale-[0.98] transition-all"
                        >
                          <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                             <Camera className="h-40 w-40 text-ink-charcoal" />
                          </div>
                          <div className="h-16 w-16 rounded-[24px] bg-white/20 flex items-center justify-center text-white backdrop-blur-xl group-hover:scale-110 transition-transform duration-500">
                             <Camera className="h-8 w-8" />
                          </div>
                          <div className="space-y-4">
                             <h4 className="text-4xl font-serif font-black text-white leading-tight">Identify<br/>People</h4>
                             <p className="text-white/60 text-sm font-bold uppercase tracking-widest">Open camera to recognize family</p>
                          </div>
                        </button>

                        {/* Find Objects Action */}
                        <button 
                          onClick={() => setShowObjectFinder(true)}
                          className="group relative h-[360px] bg-[#8A9A5B] rounded-[48px] overflow-hidden p-12 flex flex-col justify-between text-left shadow-2xl shadow-[#8A9A5B]/30 active:scale-[0.98] transition-all"
                        >
                          <div className="absolute top-0 right-0 p-12 opacity-10 scale-150 -rotate-12 group-hover:rotate-0 transition-transform duration-700">
                             <Search className="h-40 w-40 text-ink-charcoal" />
                          </div>
                          <div className="h-16 w-16 rounded-[24px] bg-white flex items-center justify-center text-[#8A9A5B] shadow-xl group-hover:scale-110 transition-transform duration-500">
                             <Search className="h-8 w-8" />
                          </div>
                          <div className="space-y-4">
                             <h4 className="text-4xl font-serif font-black text-white leading-tight">Find My<br/>Things</h4>
                             <p className="text-white/70 text-sm font-bold uppercase tracking-widest">I can help you find lost items</p>
                          </div>
                        </button>
                      </div>

                      {/* Featured Sections Inline */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <HubSectionCard onClick={() => setActiveTab('people')} icon={<Users />} label="Friends" color="bg-orange-50 text-orange-600" />
                        <HubSectionCard onClick={() => setActiveTab('schedule')} icon={<Calendar />} label="Goals" color="bg-blue-50 text-blue-600" />
                        <HubSectionCard onClick={() => setActiveTab('memories')} icon={<BookOpen />} label="Narratives" color="bg-purple-50 text-purple-600" />
                        <HubSectionCard onClick={() => setAppMode('pin')} icon={<Shield />} label="Security" color="bg-red-50 text-red-600" />
                      </div>
                   </div>

                   {/* Activity & Reminders Column */}
                   <div className="col-span-12 lg:col-span-4 flex flex-col space-y-8">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-60 px-2 text-olive-accent">Focus Checklist</h3>
                      <div className="bg-white rounded-[48px] p-10 shadow-2xl shadow-olive-accent/[0.03] space-y-10">
                        {routines.filter(r => !r.isCompleted).length > 0 ? (
                          <div className="space-y-8">
                            {routines.filter(r => !r.isCompleted).slice(0, 2).map(r => (
                              <div key={r.id} className="group flex items-center justify-between">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-olive-accent block">{r.time}</span>
                                  <h5 className="text-xl font-serif font-bold text-ink-charcoal">{r.title}</h5>
                                </div>
                                <button 
                                  onClick={() => handleRoutineToggle(r, true)}
                                  className="h-12 w-12 rounded-2xl bg-warm-bg flex items-center justify-center hover:bg-olive-accent hover:text-white transition-all shadow-sm"
                                >
                                  <ChevronRight className="h-5 w-5" />
                                </button>
                              </div>
                            ))}
                            <button 
                              onClick={() => setActiveTab('schedule')}
                              className="w-full py-5 rounded-[22px] bg-warm-bg text-[10px] font-black uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition-all border border-olive-accent/20"
                            >
                              See all {routines.filter(r => !r.isCompleted).length} tasks
                            </button>
                          </div>
                        ) : (
                          <div className="text-center space-y-4 py-8">
                             <div className="h-16 w-16 bg-green-50 text-green-600 rounded-[28px] flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="h-8 w-8" />
                             </div>
                             <p className="text-xl font-serif font-medium text-ink-charcoal">All tasks finished!</p>
                             <p className="text-sm text-soft-gray">Relax and enjoy your day.</p>
                          </div>
                        )}
                      </div>

                      <MoodCheckIn userId={user.uid} />
                      <TakeMeHomeButton userId={user.uid} />
                   </div>
                </div>                {/* People Strip */}
                <div className="space-y-8 pb-12">
                   <div className="flex justify-between items-end px-2">
                      <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-60">Your People</h3>
                      <button onClick={() => setActiveTab('people')} className="text-[10px] font-black uppercase tracking-[0.1em] text-olive-accent">View Heart Memories</button>
                   </div>
                   <div className="flex space-x-6 overflow-x-auto pb-6 -mx-2 px-2 no-scrollbar">
                      {people.map(person => (
                        <button 
                          key={person.id}
                          onClick={() => handleAiAsk(`Tell me about ${person.name}`)}
                          className="shrink-0 w-32 space-y-4 group"
                        >
                           <div className="h-32 w-32 rounded-[40px] overflow-hidden shadow-xl shadow-olive-accent/[0.05] group-hover:scale-105 transition-transform duration-500">
                             <img src={person.imageUrl || person.images?.[0]} className="h-full w-full object-cover" alt="" />
                           </div>
                           <div className="text-center space-y-0.5">
                              <span className="block text-sm font-bold text-ink-charcoal">{person.name.split(' ')[0]}</span>
                              <span className="block text-[8px] font-black uppercase tracking-[0.1em] opacity-50">{person.relationship}</span>
                           </div>
                        </button>
                      ))}
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'people' && (
              <motion.div 
                key="people"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-6xl mx-auto space-y-12"
              >
                <div className="space-y-4">
                  <h2 className="text-5xl font-serif font-medium tracking-tight">Heart Memories</h2>
                  <p className="text-xl text-soft-text font-serif italic max-w-2xl">
                    “These are the people who love and care for you. You can talk to me about any of them.”
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {people.map((person) => (
                    <motion.div 
                      key={person.id} 
                      className="bento-card p-0 overflow-hidden group hover:shadow-xl transition-all"
                    >
                      <div className="h-64 bg-warm-bg relative overflow-hidden">
                         {person.imageUrl ? (
                            <img src={person.imageUrl} className="h-full w-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt={person.name} />
                         ) : (
                            <div className="h-full w-full flex items-center justify-center bg-ink-charcoal/5">
                               <Users className="h-16 w-16 opacity-10" />
                            </div>
                         )}
                         
                         <div className="absolute top-4 right-4 flex space-x-2">
                            <button 
                              onClick={() => setEditingPerson(person)}
                              className="p-3 bg-white/90 backdrop-blur rounded-full text-olive-dark shadow-sm hover:bg-white"
                            >
                               <Edit2 className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeletePerson(person.id!); }}
                              className="p-3 bg-red-50 text-red-600 rounded-full shadow-sm hover:bg-red-100 transition-colors"
                            >
                               <Trash2 className="h-4 w-4" />
                            </button>
                         </div>

                         <div className="absolute bottom-6 left-6 right-6">
                            <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full w-fit shadow-lg mb-2">
                               <p className="text-[10px] font-bold uppercase tracking-widest text-olive-accent">{person.relationship}</p>
                            </div>
                         </div>
                      </div>
                      
                      <div className="p-8 space-y-4">
                         <h3 className="text-3xl font-serif font-medium leading-none">{person.name}</h3>
                         <p className="text-soft-text font-serif italic leading-relaxed line-clamp-3">
                            {person.biography || 'A familiar face who is always here for you.'}
                         </p>
                         
                         <button 
                           onClick={() => handleAiAsk(`Tell me about ${person.name}`)}
                           className="w-full py-4 bg-warm-bg rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-olive-accent hover:text-white transition-all"
                         >
                           Ask about {person.name.split(' ')[0]}
                         </button>
                      </div>
                    </motion.div>
                  ))}
                  
                  <button 
                    onClick={() => setShowAddModal('person')}
                    className="bento-card border-2 border-dashed border-ink-charcoal/10 bg-transparent flex flex-col items-center justify-center p-12 space-y-6 opacity-60 hover:opacity-100 hover:bg-white transition-all min-h-[400px]"
                  >
                     <div className="h-16 w-16 rounded-full bg-warm-bg flex items-center justify-center">
                        <Plus className="h-8 w-8 text-olive-accent" />
                     </div>
                     <div className="text-center">
                       <span className="block text-2xl font-serif font-medium">Add Someone</span>
                       <span className="text-xs uppercase font-bold tracking-widest opacity-60">Heart Memory Storage</span>
                     </div>
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'schedule' && (
              <motion.div 
                key="schedule"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-12"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                   <div className="space-y-4">
                      <h2 className="text-5xl font-serif font-medium tracking-tight">Daily Timeline</h2>
                      <p className="text-xl text-soft-text font-serif italic">“Here is what we have planned for you today.”</p>
                   </div>
                   <button 
                    onClick={() => setShowAddModal('routine')}
                    className="px-8 py-4 bg-white rounded-2xl shadow-sm border border-ink-charcoal/10 text-xs font-bold uppercase tracking-widest hover:shadow-md transition-all"
                   >
                     New Task
                   </button>
                </div>

                <div className="space-y-4">
                  {routines.sort((a, b) => a.time.localeCompare(b.time)).map((r) => (
                    <div key={r.id} className={cn(
                      "bento-card flex items-center justify-between p-8 bg-white transition-all group",
                      r.isCompleted && "opacity-40"
                    )}>
                      <div className="flex items-center space-x-8">
                         <div className="w-24 shrink-0 flex items-center space-x-4">
                            <button 
                              onClick={() => handleDeleteRoutine(r.id!)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 transition-all"
                            >
                               <Trash2 className="h-4 w-4" />
                            </button>
                            <span className="text-3xl font-serif font-medium text-olive-accent">{r.time}</span>
                         </div>
                         <div className="h-12 w-[1px] bg-ink-charcoal/10" />
                         <div>
                            <h4 className={cn("text-2xl font-serif font-medium leading-none", r.isCompleted && "line-through")}>{r.title}</h4>
                            <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mt-1">{r.type}</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => handleRoutineToggle(r, !r.isCompleted)}
                        className="p-2 transition-transform active:scale-90"
                      >
                        {r.isCompleted ? (
                          <CheckCircle2 className="h-10 w-10 text-olive-accent" />
                        ) : (
                          <Circle className="h-10 w-10 opacity-10 hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'memories' && (
              <motion.div 
                key="memories"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-12"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                   <div className="space-y-4">
                      <h2 className="text-5xl font-serif font-medium tracking-tight">Narrative History</h2>
                      <p className="text-xl text-soft-text font-serif italic">“The moments that define who you are.”</p>
                   </div>
                   <button 
                    onClick={() => setShowAddModal('memory')}
                    className="px-8 py-4 bg-white rounded-2xl shadow-sm border border-ink-charcoal/10 text-xs font-bold uppercase tracking-widest"
                   >
                     Log Memory
                   </button>
                </div>
                 
                <div className="space-y-12 relative before:absolute before:left-[19px] before:top-4 before:bottom-0 before:w-[2px] before:bg-ink-charcoal/10">
                    {memories.sort((a,b) => b.date.localeCompare(a.date)).map((m) => (
                      <div key={m.id} className="relative pl-16">
                         <div className="absolute left-0 top-6 h-10 w-10 rounded-full bg-white border-4 border-warm-bg shadow-sm flex items-center justify-center z-10">
                            <div className="h-2 w-2 rounded-full bg-olive-accent" />
                         </div>
                         <div className="bento-card p-10 space-y-4 hover:shadow-lg transition-shadow relative group">
                            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button 
                                 onClick={() => handleDeleteMemory(m.id!)}
                                 className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                               >
                                  <Trash2 className="h-4 w-4" />
                               </button>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-olive-accent bg-olive-accent/5 px-3 py-1 rounded-full">
                              {new Date(m.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            <h3 className="text-3xl font-serif font-medium">{m.title}</h3>
                            <p className="text-xl text-soft-text leading-relaxed font-serif italic">
                              {m.description}
                            </p>
                         </div>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'lens' && (
              <motion.div 
                key="lens"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-olive-dark flex flex-col"
              >
                <div className="relative flex-1 bg-olive-dark overflow-hidden flex items-center justify-center">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover opacity-80"
                  />
                  
                  {/* Neural UI Overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                     <div className="absolute inset-x-8 top-12 flex items-center justify-between pointer-events-auto">
                        <div className="flex items-center space-x-3">
                           <div className="h-2 w-2 rounded-full bg-olive-accent animate-pulse" />
                           <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">Cognitive Neural Link</span>
                        </div>
                        <button onClick={stopLens} className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white">
                           <ChevronLeft className="h-5 w-5" />
                        </button>
                     </div>

                     {/* AI Whisper Text Area */}
                     <div className="absolute inset-x-12 bottom-48 flex flex-col items-center text-center space-y-6">
                        <AnimatePresence mode="wait">
                          {identifiedPerson && (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 20 }}
                              className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-[32px] flex items-center space-x-6 pr-10 shadow-2xl"
                            >
                               <div className="h-16 w-16 rounded-2xl overflow-hidden border border-white/20">
                                  <img src={identifiedPerson.imageUrl || identifiedPerson.images?.[0]} className="h-full w-full object-cover" alt="" />
                               </div>
                               <div className="text-left">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{identifiedPerson.relationship}</span>
                                  <h4 className="text-2xl font-serif text-white">{identifiedPerson.name}</h4>
                               </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="bg-olive-dark/40 backdrop-blur rounded-2xl px-6 py-3 max-w-sm">
                           <p className="text-white text-lg font-serif italic leading-tight">"{aiMessage}"</p>
                        </div>
                     </div>
                  </div>
                </div>

                <div className="h-40 bg-olive-dark border-t border-white/5 flex items-center justify-around px-12 relative overflow-hidden">
                   <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-olive-accent/50 to-transparent" />
                   
                   <button onClick={stopLens} className="p-4 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
                      <BookOpen className="h-6 w-6" />
                   </button>
                   
                   <motion.button 
                     whileTap={{ scale: 0.9 }}
                     onClick={captureAndIdentify}
                     className="h-24 w-24 rounded-full border-4 border-white/20 flex items-center justify-center p-2 group"
                   >
                     <div className="h-full w-full rounded-full bg-white group-hover:bg-olive-accent transition-colors shadow-lg shadow-white/10" />
                   </motion.button>

                   <button onClick={stopLens} className="p-4 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors">
                      <Users className="h-6 w-6" />
                   </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-olive-accent text-white rounded-[32px] p-4 flex justify-between items-center z-50 shadow-2xl">
           <NavButtonV3 active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Heart />} />
           <NavButtonV3 active={activeTab === 'lens'} onClick={startLens} icon={<Camera />} />
           <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center -mt-12 border-4 border-olive-accent shadow-xl">
              <button onClick={() => setShowObjectFinder(true)} className="text-olive-accent"><Search className="h-6 w-6" /></button>
           </div>
           <NavButtonV3 active={activeTab === 'people'} onClick={() => setActiveTab('people')} icon={<Users />} />
           <NavButtonV3 active={activeTab === 'memories'} onClick={() => setActiveTab('memories')} icon={<BookOpen />} />
        </nav>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        <input type="file" accept="image/*" id="hidden-upload" className="hidden" onChange={handleImageUpload} />

        {/* Caregiver Flow */}
        {appMode === 'pin' && user && (
          <CaregiverPinEntry 
            userId={user.uid} 
            onSuccess={() => setAppMode('caregiver')} 
            onClose={() => setAppMode('patient')} 
          />
        )}
        {appMode === 'caregiver' && user && (
          <CaregiverDashboard 
            userId={user.uid} 
            onExit={() => setAppMode('patient')} 
            onBackToPatient={() => setAppMode('patient')}
          />
        )}

        {/* Hydration Reminder */}
        {showHydration && user && (
          <HydrationReminderToast 
            userId={user.uid} 
            onDismiss={() => setShowHydration(false)} 
          />
        )}
        
        {/* Geofence Breach Overlay */}
        {geofenceBreached && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[11000] bg-blue-600 flex flex-col items-center justify-center p-10 text-center text-white"
          >
            <div className="h-40 w-40 rounded-full bg-white/20 flex items-center justify-center mb-10 overflow-hidden relative">
              <Heart className="h-20 w-20 text-white animate-pulse" />
            </div>
            <h2 className="text-4xl font-black mb-6">You are safe! 💙</h2>
            <p className="text-2xl font-medium leading-relaxed max-w-md">
              Letting your family know where you are. Help is on the way!
            </p>
            <button 
              onClick={() => setGeofenceBreached(false)}
              className="mt-12 px-10 py-5 rounded-[24px] bg-white text-blue-600 font-black text-xl shadow-2xl"
            >
              I Undestand
            </button>
          </motion.div>
        )}

        {/* Pill Verification Modal */}
        {activeVerification && user && (
          <div className="fixed inset-0 z-[10000] bg-olive-dark">
            <VoiceNotePlayer userId={user.uid} routineId={activeVerification.id!} />
            <PillVerificationModal
              routineId={activeVerification.id!}
              userId={user.uid}
              medicationName={activeVerification.medicationName || activeVerification.title}
              pillDescription={activeVerification.pillDescription || `${activeVerification.pillColor || ''} ${activeVerification.pillShape || ''} pill`}
              onClose={() => setActiveVerification(null)}
              onVerified={async () => {
                await memoryService.toggleRoutine(activeVerification.id!, true);
                logInteractionEvent(user.uid, { type: 'routine_completed', routineId: activeVerification.id!, completedAt: new Date().toISOString() });
                setActiveVerification(null);
              }}
            />
          </div>
        )}

        {/* Modals */}
        {showObjectFinder && user && (
          <ObjectFinderPanel 
            userId={user.uid} 
            onClose={() => setShowObjectFinder(false)} 
          />
        )}

        {(showAddModal || editingPerson) && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-6 bg-olive-dark/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-lg bg-white rounded-t-[40px] sm:rounded-[40px] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-bold text-olive-accent">
                  {showAddModal === 'person' && "Add a Loved One"}
                  {editingPerson && "Edit Heart Memory"}
                  {showAddModal === 'memory' && "Add a Memory"}
                  {showAddModal === 'routine' && "Add a Task"}
                </h3>
                <button 
                  onClick={() => { setShowAddModal(null); setEditingPerson(null); }}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                   <ChevronRight className="h-6 w-6 rotate-90" />
                </button>
              </div>

              {showAddModal === 'person' && (
                <AddPersonForm onComplete={() => { setShowAddModal(null); loadData(); }} />
              )}
              {editingPerson && (
                <AddPersonForm 
                  existingPerson={editingPerson}
                  onComplete={() => { setEditingPerson(null); loadData(); }} 
                />
              )}
              {showAddModal === 'memory' && (
                <AddMemoryForm onComplete={() => { setShowAddModal(null); loadData(); }} />
              )}
              {showAddModal === 'routine' && (
                <AddRoutineForm onComplete={() => { setShowAddModal(null); loadData(); }} />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarIconLink({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={cn(
        "p-4 rounded-[22px] transition-all duration-300 relative group",
        active ? "bg-olive-accent text-white shadow-xl shadow-olive-accent/20" : "hover:bg-olive-accent/5 text-[#2D2D2A]/40 hover:text-olive-accent"
      )}
    >
      <div className="group-hover:scale-110 transition-transform duration-300">
        {React.cloneElement(icon as React.ReactElement<any>, { className: "h-6 w-6" })}
      </div>
      {active && (
        <motion.div 
          layoutId="active-bar"
          className="absolute -left-1 top-4 bottom-4 w-1 bg-olive-accent rounded-full" 
        />
      )}
    </button>
  );
}

function HubSectionCard({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) {
  return (
    <button 
      onClick={onClick}
      className="bg-white rounded-[32px] p-6 shadow-2xl shadow-olive-accent/[0.02] border border-olive-accent/[0.05] flex flex-col items-center justify-center space-y-4 hover:scale-105 active:scale-95 transition-all group"
    >
       <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm", color)}>
          {React.cloneElement(icon as React.ReactElement<any>, { className: "h-5 w-5" })}
       </div>
       <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100">{label}</span>
    </button>
  );
}

function NavButtonV3({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-22px transition-all",
        active ? "bg-white/20 text-white" : "text-white/40"
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { className: "h-6 w-6" })}
    </button>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bento-card bg-white p-4 flex flex-col items-center justify-center space-y-2 hover:bg-olive-accent hover:text-white transition-all group"
    >
       <div className="h-8 w-8 rounded-lg bg-warm-bg group-hover:bg-white/10 flex items-center justify-center text-olive-accent group-hover:text-white transition-colors">
          {React.cloneElement(icon as React.ReactElement<any>, { className: "h-4 w-4" })}
       </div>
       <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </button>
  );
}

function AddPersonForm({ onComplete, existingPerson }: { onComplete: () => void, existingPerson?: Person }) {
  const [name, setName] = useState(existingPerson?.name || '');
  const [rel, setRel] = useState(existingPerson?.relationship || '');
  const [bio, setBio] = useState(existingPerson?.biography || '');
  const [imageUrl, setImageUrl] = useState(existingPerson?.imageUrl || '');
  const [images, setImages] = useState<string[]>(existingPerson?.images || []);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        try {
          const compressed = await compressImage(rawBase64);
          if (!imageUrl) setImageUrl(compressed);
          setImages(prev => [...prev, compressed].slice(-5)); // Keep last 5 photos
        } catch (err) {
          console.error("Compression error:", err);
          if (!imageUrl) setImageUrl(rawBase64);
          setImages(prev => [...prev, rawBase64].slice(-5));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    const removedImg = images[index];
    const newImages = images.filter((_, idx) => idx !== index);
    setImages(newImages);
    if (removedImg === imageUrl) {
      setImageUrl(newImages[0] || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl && images.length === 0) {
      alert("Please upload at least one real photo.");
      return;
    }
    setIsUploading(true);
    const personData = { 
      name, 
      relationship: rel, 
      biography: bio, 
      imageUrl: imageUrl || images[0],
      images 
    };

    if (existingPerson?.id) {
      await memoryService.updatePerson(existingPerson.id, personData);
    } else {
      await memoryService.addPerson(personData);
    }
    
    setIsUploading(false);
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <label className="text-sm font-bold text-soft-text uppercase">Step 1: Upload real photos (up to 5)</label>
        <div className="grid grid-cols-3 gap-3">
           {images.map((img, idx) => (
             <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm">
                <img src={img} className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
             </div>
           ))}
           {images.length < 5 && (
              <button 
                type="button"
                onClick={() => document.getElementById('person-photo')?.click()}
                className="aspect-square rounded-2xl bg-warm-bg border-2 border-dashed border-olive-accent/20 flex items-center justify-center hover:bg-white transition-all shadow-inner"
              >
                <Plus className="h-6 w-6 text-olive-accent/40" />
              </button>
           )}
        </div>
        <input 
          type="file" 
          id="person-photo" 
          accept="image/*" 
          className="hidden" 
          onChange={handleImageSelect}
        />
        <p className="text-xs text-soft-text opacity-60">Adding more photos improves recognition accuracy.</p>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-bold text-soft-text uppercase">Step 2: Their Identity</label>
        <div className="space-y-4">
          <input 
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-4 rounded-2xl bg-warm-bg border-none focus:ring-2 focus:ring-olive-accent/20"
            placeholder="Full Name"
          />
          <input 
            required
            value={rel}
            onChange={e => setRel(e.target.value)}
            className="w-full p-4 rounded-2xl bg-warm-bg border-none focus:ring-2 focus:ring-olive-accent/20"
            placeholder="Relationship (e.g. Son, Daughter)"
          />
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-bold text-soft-text uppercase">Step 3: Favorite Memories & Personality</label>
        <textarea 
          value={bio}
          onChange={e => setBio(e.target.value)}
          className="w-full p-4 rounded-2xl bg-warm-bg border-none focus:ring-2 focus:ring-olive-accent/20 h-32 resize-none"
          placeholder="e.g. He visits every Sunday and loves cricket. He has a very gentle voice."
        />
      </div>

      <button 
        type="submit" 
        disabled={isUploading}
        className="w-full py-5 rounded-[24px] bg-olive-accent text-white font-bold text-lg shadow-lg shadow-olive-accent/20 active:scale-95 transition-all disabled:opacity-50"
      >
        {isUploading ? "Storing Safely..." : (existingPerson ? "Update Heart Memory" : "Save to Heart Memories")}
      </button>
    </form>
  );
}

function AddMemoryForm({ onComplete }: { onComplete: () => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await memoryService.addMemory({ 
      title, 
      description: desc, 
      date: new Date().toISOString() 
    });
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-bold text-soft-text uppercase">Title</label>
        <input 
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full p-4 rounded-2xl bg-warm-bg border-none focus:ring-2 focus:ring-olive-accent/20"
          placeholder="e.g. Our trip to the lake"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-soft-text uppercase">The Story</label>
        <textarea 
          required
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className="w-full p-4 rounded-2xl bg-warm-bg border-none focus:ring-2 focus:ring-olive-accent/20 h-40 resize-none"
          placeholder="Tell me what happened..."
        />
      </div>
      <button type="submit" className="w-full py-5 rounded-[24px] bg-olive-accent text-white font-bold text-lg shadow-lg">Save Memory</button>
    </form>
  );
}

function AddRoutineForm({ onComplete }: { onComplete: () => void }) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<'medication' | 'exercise' | 'meal' | 'appointment' | 'other'>('other');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await memoryService.addRoutine({ 
      title, 
      time, 
      type, 
      isCompleted: false 
    });
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-bold text-soft-text uppercase">Task Name</label>
        <input 
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full p-4 rounded-2xl bg-warm-bg border-none focus:ring-2 focus:ring-olive-accent/20"
          placeholder="e.g. Morning vitamins"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-soft-text uppercase">Time</label>
        <input 
          required
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-full p-4 rounded-2xl bg-warm-bg border-none focus:ring-2 focus:ring-olive-accent/20"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold text-soft-text uppercase">Category</label>
        <div className="grid grid-cols-2 gap-2">
          {(['medication' , 'exercise' , 'meal' , 'appointment' , 'other'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "p-3 rounded-xl border text-sm font-medium capitalize",
                type === t ? "bg-olive-accent text-white border-olive-accent" : "bg-warm-bg text-soft-text border-transparent"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <button type="submit" className="w-full py-5 rounded-[24px] bg-olive-accent text-white font-bold text-lg shadow-lg">Add Task</button>
    </form>
  );
}

