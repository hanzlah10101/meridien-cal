import fs from "fs/promises"
import path from "path"

// File system utilities with proper path resolution
export class FileSystemUtils {
  private static getBasePath(): string {
    return process.cwd()
  }

  private static getDataPath(): string {
    return process.env.VERCEL ? "/tmp" : path.join(this.getBasePath(), "assets", "data")
  }

  static getEventsFilePath(): string {
    return path.join(this.getDataPath(), "events.json")
  }

  static getPublicPath(): string {
    return path.join(this.getBasePath(), "assets", "public")
  }

  static async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      console.warn(`Failed to read file ${filePath}:`, error)
      return null
    }
  }

  static async writeJsonFile(filePath: string, data: any): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error)
      throw error
    }
  }
}
