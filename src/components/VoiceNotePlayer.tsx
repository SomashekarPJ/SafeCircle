import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Play, Heart, Loader2 } from 'lucide-react';
import { getVoiceNote, playVoiceNote } from '../services/voiceNoteService';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface VoiceNotePlayerProps {
  userId: string;
  routineId: string;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ userId, routineId }) => {
  const [voiceNote, setVoiceNote] = useState<{ url: string; senderName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const fetchNote = async () => {
      const note = await getVoiceNote(userId, routineId);
      if (note) {
        setVoiceNote(note);
        // Auto-play after 1.5s delay
        setTimeout(() => {
          handlePlay(note.url);
        }, 1500);
      }
      setLoading(false);
    };
    fetchNote();
  }, [userId, routineId]);

  const handlePlay = (url: string) => {
    if (isPlaying) return;
    setIsPlaying(true);
    const audio = playVoiceNote(url);
    audio.onended = () => setIsPlaying(false);
  };

  const handleLike = async () => {
    setLiked(true);
    try {
      await setDoc(doc(db, 'users', userId, 'voiceNoteLikes', routineId), {
        likedAt: serverTimestamp(),
        routineId
      });
    } catch (err) {
      console.error('[VoiceNotePlayer] Error liking:', err);
    }
  };

  if (loading) return null;
  if (!voiceNote) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-pink-50 to-orange-50 border-2 border-pink-100 rounded-[32px] p-6 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0"
    >
      <div className="flex items-center space-x-6">
        <div className={`p-4 rounded-full bg-pink-500/10 text-pink-500 ${isPlaying ? 'animate-pulse' : ''}`}>
          <Volume2 className="h-8 w-8" />
        </div>
        <div className="text-center md:text-left">
          <p className="text-sm font-bold text-pink-400 uppercase tracking-widest mb-1">A message for you 💌</p>
          <p className="text-xl font-serif font-bold text-pink-900 leading-tight">
            From {voiceNote.senderName}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button 
          onClick={() => handlePlay(voiceNote.url)}
          disabled={isPlaying}
          className={`h-16 px-6 rounded-2xl flex items-center space-x-3 font-bold transition-all shadow-md active:scale-95 ${
            isPlaying ? 'bg-pink-100 text-pink-300' : 'bg-pink-500 text-white hover:bg-pink-600'
          }`}
        >
          <Play className="h-5 w-5 fill-current" />
          <span>{isPlaying ? 'Playing...' : 'Play Again'}</span>
        </button>
        
        <button 
          onClick={handleLike}
          disabled={liked}
          className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 ${
            liked ? 'bg-pink-50 text-pink-500 border border-pink-200' : 'bg-white text-gray-300 border border-gray-100 hover:text-pink-500'
          }`}
        >
          <Heart className={`h-8 w-8 ${liked ? 'fill-current' : ''}`} />
        </button>
      </div>
    </motion.div>
  );
};
