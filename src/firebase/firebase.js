import { initializeApp } from "firebase/app";

import {
  getAuth,
} from "firebase/auth";

import {
  getFirestore,
} from "firebase/firestore";


// ==========================================================
// CONFIGURAÇÃO FIREBASE
// ==========================================================

const firebaseConfig = {

  apiKey:
    "AIzaSyDnXnmunkG33EBUQZQUvjVHbRgXdZF58Ds",

  authDomain:
    "central-atitude.firebaseapp.com",

  projectId:
    "central-atitude",

  storageBucket:
    "central-atitude.firebasestorage.app",

  messagingSenderId:
    "634323769400",

  appId:
    "1:634323769400:web:73de330f585c9906ebeecd",

};


// ==========================================================
// INICIALIZA FIREBASE
// ==========================================================

const app =
  initializeApp(
    firebaseConfig
  );


// ==========================================================
// FIREBASE AUTHENTICATION
// ==========================================================

export const auth =
  getAuth(app);


// ==========================================================
// FIRESTORE
// ==========================================================

export const db =
  getFirestore(app);