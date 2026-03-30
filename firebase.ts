import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, update, remove, runTransaction } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

// تعريف واحد فقط يستخدم متغيرات البيئة (Environment Variables)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// قراءة البريد الإلكتروني للمدير من ملف البيئة
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export { ref, onValue, push, set, update, remove, runTransaction, signInWithPopup, signOut, onAuthStateChanged };
export type { User };