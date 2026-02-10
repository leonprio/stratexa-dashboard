// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

export const firebaseConfig = {
  apiKey: "AIzaSyCChhyWoODY73zTuOJhfX5vMbxyN-HwmV0",
  authDomain: "prior-01.firebaseapp.com",
  projectId: "prior-01",
  storageBucket: "prior-01.firebasestorage.app",
  messagingSenderId: "568084253557",
  appId: "1:568084253557:web:e5b7985513a4c21cd5213c",
  measurementId: "G-LMS2KXKHMT",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
