# LocalLoop

LocalLoop is an open-source local event discovery web app for finding upcoming
DMV-area events by location, radius, date, category, and price.

This repository currently contains the initial local development scaffold,
seeded development event listings backed by PostgreSQL/PostGIS, and a first
Ticketmaster Discovery API ingestion slice. Geocoding, radius search UI,
authentication, email digests, maps, and deployment are intentionally out of
scope for this phase.

## Stack

- TypeScript
- pnpm workspaces
- Next.js App Router
- Tailwind CSS
- PostgreSQL with PostGIS through Docker Compose
- Drizzle ORM
- Zod
- Vitest
- ESLint and Prettier
- GitHub Actions CI

## Requirements

- Node.js 24
- pnpm 10+
- Docker Desktop or a compatible Docker runtime

## Getting Started

```bash
pnpm install
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The web app runs at <http://localhost:3000>. Visit
<http://localhost:3000/events> to view normalized local event listings.

The seeded listings are fictional sample data for local development only. They
are safe to seed more than once and should not be treated as live real-world
event listings.

## Ticketmaster Discovery Ingestion

LocalLoop's first real provider is the public Ticketmaster Discovery API. Source
coverage is incomplete, and LocalLoop does not sell, reserve, or purchase
tickets.

Register for a Ticketmaster Discovery API key through the
[Ticketmaster Developer Portal](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/).
Add the key to your local `.env` file:

```env
TICKETMASTER_API_KEY=your_api_key_here
```

Then run the database setup and ingestion command:

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm ingest:ticketmaster
pnpm dev
```

The importer reads `.env`, requires `DATABASE_URL` and `TICKETMASTER_API_KEY`,
and never sends the API key to browser code. Imported events appear at
<http://localhost:3000/events> alongside demo data.

The initial DMV import uses the Ticketmaster event search endpoint with:
`geoPoint` for Washington, DC's center geohash, `radius=25`, `unit=miles`,
`countryCode=US`, a 30-day upcoming UTC window, `includeTBA=no`,
`includeTBD=no`, `includeTest=no`, `sort=date,asc`, `locale=en-us`, `size=100`,
and up to 5 pages. This avoids relying only on a market ID that could miss
Northern Virginia. `TICKETMASTER_INGEST_RADIUS_MILES`,
`TICKETMASTER_INGEST_WINDOW_DAYS`, `TICKETMASTER_INGEST_MAX_PAGES`, and
`TICKETMASTER_INGEST_PAGE_SIZE` can tune the bounded import.

Provider usage must follow Ticketmaster's current API terms, including terms
around Event Content storage, removal requests, and monetization. This
repository documents the implemented technical behavior but does not automate
legal compliance.

## Workspace Layout

```text
apps/web        Next.js public application
apps/worker     TypeScript worker placeholder
packages/db     Drizzle schema, config, and database client
packages/domain Shared domain models and validation
packages/providers Provider adapter interface
infra            Local infrastructure
docs             Project notes
```

## Scripts

```bash
pnpm dev           Start the web app
pnpm build         Build all workspaces
pnpm typecheck     Type-check all workspaces
pnpm lint          Run ESLint
pnpm test          Run Vitest across workspaces
pnpm format:check  Check Prettier formatting
pnpm db:migrate    Run Drizzle migrations
pnpm db:seed       Seed fictional local development events
pnpm ingest:ticketmaster
                   Import bounded upcoming DMV events from Ticketmaster
```

## License

LocalLoop is licensed under the GNU Affero General Public License v3.0 only
(AGPL-3.0-only). See [LICENSE](LICENSE).
