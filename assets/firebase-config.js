// Firebase client configuration for browser authentication
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

// Firebase config - these should be public as they're used in the browser
const firebaseConfig = {
  apiKey: "AIzaSyDAaZo9T9CVa2yTC-t6_WL4Ljy-Uce_IeE",
  authDomain: "meridien-cal.firebaseapp.com",
  databaseURL:
    "https://meridien-cal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "meridien-cal",
  storageBucket: "meridien-cal.firebasestorage.app",
  messagingSenderId: "872918390831",
  appId: "1:872918390831:web:f262c134a3f14ee50d0eda",
  measurementId: "G-TQ3SDN7CF6"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication
export const auth = getAuth(app)

export default app
