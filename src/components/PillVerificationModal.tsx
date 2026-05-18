import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Check, X, AlertTriangle, Phone, Loader2, Volume2 } from 'lucide-react';
import { verifyPillImage } from '../services/aiService';
import { logInteractionEvent } from '../services/behaviorTrackingService';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PillVerificationResult } from '../types';

interface PillVerificationModalProps {
  routineId: string;
  userId: string;
  medicationName: string;
  pillDescription: string;
  caregiverPhone?: string;
  onClose: () => void;
  onVerified: () => void;
}

export const PillVerificationModal: React.FC<PillVerificationModalProps> = ({
  routineId,
  userId,
  medicationName,
  pillDescription,
  caregiverPhone,
  onClose,
  onVerified
}) => {
  const [state, setState] = useState<'camera' | 'verifying' | 'result'>('camera');
  const [result, setResult] = useState<PillVerificationResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (state === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [state]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('[PillVerification] Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      
      stopCamera();
      setState('verifying');
      
      try {
        const aiResult = await verifyPillImage(base64, pillDescription);
        setResult(aiResult);
        setState('result');
        
        logInteractionEvent(userId, { 
          type: 'pill_verified', 
          routineId, 
          isMatch: aiResult.isMatch 
        });
      } catch (err) {
        console.error('[PillVerification] Verification failed:', err);
        setResult({ isMatch: false, confidence: 'low', message: 'Something went wrong. Please check with your family.' });
        setState('result');
      }
    }
  };

  const handleTakeMedication = async () => {
    try {
      await addDoc(collection(db, 'users', userId, 'medicationLogs'), {
        routineId,
        medicationName,
        takenAt: serverTimestamp(),
        verified: true
      });
      onVerified();
    } catch (err) {
      console.error('[PillVerification] Logging error:', err);
      onVerified(); // Still let them proceed in UI
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  };

  useEffect(() => {
    if (state === 'result' && result) {
      speak(result.message);
    }
  }, [state, result]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-olive-dark flex flex-col pt-safe"
    >
      {/* Header */}
      <div className="p-6 flex justify-between items-center text-white z-10">
        <h2 className="text-2xl font-bold">Pill Check: {medicationName}</h2>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10">
          <X className="h-8 w-8" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {state === 'camera' && (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col"
            >
              <div className="flex-1 bg-ink-charcoal overflow-hidden relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-[40px] border-olive-dark/40 pointer-events-none">
                  <div className="w-full h-full border-2 border-white/40 border-dashed rounded-[40px]" />
                </div>
              </div>
              <div className="p-10 bg-olive-dark text-center space-y-8">
                <p className="text-2xl font-medium text-white px-4">
                  Hold the pill clearly in front of the camera, then press capture.
                </p>
                <div className="flex justify-center">
                  <button
                    onClick={handleCapture}
                    className="h-24 w-24 rounded-full border-8 border-white p-2 flex items-center justify-center bg-transparent active:scale-90 transition-transform"
                  >
                    <div className="h-full w-full rounded-full bg-[#4A90E2]" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {state === 'verifying' && (
            <motion.div
              key="verifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-[#E3F2FD] p-10 text-center space-y-8"
            >
              <div className="relative">
                <Loader2 className="h-24 w-24 text-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-bold text-blue-900">Checking your medication...</h3>
                <p className="text-xl text-blue-700">Please wait 💙</p>
              </div>
            </motion.div>
          )}

          {state === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`absolute inset-0 flex flex-col items-center justify-center p-10 text-center space-y-10 ${
                result.isMatch ? 'bg-green-600' : 'bg-orange-600'
              }`}
            >
              <div className="h-32 w-32 rounded-full bg-white flex items-center justify-center shadow-2xl">
                {result.isMatch ? (
                  <Check className="h-20 w-20 text-green-600" />
                ) : (
                  <AlertTriangle className="h-20 w-20 text-orange-600" />
                )}
              </div>

              <div className="space-y-4 text-white">
                <h3 className="text-4xl font-black">{result.isMatch ? 'Looks correct! ✅' : 'Please Double-Check! ⚠️'}</h3>
                <p className="text-2xl font-medium leading-relaxed max-w-sm mx-auto">
                  {result.message}
                </p>
                <div className="flex justify-center pt-2">
                  <button onClick={() => speak(result.message)} className="p-3 rounded-full bg-white/20">
                    <Volume2 className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="w-full max-w-sm space-y-4">
                {result.isMatch ? (
                  <button
                    onClick={handleTakeMedication}
                    className="w-full bg-white text-green-700 py-6 rounded-[24px] font-black text-2xl shadow-xl active:scale-95 transition-transform"
                  >
                    I've Taken My Medication
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setState('camera')}
                      className="w-full bg-white text-orange-700 py-6 rounded-[24px] font-black text-2xl shadow-xl active:scale-95 transition-transform"
                    >
                      Try Again
                    </button>
                    {caregiverPhone && (
                      <a
                        href={`tel:${caregiverPhone}`}
                        className="w-full flex items-center justify-center space-x-3 bg-red-700 text-white py-6 rounded-[24px] font-black text-2xl shadow-xl active:scale-95 transition-transform"
                      >
                        <Phone className="h-8 w-8" />
                        <span>Call My Caregiver</span>
                      </a>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
