import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAA5hBvvGcG24g8tZv8vZvxhIJ5bh3Qtsg",
  authDomain: "court-reserve-9eeed.firebaseapp.com",
  projectId: "court-reserve-9eeed",
  storageBucket: "court-reserve-9eeed.firebasestorage.app",
  messagingSenderId: "502620154691",
  appId: "1:502620154691:web:310a93e591f1f08492ddf6",
  measurementId: "G-L38P5FMLTS"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
