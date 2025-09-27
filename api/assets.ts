import type { VercelRequest, VercelResponse } from "@vercel/node"
import path from "path"
import fs from "fs"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { pathname } = new URL(req.url!, `http://${req.headers.host}`)

  try {
    let filePath: string
    let contentType: string

    if (pathname === "/assets/styles.css") {
      filePath = path.join(process.cwd(), "assets", "styles.css")
      contentType = "text/css"
    } else if (pathname === "/assets/script.js") {
      filePath = path.join(process.cwd(), "assets", "script.js")
      contentType = "application/javascript"
    } else {
      return res.status(404).json({ error: "Asset not found" })
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" })
    }

    // Read and serve the file
    const fileContent = fs.readFileSync(filePath, "utf-8")

    res.setHeader("Content-Type", contentType)
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable")

    return res.send(fileContent)
  } catch (error) {
    console.error("Asset serving error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
