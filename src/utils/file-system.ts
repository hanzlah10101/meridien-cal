import path from "path"

// File system utilities for serving static public assets
export class FileSystemUtils {
  private static getBasePath(): string {
    return process.cwd()
  }

  static getPublicPath(): string {
    return path.join(this.getBasePath(), "assets")
  }
}
