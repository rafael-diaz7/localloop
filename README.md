# LocalLoop

LocalLoop is an open-source local event discovery web app for finding upcoming
DMV-area events by location, radius, date, category, and price.

This repository currently contains the initial local development scaffold,
seeded development event listings backed by PostgreSQL/PostGIS, and a first
Ticketmaster Discovery API ingestion slice. The `/events` page supports
shareable URL-driven search over normalized events. Free-text geocoding,
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
<http://localhost:3000/events?near=courthouse-arlington-va&radius=10&date=next-7-days&price=any&sort=soonest>
to search normalized local event listings.

The seeded listings are fictional sample data for local development only. They
are safe to seed more than once and should not be treated as live real-world
event listings.

## Local Database And App Commands

Start PostgreSQL/PostGIS and run migrations:

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate
```

Seed fictional DMV development records:

```bash
pnpm db:seed
```

Start the app:

```bash
pnpm dev
```

The `/events` page filters normalized database records by preset DMV location,
radius, date window, included categories, excluded categories, price, and sort
order. The selected filters are encoded in the URL, so opening or sharing the
same URL reproduces the same search.

Example:

```text
/events?near=courthouse-arlington-va&radius=10&date=next-7-days&price=any&sort=soonest
```

Current location choices are fixed DMV presets for MVP development:
Courthouse, Clarendon, Dupont Circle, Old Town Alexandria, Downtown Bethesda,
and Silver Spring. Free-text address search and geocoding are not implemented
yet.

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

The `.env` file also contains local database credentials and must not be
committed.

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
<http://localhost:3000/events?near=courthouse-arlington-va&radius=10&date=next-7-days&price=any&sort=soonest>
alongside demo data when they match the selected search filters.

The initial DMV import uses the Ticketmaster event search endpoint with:
`geoPoint` for Washington, DC's center geohash, `radius=25`, `unit=miles`,
`countryCode=US`, a 30-day upcoming UTC window, `includeTBA=no`,
`includeTBD=no`, `includeTest=no`, `sort=date,asc`, `locale=en-us`, `size=100`,
and up to 5 pages. This avoids relying only on a market ID that could miss
Northern Virginia. `TICKETMASTER_INGEST_RADIUS_MILES`,
`TICKETMASTER_INGEST_CENTER_LATITUDE`,
`TICKETMASTER_INGEST_CENTER_LONGITUDE`, `TICKETMASTER_INGEST_WINDOW_DAYS`,
`TICKETMASTER_INGEST_MAX_PAGES`, and `TICKETMASTER_INGEST_PAGE_SIZE` can tune
the bounded import.

Each ingestion run records provider, requested time window, geographic scope,
pagination limits, fetch coverage, fetched/imported/inserted/updated/skipped
counts, expired counts, and skipped-event reasons in `ingestion_runs`. The
command output prints the same operational summary without printing API keys or
secret-bearing request URLs.

To inspect recent runs:

```bash
pnpm ingestion:status
```

Ticketmaster-backed events are marked `expired` when their `end_at` is in the
past, or when `start_at` is in the past and no end time exists. Active search
results continue to require `status = active`, so expired and cancelled events
do not appear as upcoming selectable events. Seed/demo events remain relative to
the seed time and continue to work for local development.

Provider-removal reconciliation is deliberately deferred. The current
Ticketmaster import is a bounded search window and may stop at
`TICKETMASTER_INGEST_MAX_PAGES`; an event missing from one bounded response does
not prove the provider removed it.

Provider usage must follow Ticketmaster's current API terms, including terms
around Event Content storage, removal requests, and monetization. This
repository documents the implemented technical behavior but does not automate
legal compliance.

## Scheduled Ticketmaster Ingestion

The homelab deployment includes repository-managed systemd units:

```text
infra/systemd/localloop-ticketmaster-ingest.service
infra/systemd/localloop-ticketmaster-ingest.timer
```

The service runs as user `goose`, uses `/home/goose/projects/localloop` as its
working directory, loads `/home/goose/projects/localloop/.env`, and executes
`pnpm ingest:ticketmaster`. It does not start the Next.js web app.

Install or refresh the units with symlinks:

```bash
sudo ln -sf /home/goose/projects/localloop/infra/systemd/localloop-ticketmaster-ingest.service /etc/systemd/system/localloop-ticketmaster-ingest.service
sudo ln -sf /home/goose/projects/localloop/infra/systemd/localloop-ticketmaster-ingest.timer /etc/systemd/system/localloop-ticketmaster-ingest.timer
sudo systemctl daemon-reload
sudo systemctl enable --now localloop-ticketmaster-ingest.timer
```

The timer runs twice daily at approximately 6:00 AM and 6:00 PM local server
time with up to 10 minutes of randomized delay.

Check the schedule and timer status:

```bash
systemctl list-timers --all | grep localloop
systemctl status localloop-ticketmaster-ingest.timer --no-pager
```

Manually trigger and inspect a run:

```bash
sudo systemctl start localloop-ticketmaster-ingest.service
sudo systemctl status localloop-ticketmaster-ingest.service --no-pager
journalctl -u localloop-ticketmaster-ingest.service -n 100 --no-pager
```

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
pnpm ingestion:status
                   Print recent ingestion run status and lifecycle counts
```

## License

LocalLoop is licensed under the GNU Affero General Public License v3.0 only
(AGPL-3.0-only). See [LICENSE](LICENSE).
