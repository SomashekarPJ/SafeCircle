import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Person, Memory, Routine } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  throw new Error(errorJson);
}

export const memoryService = {
  getPeople: async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    try {
      const q = collection(db, 'users', userId, 'people');
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'people');
      return [];
    }
  },

  addPerson: async (person: Person) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await addDoc(collection(db, 'users', userId, 'people'), person);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'people');
    }
  },

  updatePerson: async (id: string, person: Partial<Person>) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'users', userId, 'people', id), person);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'people');
    }
  },

  deletePerson: async (id: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'people', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'people');
    }
  },

  deleteMemory: async (id: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'memories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'memories');
    }
  },

  deleteRoutine: async (id: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'routines', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'routines');
    }
  },

  getMemories: async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];
    try {
      const q = query(collection(db, 'users', userId, 'memories'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Memory));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'memories');
      return [];
    }
  },

  addMemory: async (memory: Memory) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await addDoc(collection(db, 'users', userId, 'memories'), memory);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'memories');
    }
  },

  getRoutines: (callback: (routines: Routine[]) => void) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return () => {};
    const q = collection(db, 'users', userId, 'routines');
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'routines');
    });
  },

  toggleRoutine: async (id: string, isCompleted: boolean) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'users', userId, 'routines', id), { isCompleted });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'routines');
    }
  },
  
  addRoutine: async (routine: Routine) => {
     const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await addDoc(collection(db, 'users', userId, 'routines'), routine);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'routines');
    }
  },

  getUserSettings: async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    try {
      const s = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
      if (s.empty) return null;
      return s.docs[0].data();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      return null;
    }
  },

  updateUserSettings: async (settings: any) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const docRef = doc(db, 'users', userId);
      await updateDoc(docRef, settings).catch(async (err) => {
        if (err.code === 'not-found') {
          const { setDoc } = await import('firebase/firestore');
          await setDoc(docRef, settings);
        } else {
          throw err;
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  }
};
