import { Request, Response, NextFunction } from "express"
import { getAuth } from "firebase-admin/auth"
import { getApps, initializeApp, cert } from "firebase-admin/app"
import dotenv from "dotenv"

dotenv.config()

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

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string
    email?: string
    email_verified?: boolean
    name?: string
  }
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize Firebase Admin if needed
    initializeFirebaseAdmin()

    const authHeader = req.headers.authorization
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null

    if (!token) {
      return res.status(401).json({
        error: "Authentication token required",
        code: "AUTH_TOKEN_MISSING"
      })
    }

    // Verify the Firebase ID token
    const auth = getAuth()
    const decodedToken = await auth.verifyIdToken(token)

    // Add user info to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      name: decodedToken.name
    }

    next()
  } catch (error) {
    console.error("Authentication error:", error)

    // Handle specific Firebase Auth errors
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        return res.status(401).json({
          error: "Token expired",
          code: "AUTH_TOKEN_EXPIRED"
        })
      }
      if (error.message.includes("invalid")) {
        return res.status(401).json({
          error: "Invalid token",
          code: "AUTH_TOKEN_INVALID"
        })
      }
    }

    return res.status(401).json({
      error: "Authentication failed",
      code: "AUTH_FAILED"
    })
  }
}

// Optional middleware for checking if user exists (for protected routes that need verified users)
export const requireVerifiedUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.email_verified) {
    return res.status(403).json({
      error: "Email verification required",
      code: "EMAIL_NOT_VERIFIED"
    })
  }
  next()
}
