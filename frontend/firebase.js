import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmSCkSrBjHqWe0ZA6li-WTSaB4vtm-tIk",
  authDomain: "battle-bots-c6965.firebaseapp.com",
  projectId: "battle-bots-c6965",
  storageBucket: "battle-bots-c6965.firebasestorage.app",
  messagingSenderId: "319178537337",
  appId: "1:319178537337:web:4a33b0b6230cb25b7e97a8",
  measurementId: "G-7PPN676K4X"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
