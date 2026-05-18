import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { logInteractionEvent } from '../services/behaviorTrackingService';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MoodCheckInProps {
  userId: string;
}

export const MoodCheckIn: React.FC<MoodCheckInProps> = ({ userId }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const checkLastMood = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const q = query(
          collection(db, 'users', userId, 'behaviorLogs'),
          where('type', '==', 'mood_self_report'),
          where('timestamp', '>=', Timestamp.fromDate(today)),
          limit(1)
        );
        
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          // No mood report today yet
          // Show after a short delay
          setTimeout(() => setShow(true), 5000);
        }
      } catch (error) {
        console.error('[MoodCheckIn] Error checking today:', error);
      }
    };
    
    checkLastMood();
  }, [userId]);

  const handleMoodSelect = async (mood: 'happy' | 'confused' | 'tired' | 'anxious') => {
    await logInteractionEvent(userId, { type: 'mood_self_report', mood });
    setShow(false);
  };

  const moods = [
    { id: 'happy' as const, emoji: '😊', label: 'Happy' },
    { id: 'confused' as const, emoji: '😕', label: 'Confused' },
    { id: 'tired' as const, emoji: '😴', label: 'Tired' },
    { id: 'anxious' as const, emoji: '😰', label: 'Anxious' },
  ];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-[32px] p-8 shadow-xl border border-olive-accent/5 mt-8"
        >
          <h3 className="text-2xl font-serif font-bold text-olive-accent text-center mb-6">
            How are you feeling today?
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            {moods.map((m) => (
              <button
                key={m.id}
                onClick={() => handleMoodSelect(m.id)}
                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-warm-bg hover:bg-olive-accent/5 transition-colors border border-transparent hover:border-olive-accent/10 group"
              >
                <span className="text-5xl mb-2 group-hover:scale-110 transition-transform">
                  {m.emoji}
                </span>
                <span className="font-bold text-soft-text">{m.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
