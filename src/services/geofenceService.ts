import { doc, getDoc, addDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

let lastBreachTime = 0;

export function startGeofenceWatch(userId: string, onBreach: (lat: number, lng: number) => void): number | null {
  if (!("geolocation" in navigator)) return null;

  const setupWatch = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const data = userDoc.data();
      if (!data?.homeLatLng) return;

      const { lat: homeLat, lng: homeLng } = data.homeLatLng;
      const radius = data.safeZoneRadiusMeters || 500;

      return navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const distance = calculateDistanceMeters(latitude, longitude, homeLat, homeLng);

          if (distance > radius) {
            const now = Date.now();
            if (now - lastBreachTime > 600000) { // 10 minutes throttle
              lastBreachTime = now;
              onBreach(latitude, longitude);
            }
          }
        },
        (error) => console.error('[Geofence] Watch error:', error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    } catch (err) {
      console.error('[Geofence] Setup error:', err);
      return null;
    }
  };

  let watchId: number | null = null;
  setupWatch().then(id => {
    if (id !== undefined) watchId = id;
  });

  return watchId;
}

export function stopGeofenceWatch(watchId: number): void {
  navigator.geolocation.clearWatch(watchId);
}

export async function reportBreachToFirestore(userId: string, lat: number, lng: number): Promise<void> {
  try {
    await addDoc(collection(db, 'geofence_alerts'), {
      userId,
      lat,
      lng,
      timestamp: serverTimestamp(),
      resolved: false
    });
  } catch (error) {
    console.error('[Geofence] Report error:', error);
  }
}
