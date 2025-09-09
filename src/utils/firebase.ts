import dotenv from "dotenv"
import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getDatabase } from "firebase-admin/database"

dotenv.config()

// Initialize Firebase Admin SDK with service account credentials from env
export function getFirebaseDb() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
      )
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    })
  }

  return getDatabase()
}
