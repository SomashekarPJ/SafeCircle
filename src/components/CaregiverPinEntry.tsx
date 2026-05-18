import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Delete, X } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CaregiverPinEntryProps {
  userId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const CaregiverPinEntry: React.FC<CaregiverPinEntryProps> = ({ userId, onSuccess, onClose }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handlePress = (num: string) => {
    if (lockedOut || pin.length >= 4) return;
    setPin(prev => prev + num);
  };

  const handleBackspace = () => {
    if (lockedOut) return;
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === 4) {
      verifyPin();
    }
  }, [pin]);

  const verifyPin = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const data = userDoc.data();
      const correctPin = data?.caregiverPin || '1234'; // Default PIN if not set

      if (pin === correctPin) {
        onSuccess();
      } else {
        setError(true);
        setPin('');
        setAttempts(prev => {
          const next = prev + 1;
          if (next >= 3) {
            setLockedOut(true);
            setTimeout(() => {
              setLockedOut(false);
              setAttempts(0);
            }, 300000); // 5 minutes
          }
          return next;
        });
        setTimeout(() => setError(false), 500);
      }
    } catch (err) {
      console.error('[CaregiverPin] Error:', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-warm-bg flex flex-col items-center justify-center p-6"
    >
      <button onClick={onClose} className="absolute top-8 right-8 p-3 rounded-full bg-white shadow-md text-olive-accent">
        <X className="h-6 w-6" />
      </button>

      <div className="flex flex-col items-center space-y-8 w-full max-w-sm">
        <div className="p-6 rounded-full bg-white shadow-xl text-olive-accent">
          <Lock className="h-10 w-10" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-serif font-bold text-olive-accent">Caregiver Access</h2>
          <p className="text-soft-text">Enter your 4-digit security PIN</p>
        </div>

        <div className="flex space-x-4">
          {[0, 1, 2, 3].map(i => (
            <motion.div
              key={i}
              animate={error ? { x: [0, -10, 10, -10, 10, 0] } : {}}
              className={`h-6 w-6 rounded-full border-2 border-olive-accent/20 ${
                pin.length > i ? 'bg-olive-accent' : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {lockedOut && (
          <p className="text-red-500 font-bold text-center">
            Too many attempts. Locked for 5 minutes.
          </p>
        )}

        <div className="grid grid-cols-3 gap-6 w-full max-w-[300px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handlePress(num)}
              disabled={lockedOut}
              className="h-20 w-20 rounded-full bg-white shadow-md text-3xl font-bold text-olive-accent active:scale-90 transition-transform disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handlePress('0')}
            disabled={lockedOut}
            className="h-20 w-20 rounded-full bg-white shadow-md text-3xl font-bold text-olive-accent active:scale-90 transition-transform disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={lockedOut}
            className="h-20 w-20 rounded-full flex items-center justify-center text-olive-accent/40 active:scale-90 transition-transform disabled:opacity-50"
          >
            <Delete className="h-8 w-8" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
