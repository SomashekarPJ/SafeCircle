import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SceneAnalysis } from '../types';

export async function saveSnapshot(userId: string, imageBase64: string, analysis: SceneAnalysis): Promise<void> {
  try {
    const snapshotsRef = collection(db, 'users', userId, 'sceneSnapshots');
    
    // Check if we already have many snapshots and delete the oldest
    const q = query(snapshotsRef, orderBy('capturedAt', 'asc'), limit(50));
    const snapshot = await getDocs(q);
    if (snapshot.size >= 50) {
      const oldestDoc = snapshot.docs[0];
      await deleteDoc(doc(db, 'users', userId, 'sceneSnapshots', oldestDoc.id));
    }

    await addDoc(snapshotsRef, {
      imageBase64,
      ...analysis,
      capturedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[SnapshotService] Error saving snapshot:', error);
  }
}

export function compressImageBase64(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 640;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      } else {
        reject(new Error('Canvas context not available'));
      }
    };
    img.onerror = () => reject(new Error('Image failed to load'));
  });
}
