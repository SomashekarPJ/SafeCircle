import React, { useState } from 'react';
import { Home, Loader2 } from 'lucide-react';
import { getUserHomeLocation, getCurrentLocation, buildGoogleMapsWalkingURL } from '../services/locationService';
import { motion } from 'motion/react';

interface TakeMeHomeButtonProps {
  userId: string;
}

export const TakeMeHomeButton: React.FC<TakeMeHomeButtonProps> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNavigate = async () => {
    setLoading(true);
    setError(null);
    try {
      const home = await getUserHomeLocation(userId);
      if (!home) {
        throw new Error('Home address not found. Please set your home location in settings.');
      }

      await getCurrentLocation(); 
      const url = buildGoogleMapsWalkingURL(home.lat, home.lng);
      window.open(url, '_blank');
    } catch (err) {
      console.error('[TakeMeHome] Error:', err);
      setError(err instanceof Error ? err.message : 'Could not get directions. Please ask someone nearby for help.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mb-12 relative group">
      <motion.button
        id="btn-take-me-home"
        onClick={handleNavigate}
        disabled={loading}
        animate={!loading ? { scale: [1, 1.01, 1] } : {}}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className={`w-full h-28 rounded-[40px] flex items-center justify-between px-10 shadow-2xl transition-all relative overflow-hidden ${
          loading ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-[#4A90E2] hover:bg-[#357ABD] active:scale-95 group-hover:shadow-[#4A90E2]/20'
        }`}
      >
        <div className="absolute top-0 right-0 p-8 text-9xl font-serif font-black text-white/5 leading-none pointer-events-none group-hover:scale-110 transition-transform duration-700">HOME</div>
        
        <div className="relative flex items-center space-x-6">
          <div className="h-16 w-16 rounded-3xl bg-white/10 flex items-center justify-center backdrop-blur-md">
            {loading ? (
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            ) : (
              <Home className="h-8 w-8 text-white" />
            )}
          </div>
          <div className="text-left">
            <span className="block text-2xl font-serif font-black text-white leading-none uppercase tracking-tight">
              {loading ? 'Plotting Route' : 'Find My Way Home'}
            </span>
            <span className="text-[10px] text-white/70 font-bold uppercase tracking-widest mt-2 block">Safety Navigation Active</span>
          </div>
        </div>

        <div className="relative hidden md:block">
           <div className="px-4 py-2 rounded-full border border-white/20 text-[10px] font-bold text-white uppercase tracking-widest">Secure Path</div>
        </div>
      </motion.button>
      
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-x-0 -bottom-16 bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center space-x-3 shadow-xl"
        >
           <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
           <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{error}</p>
        </motion.div>
      )}
    </div>
  );
};
