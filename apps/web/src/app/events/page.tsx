import { createDbConnection, searchEvents, type SearchableEvent } from "@localloop/db";
import {
  allEventSearchCategories,
  parseEventSearchParams,
  type EventSearchParams
} from "@localloop/domain";
import Link from "next/link";

import { EventSearchForm } from "./EventSearchForm";
import {
  formatCategory,
  formatDistanceMiles,
  formatEventDate,
  formatEventPreviewDescription,
  formatEventPrice,
  formatEventSourceBadge
} from "./format";

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

const priceSummaryLabels = {
  any: "Any price",
  free: "Free",
  paid: "Paid",
  unknown: "Price unknown"
};

async function getSearchResults(filters: EventSearchParams, now: Date) {
  const connection = createDbConnection();

  try {
    return await searchEvents(connection.db, {
      location: filters.location,
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
  let events: SearchableEvent[] = [];
  let loadError = false;

  try {
    events = await getSearchResults(filters, now);
  } catch {
    loadError = true;
  }

  const activeSummary = formatActiveSearchSummary(filters);

  return (
    <main className="min-h-screen bg-loop-mist text-loop-ink">
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-14">
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
            location: filters.location,
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
          activeSummary={activeSummary}
        />

        {parsedSearch.ignoredParams.length > 0 ? (
          <p className="mt-4 rounded-lg border border-loop-sun bg-loop-sun/25 px-4 py-3 text-sm text-loop-ink/75">
            Some unsupported filters were ignored: {parsedSearch.ignoredParams.join(", ")}.
          </p>
        ) : null}

        {loadError ? (
          <section className="mt-10 rounded-lg border border-loop-ink/10 bg-loop-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Events are unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-loop-ink/70">
              Start PostgreSQL/PostGIS, run migrations, and seed the database to view local
              development events.
            </p>
          </section>
        ) : (
          <EventResults events={events} summary={activeSummary} />
        )}
      </section>
    </main>
  );
}

function EventResults({ events, summary }: { events: SearchableEvent[]; summary: string }) {
  return (
    <section className="mt-8 md:mt-10">
      <div className="border-b border-loop-ink/10 pb-4 md:flex md:items-end md:justify-between md:gap-6">
        <h2 className="text-2xl font-semibold">
          {events.length} {events.length === 1 ? "event" : "events"} found
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-loop-ink/65 md:text-right">{summary}</p>
      </div>

      {events.length === 0 ? (
        <section className="mt-6 rounded-lg border border-loop-ink/10 bg-loop-surface p-5 shadow-sm md:p-6">
          <h3 className="text-lg font-semibold">No events matched these filters</h3>
          <p className="mt-3 text-sm leading-6 text-loop-ink/70">
            Try increasing the radius, widening the date window, or removing category and price
            restrictions.
          </p>
        </section>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
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
    <article className="group relative rounded-lg border border-loop-ink/10 bg-loop-surface p-5 shadow-sm transition hover:border-loop-moss/30 hover:shadow-md">
      <Link
        href={`/events/${event.id}`}
        aria-label={`View details for ${event.title}`}
        className="absolute inset-0 z-10 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-loop-moss focus-visible:ring-offset-2 focus-visible:ring-offset-loop-mist"
      />

      <div className="relative z-20 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full border border-loop-moss/20 bg-loop-mist px-3 py-1 text-xs font-semibold uppercase tracking-wide text-loop-moss">
            {formatEventPrice(event)}
          </span>
          <span className="rounded-full border border-loop-ink/10 px-3 py-1 text-xs font-semibold text-loop-ink/65">
            {formatDistanceMiles(event.distanceMiles)}
          </span>
          <time
            className="basis-full text-sm font-medium text-loop-ink/70 sm:basis-auto"
            dateTime={event.startAt.toISOString()}
          >
            {formatEventDate(event.startAt, event.timezone)}
          </time>
        </div>

        <h3 className="mt-3 text-xl font-semibold leading-snug underline-offset-4 group-hover:underline">
          {event.title}
        </h3>
        {event.description ? (
          <p className="mt-2 text-sm leading-6 text-loop-ink/70">
            {formatEventPreviewDescription(event.description)}
          </p>
        ) : null}

        <p className="mt-4 text-sm font-semibold text-loop-ink">
          {event.venueName}
          <span className="font-normal text-loop-ink/65">
            {" "}
            in {event.locality}, {event.region}
          </span>
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {event.categories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-loop-sun/45 px-3 py-1 text-xs font-medium text-loop-ink"
            >
              {formatCategory(category)}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-loop-ink/10 pt-4">
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`View event on ${event.sourceDisplayName}`}
            className="pointer-events-auto inline-flex text-sm font-semibold text-loop-moss underline-offset-4 hover:underline"
          >
            View event
          </a>
          <span
            title={`Source: ${event.sourceDisplayName}`}
            className="max-w-[12rem] truncate rounded-full border border-loop-ink/10 bg-loop-mist px-2.5 py-1 text-xs font-medium text-loop-ink/60"
          >
            {formatEventSourceBadge(event.sourceDisplayName)}
          </span>
        </div>
      </div>
    </article>
  );
}

function formatDateSummary(filters: EventSearchParams) {
  if (filters.date === "custom" && filters.from && filters.to) {
    return `${filters.from} to ${filters.to}`;
  }

  return dateSummaryLabels[filters.date];
}

function formatActiveSearchSummary(filters: EventSearchParams) {
  const parts = [
    `Within ${filters.radius} miles of ${filters.location.displayName}`,
    formatDateSummary(filters)
  ];

  if (filters.include.length > 0) {
    parts.push(`Includes ${filters.include.map(formatCategory).join(", ")}`);
  }

  if (filters.exclude.length > 0) {
    parts.push(`Excludes ${filters.exclude.map(formatCategory).join(", ")}`);
  }

  if (filters.price !== "any") {
    parts.push(priceSummaryLabels[filters.price]);
  }

  if (filters.sort === "closest") {
    parts.push("Closest first");
  }

  return parts.join(" · ");
}
