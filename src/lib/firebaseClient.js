// src/lib/firebaseClient.js

import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics"; // Impor isSupported
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; 

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Inisialisasi Firebase untuk menghindari duplikasi
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Inisialisasi layanan yang aman untuk Server dan Client
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// --- PERBAIKAN DI SINI ---
// Inisialisasi Analytics hanya di sisi client (browser)
let analytics;
if (typeof window !== 'undefined') {
  // Gunakan isSupported() untuk memastikan browser mendukung Analytics
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// Ekspor semua layanan
export { db, storage, analytics, auth };