Built this project to match the assignment requirements, but kept it practical and testable.

Tech stack used: Turborepo, Next.js 15, Express, Drizzle ORM, PostgreSQL, TypeScript.

I kept pricing logic isolated in `@repo/pricing` (pure functions), DB schema/seed in `@repo/database`, API flow in `apps/api`, and UI in `apps/web`.

Pricing uses the 3 required signals:
- time to event
- booking demand in the last hour
- remaining inventory

Formula used:
`currentPrice = basePrice * (1 + weighted adjustments)`
Then clamped to floor/ceiling.

Rule weights are env-based (`PRICING_WEIGHT_TIME`, `PRICING_WEIGHT_DEMAND`, `PRICING_WEIGHT_INVENTORY`) so pricing can be tuned without code edits.

Overbooking prevention is done inside a DB transaction with row locking (`SELECT ... FOR UPDATE`) in `POST /bookings`.
So when two users race for the last ticket, one succeeds and one fails (covered by automated concurrency test).

README-required parts are implemented:
- schema for events/bookings
- required endpoints (`/events`, `/bookings`, `/analytics`, `/seed`)
- required pages (`/events`, `/events/[id]`, `/bookings/success`, `/my-bookings`)
- pricing unit tests + booking flow/concurrency DB tests

Extra feature I added for faster testing: admin time controls.
- `GET /dev/sim-time` to inspect simulated clock
- `PUT /dev/sim-time` to change speed (`pause`, `realtime`, `x2`, `x5`, `x10`)
- `POST /dev/sim-time/align-window` to jump to `base`, `week`, `tomorrow`, `start`
- `/admin` page to use this without API tools

This made review much easier because pricing behavior can be verified in minutes instead of waiting for real time.
Feature is gated by `ENABLE_TIME_SIMULATION`.

How to run this project:

1. Install dependencies
```bash
npm install
```

2. Start Postgres
```bash
docker compose up -d postgres
```

3. Load env (copy from `.env.example` once if needed), then push schema and seed
```bash
set -a && source .env && set +a && npx --yes pnpm@9.14.4 --filter @repo/database db:push && npx --yes pnpm@9.14.4 --filter @repo/database db:seed
```

4. Start API + Web
```bash
npm run dev
```

5. Open app
Web: `http://localhost:3002`
API: `http://localhost:3001`

Test commands:
- default tests:
```bash
npm test
```
- include DB integration/concurrency tests:
```bash
set -a && source .env && set +a && RUN_DB_TESTS=true npm test
```
