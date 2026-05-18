import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InteractionEvent, BehaviorSummary } from '../types';

export async function logInteractionEvent(userId: string, event: InteractionEvent): Promise<void> {
  try {
    await addDoc(collection(db, 'users', userId, 'behaviorLogs'), {
      ...event,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('[BehaviorTracking] Log error:', error);
  }
}

export async function fetchWeeklyBehaviorSummary(userId: string): Promise<BehaviorSummary | null> {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const logsQuery = query(
      collection(db, 'users', userId, 'behaviorLogs'),
      where('timestamp', '>=', Timestamp.fromDate(oneWeekAgo)),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(logsQuery);
    const logs = snapshot.docs.map(doc => doc.data());

    if (logs.length === 0) return null;

    const summary: BehaviorSummary = {
      totalEvents: logs.length,
      routineCompletionRate: 0,
      geofenceBreaches: 0,
      hydrationLogs: 0,
      moodDistribution: {},
      sessionStartHours: []
    };

    let completed = 0;
    let skipped = 0;

    logs.forEach(log => {
      if (log.type === 'routine_completed') completed++;
      if (log.type === 'routine_skipped') skipped++;
      if (log.type === 'geofence_breach') summary.geofenceBreaches++;
      if (log.type === 'hydration_logged') summary.hydrationLogs++;
      if (log.type === 'mood_self_report') {
        summary.moodDistribution[log.mood] = (summary.moodDistribution[log.mood] || 0) + 1;
      }
      if (log.type === 'session_start') {
        summary.sessionStartHours.push(log.hour);
      }
    });

    summary.routineCompletionRate = (completed + skipped) > 0 ? completed / (completed + skipped) : 1;

    return summary;
  } catch (error) {
    console.error('[BehaviorTracking] Summary error:', error);
    return null;
  }
}
