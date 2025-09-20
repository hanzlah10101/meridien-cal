import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getAuth } from "firebase-admin/auth"
import { getApps, initializeApp, cert } from "firebase-admin/app"

// Initialize Firebase Admin if not already initialized
function initializeFirebaseAdmin() {
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
}

export interface AuthenticatedUser {
  uid: string
  email?: string
  email_verified?: boolean
  name?: string
}

export async function authenticateRequest(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedUser | null> {
  try {
    // Initialize Firebase Admin if needed
    initializeFirebaseAdmin()

    const authHeader = req.headers.authorization
    const token =
      authHeader && authHeader.toString().startsWith("Bearer ")
        ? authHeader.toString().slice(7)
        : null

    if (!token) {
      res.status(401).json({
        error: "Authentication token required",
        code: "AUTH_TOKEN_MISSING"
      })
      return null
    }

    // Verify the Firebase ID token
    const auth = getAuth()
    const decodedToken = await auth.verifyIdToken(token)

    // Return user info
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      name: decodedToken.name
    }
  } catch (error) {
    console.error("Authentication error:", error)

    // Handle specific Firebase Auth errors
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        res.status(401).json({
          error: "Token expired",
          code: "AUTH_TOKEN_EXPIRED"
        })
        return null
      }
      if (error.message.includes("invalid")) {
        res.status(401).json({
          error: "Invalid token",
          code: "AUTH_TOKEN_INVALID"
        })
        return null
      }
    }

    res.status(401).json({
      error: "Authentication failed",
      code: "AUTH_FAILED"
    })
    return null
  }
}
