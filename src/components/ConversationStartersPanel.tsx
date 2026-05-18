import React, { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, Volume2, Loader2 } from 'lucide-react';
import { generateConversationStarters } from '../services/aiService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Person } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ConversationStartersPanelProps {
  personId: string;
  userId: string;
  personName: string;
}

export const ConversationStartersPanel: React.FC<ConversationStartersPanelProps> = ({ personId, userId, personName }) => {
  const [starters, setStarters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<Person | null>(null);

  const fetchStarters = async () => {
    setLoading(true);
    try {
      let currentPerson = person;
      if (!currentPerson) {
        const personDoc = await getDoc(doc(db, 'users', userId, 'people', personId));
        if (personDoc.exists()) {
          currentPerson = { id: personDoc.id, ...personDoc.data() } as Person;
          setPerson(currentPerson);
        }
      }

      if (currentPerson) {
        const results = await generateConversationStarters(currentPerson);
        setStarters(results);
      }
    } catch (error) {
      console.error('[ConversationStarters] Error:', error);
      setStarters(["How have you been lately?", "It's so lovely to see you.", "What have you been up to?"]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStarters();
  }, [personId, userId]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for clarity
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#FFF8E1] border-2 border-[#FFE082] rounded-[24px] p-6 shadow-sm mt-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 text-[#E65100]">
          <MessageSquare className="h-5 w-5" />
          <h4 className="text-lg font-bold">Things to Talk About</h4>
        </div>
        <button 
          onClick={fetchStarters} 
          disabled={loading}
          className="p-2 rounded-full hover:bg-orange-100 text-[#E65100] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-orange-100/50 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {starters.map((starter, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-stretch space-x-3 bg-white/60 p-4 rounded-xl border border-orange-100/50 group"
                >
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[#E65100] text-white flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <p className="flex-1 text-[#4E342E] text-lg font-medium leading-tight">
                    {starter}
                  </p>
                  <button 
                    onClick={() => speak(starter)}
                    className="flex-shrink-0 text-[#E65100] opacity-40 group-hover:opacity-100 transition-opacity p-1"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
