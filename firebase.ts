
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, update, remove, runTransaction } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

/**
 * RECOMMENDED FIREBASE REALTIME DATABASE RULES:
 * (Copy and paste these into your Firebase Console -> Database -> Rules)
 * 
 * {
 *   "rules": {
 *     ".read": "true",
 *     "settings": {
 *       ".write": "auth != null && auth.token.email === 'ahmshowpic@gmail.com'",
 *       "visitorCount": {
 *         ".write": "true"
 *       }
 *     },
 *     "music": {
 *       ".write": "auth != null && auth.token.email === 'ahmshowpic@gmail.com'"
 *     },
 *     "custom_pages": {
 *       ".write": "auth != null && auth.token.email === 'ahmshowpic@gmail.com'"
 *     },
 *     "diaries": {
 *       ".write": "true"
 *     },
 *     "inbox": {
 *       ".read": "auth != null && auth.token.email === 'ahmshowpic@gmail.com'",
 *       ".write": "true"
 *     }
 *   }
 * }
 */

const firebaseConfig = {
    apiKey: "AIzaSyCUK7SXiX_uBObNqWjM5u-eKUKkCTwCJKc",
    authDomain: "mypersonalapp-2f2cc.firebaseapp.com",
    databaseURL: "https://mypersonalapp-2f2cc-default-rtdb.firebaseio.com",
    projectId: "mypersonalapp-2f2cc",
    storageBucket: "mypersonalapp-2f2cc.firebasestorage.app",
    messagingSenderId: "1093218114240",
    appId: "1:1093218114240:web:e082d82c94c286d2c6eb25",
    measurementId: "G-W8R99YNJQ9"
};

// ... (الاستيرادات في أعلى الملف كما هي)

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
