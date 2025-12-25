
import * as appModule from 'firebase/app';
// Fix: use namespaced import for auth to avoid "no exported member" error
import * as authModule from 'firebase/auth';
import * as firestoreModule from 'firebase/firestore';
import * as storageModule from 'firebase/storage';
import * as analyticsModule from 'firebase/analytics';

// Fix: Extract methods from namespaced modules
const { initializeApp, getApps, getApp } = appModule as any;
const { getFirestore } = firestoreModule as any;
const { getStorage } = storageModule as any;
const { getAnalytics } = analyticsModule as any;

const firebaseConfig = {
  apiKey: "AIzaSyBBVJHwmVwZxu1nnRvCG5EZdm8uUrKquKU",
  authDomain: "socialicons-6a669.firebaseapp.com",
  projectId: "socialicons-6a669",
  storageBucket: "socialicons-6a669.firebasestorage.app",
  messagingSenderId: "178009480690",
  appId: "1:178009480690:web:76bc2925a947bd8f525f6b",
  measurementId: "G-RC59SLBYBV"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Fix: Access getAuth from the namespaced module with any casting
export const auth = (authModule as any).getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;