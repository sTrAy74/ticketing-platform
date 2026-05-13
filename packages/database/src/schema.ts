import type { PricingRulesConfig } from "@repo/pricing";
import {
  bigint,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  eventDate: timestamp("event_date", { mode: "date", withTimezone: true }).notNull(),
  venue: text("venue").notNull(),
  description: text("description").notNull().default(""),
  totalTickets: integer("total_tickets").notNull(),
  bookedTickets: integer("booked_tickets").notNull().default(0),
  basePriceCents: integer("base_price_cents").notNull(),
  /** Denormalized last computed listing price; authoritative price is recomputed via rules + clock. */
  currentPriceCents: integer("current_price_cents").notNull(),
  floorPriceCents: integer("floor_price_cents").notNull(),
  ceilingPriceCents: integer("ceiling_price_cents").notNull(),
  pricingRules: jsonb("pricing_rules").notNull().$type<PricingRulesConfig>(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  userEmail: text("user_email").notNull(),
  quantity: integer("quantity").notNull(),
  /** Unit price computed at reservation time - quantity multiplies totals for payment snapshot. */
  unitPriceCentsSnapshot: integer("unit_price_cents_snapshot").notNull(),
  totalPaidCents: integer("total_paid_cents").notNull(),
  /** Clock used for demand windows / reproducible pricing - equals API “simulation” or real `Date.now()`. */
  pricingContextMs: bigint("pricing_context_ms", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
