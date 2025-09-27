import type { VercelRequest, VercelResponse } from "@vercel/node"
import { checkAuthStatus } from "../src/middleware/auth"
import path from "path"
import fs from "fs"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { pathname } = new URL(req.url!, `http://${req.headers.host}`)

  try {
    if (pathname === "/" || pathname === "/events") {
      // Check authentication for events page
      const isAuthenticated = await checkAuthStatus(req as any)

      if (!isAuthenticated && pathname === "/events") {
        // Redirect to login if not authenticated
        return res.redirect(302, "/login")
      } else if (!isAuthenticated) {
        // Redirect from root to login if not authenticated
        return res.redirect(302, "/login")
      }

      // Serve events page if authenticated
      const htmlPath = path.join(process.cwd(), "assets", "events.html")
      const htmlContent = fs.readFileSync(htmlPath, "utf-8")
      res.setHeader("Content-Type", "text/html")
      return res.send(htmlContent)
    }

    if (pathname === "/login") {
      // Always serve login page
      const htmlPath = path.join(process.cwd(), "assets", "login.html")
      const htmlContent = fs.readFileSync(htmlPath, "utf-8")
      res.setHeader("Content-Type", "text/html")
      return res.send(htmlContent)
    }

    // For other routes, return 404
    return res.status(404).json({ error: "Not found" })
  } catch (error) {
    console.error("Route handler error:", error)
    // On error, redirect to login
    return res.redirect(302, "/login")
  }
}
