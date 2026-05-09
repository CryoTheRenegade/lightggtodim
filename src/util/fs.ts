import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJsonFile<T>(path: string): Promise<T> {
  const body = await readFile(path, "utf8");
  return JSON.parse(body) as T;
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await ensureParentDir(path);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeTextFile(path: string, value: string): Promise<void> {
  await ensureParentDir(path);
  await writeFile(path, value, "utf8");
}

export async function ensureParentDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}
