import React, { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shield, MapPin } from 'lucide-react';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MonitoringMapProps {
  userId: string;
}

export const MonitoringMap: React.FC<MonitoringMapProps> = ({ userId }) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [safeZone, setSafeZone] = useState<{ lat: number; lng: number; radius: number } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', userId), (s) => {
      if (s.exists()) {
        const data = s.data();
        if (data.currentLocation) {
          setLocation(data.currentLocation);
        }
        if (data.homeLatLng) {
          setSafeZone({
            lat: data.homeLatLng.lat,
            lng: data.homeLatLng.lng,
            radius: data.safeZoneRadiusMeters || 500
          });
        }
      }
    });
    return () => unsub();
  }, [userId]);

  if (!hasValidKey) {
    return (
      <div className="w-full h-full bg-warm-bg flex flex-col items-center justify-center p-8 text-center space-y-4">
        <Shield className="h-12 w-12 text-olive-accent/20" />
        <h3 className="text-lg font-serif font-bold text-olive-accent">Map Integration Pending</h3>
        <p className="text-xs text-soft-text max-w-xs">
          Please add your <code>GOOGLE_MAPS_PLATFORM_KEY</code> in settings to enable live tracking.
        </p>
      </div>
    );
  }

  const center = location || safeZone || { lat: 0, lng: 0 };

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative border border-olive-accent/10">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={15}
          mapId="MONITORING_MAP"
          gestureHandling="greedy"
          disableDefaultUI={true}
          style={{ width: '100%', height: '100%' }}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {location && (
            <AdvancedMarker position={location} title="Current Location">
              <div className="relative">
                <div className="absolute -inset-12 bg-olive-accent/10 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]" />
                <div className="absolute -inset-6 bg-olive-accent/20 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                <div className="relative group">
                  <div className="absolute -inset-1 bg-white rounded-full shadow-lg scale-110" />
                  <Pin background="#8A9A5B" glyphColor="#fff" borderColor="#5A5A40" />
                </div>
              </div>
            </AdvancedMarker>
          )}

          {safeZone && (
            <AdvancedMarker position={{ lat: safeZone.lat, lng: safeZone.lng }} title="Home Base">
               <div className="relative group">
                  <div className="absolute -inset-8 bg-blue-500/10 rounded-full animate-pulse" />
                  <div className="relative p-3 bg-blue-500 rounded-[14px] text-white shadow-2xl border-2 border-white transform transition-transform group-hover:scale-110">
                     <Shield className="h-5 w-5" />
                  </div>
               </div>
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>

      <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-olive-accent/10 flex items-center justify-between">
         <div className="flex items-center space-x-3">
            <div className={`h-2 w-2 rounded-full ${location ? 'bg-green-500' : 'bg-gray-300'} animate-pulse`} />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Status: {location ? 'LIVE' : 'OFFLINE'}</span>
         </div>
         <button className="p-2 hover:bg-olive-accent/5 rounded-lg transition-colors">
            <MapPin className="h-4 w-4 opacity-40" />
         </button>
      </div>
    </div>
  );
};
