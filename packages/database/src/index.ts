import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

/** Single connection pool per process - call once at application bootstrap. */
export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
  });
  const db = drizzle(client, { schema });
  return {
    db,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

export * from "./schema.js";
export type { Database } from "./types.js";
export { runSeed, defaultPricingRules } from "./seedLib.js";
