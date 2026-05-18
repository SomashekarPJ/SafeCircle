import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HomeLocation } from '../types';

export async function getUserHomeLocation(userId: string): Promise<HomeLocation | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.homeAddress && data.homeLatLng) {
        return {
          address: data.homeAddress,
          lat: data.homeLatLng.lat,
          lng: data.homeLatLng.lng
        };
      }
    }
    return null;
  } catch (error) {
    console.error('[TakeMeHome] Error fetching home location:', error);
    throw error;
  }
}

export function getCurrentLocation(): Promise<{ lat: number, lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        let message = 'Could not get your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. Please enable location access.';
        }
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  });
}

export function buildGoogleMapsWalkingURL(destLat: number, destLng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=walking`;
}
