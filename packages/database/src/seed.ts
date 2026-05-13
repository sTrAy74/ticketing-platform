import { createDatabase } from "./index.js";
import { runSeed } from "./seedLib.js";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} must be set to run seed`);
  return v;
}

async function main() {
  const { db, close } = createDatabase(requireEnv("DATABASE_URL"));
  const inserted = await runSeed(db);
  console.log(`Seeded ${inserted} events (with sample booking velocity data on the matinee)`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
