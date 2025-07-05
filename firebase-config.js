// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"

const firebaseConfig = {
  apiKey: "AIzaSyBXE3uEBswD__7L7jsWavsa8KNX7WouPGo",
  authDomain: "ziyogram.firebaseapp.com",
  projectId: "ziyogram",
  storageBucket: "ziyogram.firebasestorage.app",
  messagingSenderId: "890739925746",
  appId: "1:890739925746:web:1a5521cb7a683e684c666b",
  measurementId: "G-5YSQSY9WDK",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)

window.firebaseApp = app
window.db = db
window.storage = storage
window.auth = auth
