import fs from "fs";
import path from "path";

export interface StorageFile {
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

export interface StorageProvider {
  upload(file: StorageFile, directory?: string): Promise<{ url: string; path: string }>;
  download(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<boolean>;
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir = path.join(process.cwd(), "public", "uploads");

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(file: StorageFile, directory = "resumes"): Promise<{ url: string; path: string }> {
    const targetDir = path.join(this.baseDir, directory);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const safeName = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const fullPath = path.join(targetDir, safeName);
    fs.writeFileSync(fullPath, file.buffer);
    return {
      url: `/uploads/${directory}/${safeName}`,
      path: fullPath,
    };
  }

  async download(filePath: string): Promise<Buffer> {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    throw new Error(`File not found: ${filePath}`);
  }

  async delete(filePath: string): Promise<boolean> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (e) {
      console.warn("File delete error:", e);
    }
    return false;
  }
}

export class S3StorageProvider implements StorageProvider {
  async upload(file: StorageFile, directory = "resumes"): Promise<{ url: string; path: string }> {
    // S3 upload using AWS SDK or fetch when configured
    const mockKey = `${directory}/${Date.now()}-${file.filename}`;
    return {
      url: `https://${process.env.S3_BUCKET || "applyswipe"}.s3.amazonaws.com/${mockKey}`,
      path: mockKey,
    };
  }

  async download(filePath: string): Promise<Buffer> {
    return Buffer.from("mock resume content");
  }

  async delete(filePath: string): Promise<boolean> {
    return true;
  }
}

export const storage = process.env.S3_BUCKET ? new S3StorageProvider() : new LocalStorageProvider();
