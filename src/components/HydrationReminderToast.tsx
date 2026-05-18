import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Droplets, Check, Clock } from 'lucide-react';
import { logHydrationDrink } from '../services/hydrationService';

interface HydrationReminderToastProps {
  userId: string;
  onDismiss: () => void;
}

export const HydrationReminderToast: React.FC<HydrationReminderToastProps> = ({ userId, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 120000); // 2 minutes
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDrank = async () => {
    await logHydrationDrink(userId);
    onDismiss();
  };

  return (
    <motion.div
      initial={{ y: 150, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 150, opacity: 0 }}
      className="fixed bottom-24 left-6 right-6 z-[8000] flex justify-center"
    >
      <div className="w-full max-w-md bg-[#E3F2FD] border-2 border-[#1565C0] rounded-[32px] p-6 shadow-2xl overflow-hidden relative">
        <div className="flex items-start space-x-6">
          <div className="p-4 rounded-full bg-[#1565C0]/10 text-[#1565C0] shrink-0">
            <Droplets className="h-10 w-10 animate-bounce" />
          </div>
          
          <div className="flex-1 space-y-1">
            <h3 className="text-2xl font-bold text-[#0D47A1]">Time to drink some water! 💧</h3>
            <p className="text-[#1565C0] font-medium">Staying hydrated helps you feel your best.</p>
          </div>
        </div>

        <div className="flex space-x-4 mt-6">
          <button
            onClick={handleDrank}
            className="flex-1 bg-[#1565C0] text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center space-x-2 shadow-lg shadow-blue-200 active:scale-95 transition-transform"
          >
            <Check className="h-6 w-6" />
            <span>I Drank Water!</span>
          </button>
          
          <button
            onClick={onDismiss}
            className="px-6 py-5 rounded-2xl border-2 border-[#1565C0]/20 text-[#1565C0] font-bold text-lg active:scale-95 transition-transform"
          >
            <Clock className="h-6 w-6" />
            <span className="sr-only">Later</span>
          </button>
        </div>
        
        {/* Progress Bar for Auto-dismiss */}
        <motion.div 
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 120, ease: "linear" }}
          className="absolute bottom-0 left-0 h-1 bg-[#1565C0]/20"
        />
      </div>
    </motion.div>
  );
};
