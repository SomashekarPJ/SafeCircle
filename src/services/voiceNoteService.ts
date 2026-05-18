import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';

export async function uploadVoiceNote(userId: string, routineId: string, audioBlob: Blob, senderName: string): Promise<string> {
  try {
    const storagePath = `voiceNotes/${userId}/${routineId}/${Date.now()}.webm`;
    const storageRef = ref(storage, storagePath);
    
    await uploadBytes(storageRef, audioBlob);
    const downloadURL = await getDownloadURL(storageRef);
    
    await updateDoc(doc(db, 'users', userId, 'routines', routineId), {
      voiceNoteUrl: downloadURL,
      voiceNoteSenderName: senderName
    });
    
    return downloadURL;
  } catch (error) {
    console.error('[VoiceNoteService] Upload error:', error);
    throw error;
  }
}

export async function getVoiceNote(userId: string, routineId: string): Promise<{ url: string, senderName: string } | null> {
  try {
    const routineDoc = await getDoc(doc(db, 'users', userId, 'routines', routineId));
    if (routineDoc.exists()) {
      const data = routineDoc.data();
      if (data.voiceNoteUrl && data.voiceNoteSenderName) {
        return {
          url: data.voiceNoteUrl,
          senderName: data.voiceNoteSenderName
        };
      }
    }
    return null;
  } catch (error) {
    console.error('[VoiceNoteService] Fetch error:', error);
    return null;
  }
}

export function playVoiceNote(url: string): HTMLAudioElement {
  const audio = new Audio(url);
  audio.volume = 0.85;
  audio.play();
  return audio;
}
