import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Mic, Loader2, ArrowLeft, Lightbulb, History, Trash2, CheckCircle2, Camera } from 'lucide-react';
import { findObjectInSnapshots } from '../services/aiService';
import { collection, query, orderBy, limit, getDocs, deleteDoc, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ObjectFinderResult } from '../types';
import { cn } from '../lib/utils';

interface ObjectFinderPanelProps {
  userId: string;
  onClose: () => void;
  isIntegrated?: boolean;
}

export const ObjectFinderPanel: React.FC<ObjectFinderPanelProps> = ({ userId, onClose, isIntegrated }) => {
  const [searchInput, setSearchInput] = useState('');
  const [view, setView] = useState<'snapshots' | 'analysis'>('analysis');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ObjectFinderResult | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [bestMatchSnapshot, setBestMatchSnapshot] = useState<any>(null);

  const fetchRecentScans = async () => {
    const q = query(
      collection(db, 'users', userId, 'sceneSnapshots'),
      orderBy('capturedAt', 'desc'),
      limit(20)
    );
    const snapshot = await getDocs(q);
    const scans = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setRecentScans(scans);
  };

  useEffect(() => {
    fetchRecentScans();
  }, [userId]);

  const handleSearch = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    setResult(null);
    setBestMatchSnapshot(null);
    try {
      const finderResult = await findObjectInSnapshots(userId, queryText);
      setResult(finderResult);
      if (finderResult.found && finderResult.bestSnapshotId) {
        const match = recentScans.find(s => s.id === finderResult.bestSnapshotId);
        if (match) {
          setBestMatchSnapshot(match);
        } else {
          // Fallback if not in the cached 20
          const docRef = doc(db, 'users', userId, 'sceneSnapshots', finderResult.bestSnapshotId);
          const s = await getDoc(docRef);
          if (s.exists()) setBestMatchSnapshot({ id: s.id, ...s.data() });
        }
      }
    } catch (err) {
      console.error('[ObjectFinder] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchInput(transcript);
        setIsListening(false);
        handleSearch(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onspeechend = () => recognition.stop();
      recognition.start();
    } else {
      alert("Speech recognition is not supported in this browser.");
    }
  };

  return (
    <motion.div 
      initial={isIntegrated ? { opacity: 0 } : { y: '100%' }}
      animate={isIntegrated ? { opacity: 1 } : { y: 0 }}
      exit={isIntegrated ? { opacity: 0 } : { y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={cn(
        "bg-[#F5F5F0] flex flex-col font-sans text-ink-charcoal z-[150]",
        isIntegrated ? "h-full w-full" : "fixed inset-0 pt-safe"
      )}
    >
      {/* Refined Header */}
      {!isIntegrated && (
        <header className="px-8 pt-12 pb-6 flex items-center justify-between">
          <button onClick={onClose} className="p-3 bg-white rounded-full shadow-sm">
            <ArrowLeft className="h-5 w-5 text-[#8A9A5B]" />
          </button>
          <span className="text-[10px] font-mono tracking-widest opacity-60 uppercase">Neural Search Active</span>
        </header>
      )}

      <main className={cn("flex-1 overflow-y-auto px-8 pb-32 space-y-12 max-w-2xl mx-auto w-full custom-scrollbar", isIntegrated && "px-0 pb-12 pt-8 max-w-full")}>
        {/* "Where is my..." Heading */}
        <div className="space-y-1">
          <h2 className="text-4xl font-serif font-medium tracking-tight">Where is my...</h2>
        </div>

        {/* Big Mic Button - Recipe 3 Hardware vibe matched to screenshot */}
        <button 
          onClick={startListening}
          disabled={loading}
          className={`w-full group relative overflow-hidden rounded-[24px] transition-all ${
            isListening ? 'bg-blue-500 scale-95 shadow-inner' : 'bg-[#8A9A5B] hover:shadow-xl hover:-translate-y-1'
          } p-10 flex flex-col items-center justify-center space-y-4`}
        >
          {loading ? (
            <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
          ) : (
            <>
              <div className={`p-4 rounded-full ${isListening ? 'bg-white/20' : 'bg-white/10'} transition-colors`}>
                <Mic className="h-8 w-8 text-white" />
              </div>
              <span className="text-white font-medium text-lg tracking-tight">
                {isListening ? "Listening..." : "Tap to Ask or Search"}
              </span>
            </>
          )}
          
          {/* Subtle Scan Line for "AI" feel */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20 scan-shimmer-line" />
        </button>

        {/* Quick Find Grid */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">Quick Find</h3>
          <div className="grid grid-cols-3 gap-3">
             {[
               { label: 'Glasses', icon: <Search className="h-4 w-4" /> },
               { label: 'Keys', icon: <Search className="h-4 w-4" /> },
               { label: 'Wallet', icon: <Search className="h-4 w-4" /> }
             ].map((item) => (
               <button 
                key={item.label}
                onClick={() => handleSearch(item.label)}
                className="bg-white/50 border border-ink-charcoal/10 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 hover:bg-white transition-colors"
               >
                 <div className="p-2 rounded-lg bg-warm-bg">
                    {item.label === 'Glasses' && <Search className="h-4 w-4 opacity-40" />}
                    {item.label === 'Keys' && <Search className="h-4 w-4 opacity-40" />}
                    {item.label === 'Wallet' && <Search className="h-4 w-4 opacity-40" />}
                 </div>
                 <span className="text-[11px] font-bold opacity-60">{item.label}</span>
               </button>
             ))}
          </div>
        </div>

        {/* AI Results - Large Image Card from Screenshot */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {result.found ? (
                <div className="bento-card relative backdrop-blur-sm overflow-hidden p-0 border-none shadow-2xl">
                   {/* Main Result Image */}
                   <div className="aspect-video w-full bg-olive-dark relative">
                     {bestMatchSnapshot ? (
                       <img src={bestMatchSnapshot.imageBase64} className="h-full w-full object-cover opacity-80" />
                     ) : (
                       <div className="h-full w-full flex items-center justify-center text-white/20">
                         <Camera className="h-12 w-12" />
                       </div>
                     )}
                     
                     <div className="absolute inset-0 bg-gradient-to-t from-olive-dark/80 via-transparent to-transparent" />
                     
                     {/* Overlay Feedback */}
                     <div className="absolute bottom-6 left-6 right-6">
                        <div className="flex items-center space-x-3 mb-2">
                           <div className="h-2 w-2 rounded-full bg-[#8A9A5B] animate-pulse" />
                           <span className="text-white/60 text-[10px] font-mono tracking-wider uppercase">Match Identified</span>
                        </div>
                        <h4 className="text-white text-3xl font-serif">{result.explanation}</h4>
                     </div>
                   </div>

                   {/* Detail Footer */}
                   <div className="p-6 bg-white flex items-center justify-between">
                     <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A9A5B]">Location</span>
                        <p className="text-xl font-serif text-ink-charcoal">{result.location}</p>
                        <p className="text-[10px] opacity-60 font-mono">Last seen {bestMatchSnapshot?.capturedAt ? new Date(bestMatchSnapshot.capturedAt.toDate()).toLocaleTimeString() : 'Recently'}</p>
                     </div>
                     <div className="flex space-x-2">
                        <button className="p-4 bg-warm-bg rounded-2xl"><Mic className="h-5 w-5 text-[#8A9A5B]" /></button>
                        <button className="bg-[#8A9A5B] text-white px-6 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#8A9A5B]/20">Take Me Home</button>
                     </div>
                   </div>
                </div>
              ) : (
                <div className="bento-card bg-orange-50/50 border border-orange-100 flex flex-col items-center text-center p-12 space-y-4">
                   <div className="p-4 rounded-full bg-orange-100/50">
                      <History className="h-8 w-8 text-orange-600/60" />
                   </div>
                   <h3 className="text-2xl font-serif">I'm still looking...</h3>
                   <p className="text-gray-500 max-w-xs">{result.explanation}</p>
                   <div className="p-4 bg-orange-100/20 rounded-2xl text-sm italic text-orange-700/80">
                      Tip: {result.suggestion}
                   </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search History Footer - Minimal */}
        <div className="pt-12 text-center">
           <button className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-60 flex items-center space-x-2 mx-auto hover:opacity-100 transition-opacity">
             <History className="h-3 w-3" />
             <span>View Search History</span>
           </button>
        </div>
      </main>
    </motion.div>
  );
};
