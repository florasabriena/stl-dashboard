/**
 * Inisialisasi Firebase Modular SDK
 * Menggunakan variabel lingkungan VITE_FIREBASE_* dari .env.local
 * Catatan: Dashboard hanya MEMBACA data (read-only).
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inisialisasi singleton Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inisialisasi Realtime Database & Authentication
export const db = getDatabase(app);
export const auth = getAuth(app);

export default app;
