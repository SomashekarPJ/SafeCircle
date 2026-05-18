import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HydrationSettings } from '../types';

export function scheduleHydrationReminders(userId: string, onReminder: () => void): NodeJS.Timeout | null {
  let interval: NodeJS.Timeout | null = null;
  
  const setup = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const data = userDoc.data();
      
      const enabled = data?.hydrationEnabled ?? true;
      const intervalMinutes = data?.hydrationIntervalMinutes ?? 60;
      const startHour = data?.hydrationStartHour ?? 8;
      const endHour = data?.hydrationEndHour ?? 20;

      if (!enabled) return;

      interval = setInterval(() => {
        const hour = new Date().getHours();
        if (hour >= startHour && hour < endHour) {
          onReminder();
        }
      }, intervalMinutes * 60 * 1000);
      
    } catch (error) {
      console.error('[Hydration] Setup error:', error);
    }
  };

  setup();
  
  return interval;
}

export async function logHydrationDrink(userId: string): Promise<void> {
  try {
    await addDoc(collection(db, 'users', userId, 'hydrationLogs'), {
      drankAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[Hydration] Log error:', error);
  }
}
