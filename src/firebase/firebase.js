import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_eFalDx4XCS14khoHJxmTkq83VAUw4vg",
  authDomain: "central-atitude.firebaseapp.com",
  projectId: "central-atitude",
  storageBucket: "central-atitude.firebasestorage.app",
  messagingSenderId: "634323769400",
  appId: "1:634323769400:web:73de330f585c9906ebeecd"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);