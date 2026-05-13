import { createDatabase, type Database } from "@repo/database";

let cached: { db: Database; close: () => Promise<void> } | null = null;

export function getDb(): { db: Database; close: () => Promise<void> } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached) cached = createDatabase(url);
  return cached;
}

export async function closeDb(): Promise<void> {
  if (!cached) return;
  await cached.close();
  cached = null;
}

export type DbClient = Database;
