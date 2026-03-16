// ─── FIREBASE CONFIGURATION ─────────────────────────────────
// To set up Firebase for your Performance Tracker:
//
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or use an existing one)
// 3. Go to Project Settings > General > Your apps > Add web app
// 4. Copy the firebaseConfig object and replace the placeholder below
// 5. Enable Firestore Database (Build > Firestore Database > Create database)
// 6. Enable Anonymous Authentication (Build > Authentication > Sign-in method > Anonymous)
// 7. Set Firestore rules (see firestore.rules in this project)
//
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// REPLACE THIS with your Firebase project config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Check if Firebase is configured
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};

let app, db, auth;

if (isFirebaseConfigured()) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

export { db, auth };
export { collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, deleteDoc, serverTimestamp };
export { signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut };
