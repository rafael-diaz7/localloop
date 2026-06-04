import { createDbConnection, searchEvents, type SearchableEvent } from "@localloop/db";
import {
  allEventSearchCategories,
  getDmvSearchLocation,
  parseEventSearchParams,
  type EventSearchParams
} from "@localloop/domain";
import Link from "next/link";

import { EventSearchForm } from "./EventSearchForm";
import { formatCategory, formatDistanceMiles, formatEventDate, formatEventPrice } from "./format";

export const dynamic = "force-dynamic";

type EventsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const dateSummaryLabels = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  "next-7-days": "Next 7 days",
  custom: "Custom date range"
};

async function getSearchResults(filters: EventSearchParams, now: Date) {
  const connection = createDbConnection();
  const location = getDmvSearchLocation(filters.near);

  try {
    return await searchEvents(connection.db, {
      location,
      radiusMiles: filters.radius,
      dateRange: filters.dateRange,
      includedCategories: filters.include,
      excludedCategories: filters.exclude,
      price: filters.price,
      sort: filters.sort,
      now
    });
  } finally {
    await connection.close();
  }
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const rawSearchParams = searchParams ? await searchParams : undefined;
  const now = new Date();
  const parsedSearch = parseEventSearchParams(rawSearchParams, now);
  const { filters } = parsedSearch;
  const location = getDmvSearchLocation(filters.near);
  let events: SearchableEvent[] = [];
  let loadError = false;

  try {
    events = await getSearchResults(filters, now);
  } catch {
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-loop-mist text-loop-ink">
      <section className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14">
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-loop-moss underline-offset-4 hover:underline"
        >
          Back to LocalLoop
        </Link>

        <div className="mt-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-loop-moss">
            Local event listings
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
            Upcoming DMV events
          </h1>
          <p className="mt-5 text-base leading-7 text-loop-ink/75 md:text-lg">
            Search normalized LocalLoop event records from demo data and live provider ingestion.
          </p>
        </div>

        <EventSearchForm
          initialFilters={{
            near: filters.near,
            radius: filters.radius,
            date: filters.date,
            from: filters.from,
            to: filters.to,
            include: filters.include,
            exclude: filters.exclude,
            price: filters.price,
            sort: filters.sort
          }}
          categories={allEventSearchCategories()}
        />

        {parsedSearch.ignoredParams.length > 0 ? (
          <p className="mt-4 rounded-lg border border-loop-sun bg-loop-sun/25 px-4 py-3 text-sm text-loop-ink/75">
            Some unsupported filters were ignored: {parsedSearch.ignoredParams.join(", ")}.
          </p>
        ) : null}

        {loadError ? (
          <section className="mt-10 rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Events are unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-loop-ink/70">
              Start PostgreSQL/PostGIS, run migrations, and seed the database to view local
              development events.
            </p>
          </section>
        ) : (
          <EventResults
            events={events}
            summary={`Within ${filters.radius} miles of ${location.displayName} · ${formatDateSummary(filters)}`}
          />
        )}
      </section>
    </main>
  );
}

function EventResults({ events, summary }: { events: SearchableEvent[]; summary: string }) {
  return (
    <section className="mt-10">
      <div>
        <h2 className="text-2xl font-semibold">
          {events.length} {events.length === 1 ? "event" : "events"} found
        </h2>
        <p className="mt-2 text-sm text-loop-ink/65">{summary}</p>
      </div>

      {events.length === 0 ? (
        <section className="mt-6 rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">No events matched these filters</h3>
          <p className="mt-3 text-sm leading-6 text-loop-ink/70">
            Try increasing the radius, widening the date window, or removing category and price
            restrictions.
          </p>
        </section>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({ event }: { event: SearchableEvent }) {
  return (
    <article className="rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-loop-moss/20 bg-loop-mist px-3 py-1 text-xs font-semibold uppercase tracking-wide text-loop-moss">
          {formatEventPrice(event)}
        </span>
        <span className="rounded-full border border-loop-ink/10 px-3 py-1 text-xs font-semibold text-loop-ink/65">
          {formatDistanceMiles(event.distanceMiles)}
        </span>
        <time className="text-sm text-loop-ink/65" dateTime={event.startAt.toISOString()}>
          {formatEventDate(event.startAt, event.timezone)}
        </time>
      </div>

      <h3 className="mt-4 text-2xl font-semibold leading-snug">{event.title}</h3>
      {event.description ? (
        <p className="mt-3 text-sm leading-6 text-loop-ink/70">{event.description}</p>
      ) : null}

      <p className="mt-5 text-sm font-semibold text-loop-ink">
        {event.venueName}
        <span className="font-normal text-loop-ink/65">
          {" "}
          in {event.locality}, {event.region}
        </span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {event.categories.map((category) => (
          <span
            key={category}
            className="rounded-full bg-loop-sun/45 px-3 py-1 text-xs font-medium text-loop-ink"
          >
            {formatCategory(category)}
          </span>
        ))}
      </div>

      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex text-sm font-semibold text-loop-moss underline-offset-4 hover:underline"
      >
        View event
      </a>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-loop-ink/50">
        Source: {event.sourceDisplayName}
      </p>
    </article>
  );
}

function formatDateSummary(filters: EventSearchParams) {
  if (filters.date === "custom" && filters.from && filters.to) {
    return `${filters.from} to ${filters.to}`;
  }

  return dateSummaryLabels[filters.date];
}
