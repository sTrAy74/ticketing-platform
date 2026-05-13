import "./bootstrap/loadEnv.js";

import { createDefaultApp } from "./createApp.js";
import { closeDb, getDb } from "./db.js";

const port = Number(process.env.API_PORT ?? 3001);

function friendlyBootError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DATABASE_URL is not set")) {
    return [
      "API failed to start: DATABASE_URL is not set.",
      "Create `.env` from `.env.example`, then set DATABASE_URL.",
      "If using Docker: run `docker compose up -d postgres` first.",
    ].join("\n");
  }
  return `API failed to start: ${message}`;
}

function friendlyRuntimeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ECONNREFUSED") && message.includes("5432")) {
    return [
      "API runtime error: database connection refused on port 5432.",
      "Start Postgres first (`docker compose up -d postgres`) or point DATABASE_URL to a running instance.",
    ].join("\n");
  }
  return `API runtime error: ${message}`;
}

async function main() {
  try {
    const app = createDefaultApp(getDb().db);
    const server = app.listen(port, () => {
      console.log(`Ticketing API http://localhost:${port}`);
    });

    async function shutdown() {
      await closeDb();
      server.close(() => process.exit(0));
    }

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error(friendlyBootError(error));
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error(friendlyRuntimeError(reason));
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error(friendlyRuntimeError(error));
  process.exit(1);
});

void main();
