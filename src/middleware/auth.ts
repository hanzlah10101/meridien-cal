import { Request, Response, NextFunction } from "express"
import { getAuth } from "firebase-admin/auth"
import { getFirebaseDb } from "../utils/firebase"

function initializeFirebaseAuth() {
  getFirebaseDb()
  return getAuth()
}

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string
    email?: string
    [key: string]: any
  }
}

// Helper function to check auth status without throwing errors
export const checkAuthStatus = async (req: Request): Promise<boolean> => {
  try {
    let token: string | undefined

    // Check Authorization header first
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split("Bearer ")[1]
    }

    // If no auth header, check cookies
    if (!token && req.headers.cookie) {
      const cookieMatch = req.headers.cookie.match(/firebaseToken=([^;]+)/)
      if (cookieMatch) {
        token = decodeURIComponent(cookieMatch[1])
      }
    }

    if (!token) {
      return false
    }

    const auth = initializeFirebaseAuth()
    await auth.verifyIdToken(token)

    return true
  } catch (error) {
    return false
  }
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Unauthorized: Missing or invalid authorization header"
      })
      return
    }

    // Extract the token
    const token = authHeader.split("Bearer ")[1]

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Unauthorized: No token provided"
      })
      return
    }

    // Verify the token with Firebase Auth
    const auth = initializeFirebaseAuth()
    const decodedToken = await auth.verifyIdToken(token)

    // Add user info to the request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    }

    // Continue to the next middleware/route handler
    next()
  } catch (error) {
    console.error("Auth middleware error:", error)

    // Handle specific Firebase Auth errors
    if (error instanceof Error) {
      if (error.message.includes("Firebase ID token has expired")) {
        res.status(401).json({
          success: false,
          error: "Unauthorized: Token expired"
        })
        return
      }

      if (error.message.includes("Firebase ID token has invalid signature")) {
        res.status(401).json({
          success: false,
          error: "Unauthorized: Invalid token signature"
        })
        return
      }
    }

    res.status(401).json({
      success: false,
      error: "Unauthorized: Token verification failed"
    })
  }
}
