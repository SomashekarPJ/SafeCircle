import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, BookOpen, Calendar, LogOut, Plus, Trash2, Edit2, Check, X, Shield, Activity, Settings, MapPin, Droplets, Lock, Mic, Search, ChevronLeft } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Person, Memory, Routine } from '../types';
import { VoiceNoteRecorder } from './VoiceNoteRecorder';
import { WeeklyReportCard } from './WeeklyReportCard';
import { ObjectFinderPanel } from './ObjectFinderPanel';

import { MonitoringMap } from './MonitoringMap';

interface CaregiverDashboardProps {
  userId: string;
  onExit: () => void;
  onBackToPatient?: () => void;
}

export const CaregiverDashboard: React.FC<CaregiverDashboardProps> = ({ userId, onExit, onBackToPatient }) => {
  const [activeTab, setActiveTab] = useState<'people' | 'memories' | 'routines' | 'insights' | 'intelligence' | 'settings'>('insights');
  const [people, setPeople] = useState<Person[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<any>(null);

  useEffect(() => {
    const unsubPeople = onSnapshot(collection(db, 'users', userId, 'people'), (s) => {
      setPeople(s.docs.map(d => ({ id: d.id, ...d.data() } as Person)));
    });
    const unsubMemories = onSnapshot(query(collection(db, 'users', userId, 'memories'), orderBy('date', 'desc')), (s) => {
      setMemories(s.docs.map(d => ({ id: d.id, ...d.data() } as Memory)));
    });
    const unsubRoutines = onSnapshot(collection(db, 'users', userId, 'routines'), (s) => {
      setRoutines(s.docs.map(d => ({ id: d.id, ...d.data() } as Routine)));
      setLoading(false);
    });
    const unsubSettings = onSnapshot(doc(db, 'users', userId), (s) => {
      if (s.exists()) {
        setUserSettings(s.data());
      }
    });

    return () => {
      unsubPeople();
      unsubMemories();
      unsubRoutines();
      unsubSettings();
    };
  }, [userId]);

  const updateSetting = async (field: string, value: any) => {
    try {
      await updateDoc(doc(db, 'users', userId), { [field]: value });
    } catch (err) {
      console.error('Error updating setting:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[101] bg-[#F8F8F5] flex text-ink-charcoal font-sans">
      {/* Sidebar - Precision Aesthetic */}
      <nav className="w-[300px] bg-white border-r border-ink-charcoal/10 flex flex-col p-10 space-y-12 shrink-0 relative shadow-2xl shadow-olive-accent/[0.02]">
        <div className="space-y-6">
          {onBackToPatient && (
            <button 
              onClick={onBackToPatient}
              className="w-full flex items-center justify-center space-x-3 p-6 rounded-[28px] bg-[#8A9A5B] text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-[#8A9A5B]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back to Patient</span>
            </button>
          )}

          <div className="pt-6 border-t border-ink-charcoal/10">
            <h1 className="text-2xl font-serif font-black tracking-tight leading-none uppercase text-olive-accent">SafeCircle</h1>
            <div className="flex items-center space-x-2 mt-2">
              <div className="h-2 w-2 rounded-full bg-[#8A9A5B] animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#8A9A5B]">SafeCircle Link</span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
           <SidebarLink active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={<Activity />} label="Dashboard" />
           <SidebarLink active={activeTab === 'people'} onClick={() => setActiveTab('people')} icon={<Users />} label="Heart Memories" />
           <SidebarLink active={activeTab === 'routines'} onClick={() => setActiveTab('routines')} icon={<Calendar />} label="Care Schedules" />
           <SidebarLink active={activeTab === 'intelligence'} onClick={() => setActiveTab('intelligence')} icon={<Search />} label="Find Objects" />
           <SidebarLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Security" />
        </div>

        <div className="mt-auto">
           <button 
             onClick={onExit}
             className="w-full flex items-center justify-between p-6 rounded-[28px] bg-[#F8F8F5] hover:bg-ink-charcoal hover:text-white transition-all duration-500 group shadow-lg shadow-olive-accent/[0.03]"
           >
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">Close Session</span>
             <LogOut className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-all duration-500 transform group-hover:translate-x-1" />
           </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 bg-warm-bg overflow-y-auto p-12 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'insights' && (
            <motion.div 
              key="insights"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto space-y-12"
            >
              <div className="flex justify-between items-end">
                 <div className="space-y-4">
                   <h2 className="text-4xl font-serif font-medium tracking-tight text-[#2D2D2A]">Dashboard Overview</h2>
                 </div>
                 <button className="bg-[#8A9A5B] text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#8A9A5B]/20 flex items-center space-x-2">
                    <Plus className="h-3 w-3" />
                    <span>Log Activity</span>
                 </button>
              </div>

              <div className="grid grid-cols-12 gap-6">
                {/* Weekly Health Summary Card */}
                <div className="col-span-8 space-y-6">
                  <WeeklyReportCard userId={userId} />

                  {/* Recent Events Timeline */}
                  <div className="bento-card bg-white p-8 border border-olive-accent/5">
                    <h3 className="text-sm font-bold uppercase tracking-widest opacity-60 mb-8 border-b border-olive-accent/5 pb-4 text-olive-accent">Recent Events</h3>
                    <div className="space-y-6">
                       <TimelineEvent icon={<Check />} title="Medication Taken" status="Pill Verified" time="10:30 AM" />
                       <TimelineEvent icon={<MapPin />} title="Left Safe Zone" status="Resolved" time="Yesterday" color="text-amber-600" />
                       <TimelineEvent icon={<Mic />} title="Recorded Voice Note" status="Morning Routine" time="8:15 AM" />
                    </div>
                  </div>
                </div>

                {/* Monitoring Sidebar Card */}
                <div className="col-span-4 space-y-6">
                   <div className="bento-card border border-[#8A9A5B]/20 bg-white p-8 flex flex-col h-[600px]">
                      <div className="mb-6 flex items-center justify-between">
                         <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 rounded-full bg-[#8A9A5B] animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A9A5B]">Live Monitoring</span>
                         </div>
                         <button className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity">Expand</button>
                      </div>
                      
                      <div className="flex-1 min-h-0 mb-8">
                         <MonitoringMap userId={userId} />
                      </div>

                      <div className="space-y-4">
                         <div className="p-4 bg-warm-bg rounded-2xl flex items-center justify-between">
                            <span className="text-xs font-bold opacity-60 uppercase tracking-widest">Safe Zone Status</span>
                            <span className="text-xs font-bold text-[#8A9A5B] uppercase tracking-widest">In Range</span>
                         </div>
                         <button className="w-full py-4 border border-[#8A9A5B] text-[#8A9A5B] text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-[#8A9A5B] hover:text-white transition-all">Geofence Settings</button>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'intelligence' && (
            <div className="h-[calc(100vh-80px)] -m-8 overflow-hidden">
               <ObjectFinderPanel userId={userId} onClose={() => setActiveTab('insights')} isIntegrated />
            </div>
          )}

          {activeTab === 'people' && (
            <motion.div key="people" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-5xl mx-auto space-y-8">
               <h2 className="text-4xl font-serif font-medium tracking-tight">Heart Memories</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {people.map(p => (
                   <div key={p.id} className="bento-card bg-white hover:shadow-xl transition-all group overflow-hidden p-0">
                      <div className="h-48 w-full bg-warm-bg relative">
                         {p.imageUrl ? <img src={p.imageUrl} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all opacity-80" /> : <div className="h-full w-full flex items-center justify-center opacity-40"><Users className="h-12 w-12" /></div>}
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <h4 className="text-xl font-serif">{p.name}</h4>
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{p.relationship}</p>
                        </div>
                        <div className="flex justify-end space-x-2">
                           <button className="p-2 rounded-lg bg-warm-bg hover:bg-olive-accent hover:text-white transition-colors text-olive-accent hover:text-white"><Edit2 className="h-3 w-3" /></button>
                           <button onClick={() => deleteDoc(doc(db, 'users', userId, 'people', p.id!))} className="p-2 rounded-lg bg-olive-accent/5 text-olive-accent/40 hover:bg-olive-accent hover:text-white transition-colors"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                   </div>
                 ))}
                 <button className="bento-card bg-white border-2 border-dashed border-olive-accent/10 hover:border-[#8A9A5B]/30 flex flex-col items-center justify-center py-24 space-y-4 group">
                    <div className="p-4 rounded-full bg-warm-bg group-hover:bg-[#8A9A5B]/10 transition-colors">
                      <Plus className="h-6 w-6 opacity-40 group-hover:opacity-100 group-hover:text-[#8A9A5B]" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 text-olive-accent">Add Person</span>
                 </button>
               </div>
            </motion.div>
          )}

          {activeTab === 'memories' && (
            <motion.div key="memories" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-5xl mx-auto space-y-8">
               <div className="flex justify-between items-end">
                  <h2 className="text-4xl font-serif font-medium tracking-tight">Narrative History</h2>
                  <button className="bg-[#8A9A5B] text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-[#8A9A5B]/20 flex items-center space-x-2">
                    <Plus className="h-3 w-3" />
                    <span>New Memory</span>
                  </button>
               </div>
               <div className="space-y-4">
                  {memories.map(m => (
                    <div key={m.id} className="bento-card bg-white flex items-center justify-between group hover:shadow-md transition-shadow">
                       <div className="flex items-center space-x-6">
                          <div className="h-12 w-12 rounded-xl bg-warm-bg flex items-center justify-center text-[#8A9A5B]">
                             <BookOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-lg font-serif">{m.title}</h4>
                            <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">{new Date(m.date).toLocaleDateString()}</p>
                          </div>
                       </div>
                       <button onClick={() => deleteDoc(doc(db, 'users', userId, 'memories', m.id!))} className="opacity-0 group-hover:opacity-100 p-2 text-ink-charcoal/40 hover:text-ink-charcoal hover:bg-ink-charcoal/5 rounded-xl transition-all"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}

          {activeTab === 'routines' && (
            <motion.div key="routines" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-5xl mx-auto space-y-8">
               <div className="flex justify-between items-end">
                  <h2 className="text-4xl font-serif font-medium tracking-tight">Daily Protocols</h2>
               </div>
               <div className="space-y-4">
                  {routines.map(r => (
                    <div key={r.id} className="bento-card bg-white space-y-6">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6">
                             <div className="text-xl font-mono opacity-60 text-olive-accent">{r.time}</div>
                             <div>
                               <h4 className="text-xl font-serif">{r.title}</h4>
                               <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">{r.type}</p>
                             </div>
                          </div>
                          <div className={`h-3 w-3 rounded-full ${r.isCompleted ? 'bg-green-500' : 'bg-warm-bg'}`} />
                       </div>
                       <div className="p-4 bg-warm-bg rounded-2xl">
                          <VoiceNoteRecorder userId={userId} routineId={r.id!} routineName={r.title} onUploaded={() => {}} />
                       </div>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
             <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-5xl mx-auto space-y-12">
                <h2 className="text-4xl font-serif font-medium tracking-tight">System Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="bento-card bg-white p-8 space-y-6">
                      <div className="flex items-center space-x-3 mb-2">
                        <MapPin className="h-5 w-5 text-[#8A9A5B]" />
                        <h3 className="text-sm font-bold uppercase tracking-widest opacity-60">Safety Zone</h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2 block">Home Address</label>
                          <input 
                            type="text" 
                            className="w-full bg-warm-bg p-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8A9A5B]/20 transition-all"
                            value={userSettings?.homeAddress || ''}
                            onChange={(e) => updateSetting('homeAddress', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2 block">Latitude</label>
                            <input 
                              type="number" 
                              step="any"
                              className="w-full bg-warm-bg p-4 rounded-xl text-sm focus:outline-none"
                              value={userSettings?.homeLatLng?.lat || ''}
                              onChange={(e) => updateSetting('homeLatLng', { ...userSettings?.homeLatLng, lat: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2 block">Longitude</label>
                            <input 
                              type="number" 
                              step="any"
                              className="w-full bg-warm-bg p-4 rounded-xl text-sm focus:outline-none"
                              value={userSettings?.homeLatLng?.lng || ''}
                              onChange={(e) => updateSetting('homeLatLng', { ...userSettings?.homeLatLng, lng: parseFloat(e.target.value) })}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2 block">Radius (Meters)</label>
                          <input 
                            type="number" 
                            className="w-full bg-warm-bg p-4 rounded-xl text-sm focus:outline-none"
                            value={userSettings?.safeZoneRadiusMeters || 500}
                            onChange={(e) => updateSetting('safeZoneRadiusMeters', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                   </div>

                   <div className="bento-card bg-white p-8 space-y-6">
                      <div className="flex items-center space-x-3 mb-2">
                        <Lock className="h-5 w-5 text-[#8A9A5B]" />
                        <h3 className="text-sm font-bold uppercase tracking-widest opacity-40">Access Control</h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2 block">Caregiver PIN</label>
                          <input 
                            type="password" 
                            maxLength={4}
                            className="w-full bg-warm-bg p-4 rounded-xl text-2xl tracking-[0.5em] focus:outline-none"
                            value={userSettings?.caregiverPin || ''}
                            onChange={(e) => updateSetting('caregiverPin', e.target.value)}
                          />
                        </div>
                      </div>
                   </div>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

function SidebarLink({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center space-x-6 px-6 py-5 rounded-[22px] transition-all duration-300 relative group ${
        active ? 'bg-[#8A9A5B]/10 text-[#8A9A5B]' : 'text-olive-accent/40 hover:text-[#2D2D2A] hover:bg-olive-accent/[0.02]'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: "h-5 w-5" })}
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.1em]">{label}</span>
      
      {active && (
        <motion.div 
          layoutId="sidebar-active-pill" 
          className="absolute left-1 top-3 bottom-3 w-1 bg-[#8A9A5B] rounded-full" 
        />
      )}
    </button>
  );
}

function InsightStatus({ icon, title, status, color }: { icon: React.ReactNode, title: string, status: string, color: string }) {
  return (
    <div className={`p-6 rounded-[24px] ${color} space-y-3`}>
       <div className="flex items-center space-x-2 opacity-60">
          {React.cloneElement(icon as React.ReactElement<any>, { className: "h-3 w-3" })}
          <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
       </div>
       <p className="text-sm font-bold tracking-tight">{status}</p>
    </div>
  );
}

function TimelineEvent({ icon, title, status, time, color = "" }: { icon: React.ReactNode, title: string, status: string, time: string, color?: string }) {
  return (
    <div className="flex items-center space-x-4 group">
       <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-warm-bg group-hover:bg-[#8A9A5B]/10 transition-colors">
          {React.cloneElement(icon as React.ReactElement<any>, { className: "h-4 w-4" })}
       </div>
       <div className="flex-1">
          <h4 className="text-sm font-bold tracking-tight">{title}</h4>
          <p className={`text-[10px] opacity-70 font-bold uppercase tracking-widest ${color}`}>{status}</p>
       </div>
       <span className="text-[10px] font-mono opacity-60">{time}</span>
    </div>
  );
}

function DashboardTabV2({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count: string }) {
  return (
    <button 
      onClick={onClick}
      className={`group px-8 py-6 border-b border-olive-accent/10 text-left flex items-start justify-between transition-all relative overflow-hidden ${
        active ? 'bg-olive-accent text-white' : 'hover:bg-olive-accent/5'
      }`}
    >
       <div className="space-y-4">
          <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: "h-4 w-4" })}
          </div>
          <p className="text-[11px] font-mono uppercase font-bold tracking-widest leading-tight pr-12">{label}</p>
       </div>
       <span className={`text-[10px] font-mono transition-opacity duration-300 ${active ? 'opacity-60' : 'opacity-40'}`}>[{count}]</span>
       
       {active && (
         <motion.div layoutId="active-nav-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-[#F27D26]" />
       )}
    </button>
  );
}
