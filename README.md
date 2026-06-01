# LocalLoop

LocalLoop is an open-source local event discovery web app for finding upcoming
DMV-area events by location, radius, date, category, and price.

This repository currently contains only the initial local development scaffold.
Real event ingestion, geocoding, radius search, authentication, email digests,
maps, and deployment are intentionally out of scope for this phase.

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
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The web app runs at <http://localhost:3000>.

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
```

## License

LocalLoop is licensed under the GNU Affero General Public License v3.0 only
(AGPL-3.0-only). See [LICENSE](LICENSE).
