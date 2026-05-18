import React, { useState, useEffect } from 'react';
import { getFullDateContext } from '../lib/dateContextUtils';
import { DateContext } from '../types';
import { motion } from 'motion/react';

export const DayWidget: React.FC = () => {
  const [context, setContext] = useState<DateContext>(getFullDateContext(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setContext(getFullDateContext(new Date()));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      role="region"
      aria-label="Current date and time"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full bg-white rounded-[48px] p-12 shadow-sm border border-olive-accent/5 mb-12 relative overflow-hidden group"
    >
      {/* Recipe 9: Oversized Anchor */}
      <div className="absolute top-0 right-0 p-8 text-[160px] font-serif font-black text-olive-accent/5 leading-none pointer-events-none group-hover:scale-105 transition-transform duration-[2s]">
        {context.dayNumber}
      </div>

      <div className="relative space-y-10">
        <div className="space-y-2">
           <div className="flex items-center space-x-3">
              <div className="h-[2px] w-8 bg-olive-accent/20" />
              <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-olive-accent/60">{context.greeting}</span>
           </div>
           <h2 className="text-7xl font-serif font-black text-olive-accent leading-none tracking-tight">
             {context.dayName}
           </h2>
        </div>
        
        <div className="flex items-end justify-between">
           <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <span className="text-2xl font-serif italic text-soft-text">{context.timeOfDay}</span>
                <span className="text-2xl" role="img" aria-hidden="true">{context.timeOfDayEmoji}</span>
              </div>
              <p className="text-lg font-medium text-soft-text opacity-60">
                {context.monthName} {context.dayNumber}, {context.year}
              </p>
           </div>
           
           <div className="hidden md:block text-right">
              <p className="text-sm font-serif italic text-olive-accent/80 max-w-[200px] leading-relaxed">
                "{context.contextSentence}"
              </p>
           </div>
        </div>
      </div>
    </motion.div>
  );
};
