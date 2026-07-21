import { promises as fs } from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");

const keyToFile = (key: string) =>
  path.join(CACHE_DIR, `${key.toLowerCase().replace(/[^a-z0-9_-]+/gi, "-")}.json`);

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(keyToFile(key), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(keyToFile(key), JSON.stringify(value, null, 2), "utf8");
  } catch {
    // Cache write failures are non-fatal (e.g. read-only serverless FS).
  }
}
