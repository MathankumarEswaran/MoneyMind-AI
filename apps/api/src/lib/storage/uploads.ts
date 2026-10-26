import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";

export async function ensureUploadDir(): Promise<string> {
  const dir = path.resolve(env.upload.storageDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveUpload(buffer: Buffer, originalName: string): Promise<{ storageKey: string; absolutePath: string }> {
  const dir = await ensureUploadDir();
  const ext = path.extname(originalName) || "";
  const storageKey = `${randomUUID()}${ext}`;
  const absolutePath = path.join(dir, storageKey);
  await fs.writeFile(absolutePath, buffer);
  return { storageKey, absolutePath };
}

export async function readUpload(storageKey: string): Promise<Buffer> {
  const dir = await ensureUploadDir();
  const absolutePath = path.join(dir, storageKey);
  return fs.readFile(absolutePath);
}
