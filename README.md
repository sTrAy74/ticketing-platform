# Ticketing Platform Monorepo

Full-stack event ticketing platform with dynamic pricing.
(in the env, I've used a demo account and cloud postgre db hosted on neon, so its easier to run and test it)
(please dont mind using the same)

## Stack

- Monorepo: Turborepo
- Frontend: Next.js 15 (App Router)
- Backend: Express + TypeScript
- Database: PostgreSQL + Drizzle ORM
- Shared packages: `@repo/database`, `@repo/pricing`

## Features

- Dynamic ticket pricing based on:
  - Time until event
  - Booking demand in the last hour
  - Remaining inventory
- Booking snapshots (unit price and total paid at booking time)
- Event analytics endpoints
- Frontend pages:
  - `/events`
  - `/events/[id]`
  - `/bookings/success`
  - `/my-bookings`
- Optional admin time controls at `/admin` (when enabled)

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm
- Docker (for local Postgres via `docker compose`) or any running PostgreSQL instance

## Installation (under 5 commands)

1. Install dependencies

```bash
npm install
```

2. Create env file

```bash
cp .env.example .env
```

3. Start PostgreSQL

```bash
docker compose up -d postgres
```

4. Push schema and seed data

```bash
set -a && source .env && set +a && npx --yes pnpm@9.14.4 --filter @repo/database db:push && npx --yes pnpm@9.14.4 --filter @repo/database db:seed
```

5. Start all apps

```bash
npm run dev
```

## Run the application

- Web: `http://localhost:3002`
- API: `http://localhost:3001`
- Health: `GET http://localhost:3001/health`

## API overview

- Events
  - `GET /events`
  - `GET /events/:id`
  - `POST /events` (requires `x-admin-api-key`)
- Bookings
  - `POST /bookings`
  - `GET /bookings?eventId=:id`
  - `GET /bookings?email=:address`
- Analytics
  - `GET /analytics/events/:id`
  - `GET /analytics/summary`
- Seed
  - `POST /seed` (requires `x-admin-api-key`)

## Concurrency control (oversell prevention)

Booking creation uses a database transaction with row-level locking:

- The `events` row is loaded with `FOR UPDATE`
- Capacity checks happen inside the same transaction
- Booking insert and ticket count update commit atomically

Expected behavior when only 1 ticket is left and 2 requests arrive together:

- Exactly one request succeeds (`201`)
- The other fails with a clear conflict (`409`)
- No oversell occurs

Automated proof exists in `apps/api/src/concurrency.test.ts` (`prevents overbooking of last ticket`), which sends two simultaneous booking requests and asserts `[201, 409]` plus exactly one persisted booking.

## Testing

Run all default tests:

```bash
npm test
```

Run DB integration and concurrency tests as well:

```bash
set -a && source .env && set +a && RUN_DB_TESTS=true npm test
```

Run specific API race-condition test only:

```bash
set -a && source .env && set +a && RUN_DB_TESTS=true npx --yes pnpm@9.14.4 --filter api test -- src/concurrency.test.ts
```

Pricing unit tests live in `packages/pricing/src/index.test.ts` and include individual rule checks, combined-rule checks, and floor/ceiling constraints.

## Environment variables

Root `.env`:

- `DATABASE_URL`: PostgreSQL connection string
- `API_PORT`: API port (default `3001`)
- `ADMIN_API_KEY`: required for admin routes (`POST /events`, `POST /seed`)
- `ENABLE_TIME_SIMULATION`: enables simulation endpoints and `/admin` time controls
- `PRICING_WEIGHT_TIME`: weight for time adjustment
- `PRICING_WEIGHT_DEMAND`: weight for demand adjustment
- `PRICING_WEIGHT_INVENTORY`: weight for inventory adjustment
- `NEXT_PUBLIC_API_URL`: browser-facing API URL
- `API_URL`: server-side API URL for Next.js

See `.env.example` for defaults.

## Useful scripts

- Root
  - `npm run dev` - run all apps
  - `npm test` - run workspace tests
  - `npm run lint`
  - `npm run check-types`
- Database package
  - `pnpm --filter @repo/database db:push`
  - `pnpm --filter @repo/database db:seed`

## Project docs

- `DESIGN.md` - implementation design notes and trade-offs
