import { access, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = process.env.STORAGE_PATH || path.join(process.cwd(), "storage");

export function getStorageRoot(): string {
  return ROOT;
}

export async function ensureStorageReady(): Promise<void> {
  await mkdir(ROOT, { recursive: true });
  const probe = path.join(ROOT, ".write_probe");
  await writeFile(probe, "ok", "utf-8");
  await unlink(probe).catch(() => undefined);
}

export async function blobExists(key: string): Promise<boolean> {
  try {
    await access(path.join(ROOT, key));
    return true;
  } catch {
    return false;
  }
}

export function isENOENT(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export async function saveBlob(buffer: Buffer, ext: string): Promise<string> {
  const key = `${randomUUID()}${ext}`;
  const full = path.join(ROOT, key);
  await ensureStorageReady();
  await writeFile(full, buffer);
  return key;
}

export async function readBlob(key: string): Promise<Buffer> {
  return readFile(path.join(ROOT, key));
}

export async function deleteBlob(key: string): Promise<void> {
  try {
    await unlink(path.join(ROOT, key));
  } catch {
    /* ignore */
  }
}

export function storagePath(key: string): string {
  return path.join(ROOT, key);
}

export async function getStorageInfo(): Promise<{
  root: string;
  writable: boolean;
  persistentHint: boolean;
}> {
  const root = ROOT;
  const persistentHint = root.startsWith("/data/") || root.includes("/mnt/");
  let writable = false;
  try {
    await ensureStorageReady();
    writable = true;
  } catch {
    writable = false;
  }
  return { root, writable, persistentHint };
}
