import { bookings, createDatabase, defaultPricingRules, events, type Database } from "@repo/database";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "./createApp.js";

const url = process.env.DATABASE_URL;
const runDbTests = process.env.RUN_DB_TESTS === "true";
const ROW_TAG = "__vitest_concurrency__";

if (runDbTests && !url) {
  throw new Error("RUN_DB_TESTS=true but DATABASE_URL is missing for concurrency tests.");
}

describe.skipIf(!url || !runDbTests)("Concurrent bookings", () => {
  let shutdownDb!: () => Promise<void>;
  let db!: Database;
  let eventId!: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    process.env.ADMIN_API_KEY ??= "test-admin";

    const pool = createDatabase(url!);
    db = pool.db;
    shutdownDb = pool.close.bind(pool);

    const prior = await db.select({ id: events.id }).from(events).where(eq(events.description, ROW_TAG));
    for (const p of prior) {
      await db.delete(bookings).where(eq(bookings.eventId, p.id));
    }
    await db.delete(events).where(eq(events.description, ROW_TAG));

    const inserted = await db
      .insert(events)
      .values({
        name: "Concurrency lab",
        eventDate: new Date(Date.now() + 86_400_000),
        venue: "Test bench",
        description: ROW_TAG,
        totalTickets: 1,
        bookedTickets: 0,
        basePriceCents: 1_500,
        currentPriceCents: 1_500,
        floorPriceCents: 900,
        ceilingPriceCents: 4_000,
        pricingRules: defaultPricingRules(),
      })
      .returning({ id: events.id });

    const row = inserted[0];
    if (!row) throw new Error("Failed to seed concurrency event");
    eventId = row.id;
    app = createApp(db, { time: 1, demand: 1, inventory: 1 });
  });

  afterAll(async () => {
    if (!db || !eventId) return;
    await db.delete(bookings).where(eq(bookings.eventId, eventId));
    await db.delete(events).where(eq(events.id, eventId));
    await shutdownDb();
  });

  it("prevents overbooking of last ticket", async () => {
    const a = request(app)
      .post("/bookings")
      .send({ eventId, userEmail: "buyer-one@test.dev", quantity: 1 });
    const b = request(app)
      .post("/bookings")
      .send({ eventId, userEmail: "buyer-two@test.dev", quantity: 1 });
    const [ra, rb] = await Promise.all([a, b]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual([201, 409]);

    const list = await request(app).get("/bookings").query({ eventId });
    expect(list.status).toBe(200);
    expect(list.body.bookings).toHaveLength(1);
  });
});
