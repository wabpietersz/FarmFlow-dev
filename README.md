# FarmFlow

Farm management for a two-farm broiler business with its own feed mill: batches and daily
checks, health programmes, feed production at real cost, stores and purchasing, bookings and
sales, a central money ledger (every rupee tagged by category, cost centre and source),
payroll with EPF/ETF and staff advances, management P&L and cash flow, approvals and
notifications. Installable as a phone app (PWA), works offline for daily farm logs.

- **Using it:** [docs/FarmFlow-User-Guide.md](docs/FarmFlow-User-Guide.md)
- **What it does and why:** [docs/FarmFlow-Target-Functional-Spec.md](docs/FarmFlow-Target-Functional-Spec.md)
- **What was built, phase by phase:** [docs/FarmFlow-Build-Roadmap.md](docs/FarmFlow-Build-Roadmap.md)
- **Deploying:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Testing by hand:** [docs/Manual-Test-Plan.md](docs/Manual-Test-Plan.md)

## Stack

npm workspaces: `packages/shared` (types), `packages/backend` (Express 5, Drizzle ORM, Postgres 15,
Firebase Auth), `packages/frontend` (React 19, Vite, Tailwind v4, shadcn/ui, TanStack Query).
Node **22+**.

## Run it locally

```bash
docker compose up -d                     # Postgres on :5432 (and pgAdmin on :5050)
npm install
cp .env.example packages/backend/.env    # fill in DATABASE_URL, Firebase and SMTP
npm run db:migrate                       # create/update tables
npm run db:seed                          # dropdown lists (never overwrites your edits)
FARMFLOW_ADMIN_EMAIL=you@example.com npx tsx packages/backend/src/scripts/setup-admin.ts
npm run dev                              # API on :3001, app on :5173
```

`setup-admin` prints a link to choose your password; nothing is hard-coded.

## Checks

```bash
npm run lint                                   # all packages (0 errors expected)
npm run test:backend                           # unit tests (mocked database)
npm run test:integration -w packages/backend   # real Postgres: ledger, costing, payroll,
                                               # sales, approvals, farm scope, every endpoint, volume
npm run test:frontend                          # vitest
npm run build                                  # shared → backend → frontend
```

Integration tests create and recreate their own `farmflow_test` database; they never touch dev data.

## Database changes

Edit `packages/backend/src/db/schema/*`, then `npm run db:generate -w packages/backend` and
`npm run db:migrate`. In production the backend applies migrations itself on start.
Inside raw SQL sub-queries, write columns as `${qualified(table.column)}`
(`lib/sql-utils.ts`): Drizzle drops table names in single-table queries.
