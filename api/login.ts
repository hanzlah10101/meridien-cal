import type { VercelRequest, VercelResponse } from "@vercel/node"
import { readFileSync } from "fs"
import { join } from "path"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Serve the login HTML file
    const filePath = join(process.cwd(), "assets", "login.html")
    const fileContent = readFileSync(filePath, "utf8")

    res.setHeader("Content-Type", "text/html")
    res.status(200).send(fileContent)
  } catch (error) {
    console.error("Error serving login page:", error)
    res.status(500).json({ error: "Failed to load login page" })
  }
}
