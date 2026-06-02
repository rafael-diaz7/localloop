import { createDbConnection, listUpcomingEvents, type UpcomingEvent } from "@localloop/db";
import Link from "next/link";

import { formatCategory, formatEventDate, formatEventPrice } from "./format";

export const dynamic = "force-dynamic";

async function getUpcomingEvents() {
  const connection = createDbConnection();

  try {
    return await listUpcomingEvents(connection.db);
  } finally {
    await connection.close();
  }
}

export default async function EventsPage() {
  let events: UpcomingEvent[] = [];
  let loadError = false;

  try {
    events = await getUpcomingEvents();
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
            These read-only listings come from normalized LocalLoop event records. Source coverage
            is intentionally incomplete while provider ingestion is being built.
          </p>
        </div>

        {loadError ? (
          <section className="mt-10 rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Events are unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-loop-ink/70">
              Start PostgreSQL/PostGIS, run migrations, and seed the database to view local
              development events.
            </p>
          </section>
        ) : (
          <EventList events={events} />
        )}
      </section>
    </main>
  );
}

function EventList({ events }: { events: UpcomingEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="mt-10 rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">No upcoming sample events</h2>
        <p className="mt-3 text-sm leading-6 text-loop-ink/70">
          Run the local seed command to populate fictional DMV-area events.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 grid gap-5 md:grid-cols-2">
      {events.map((event) => (
        <article
          key={event.id}
          className="rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-loop-moss/20 bg-loop-mist px-3 py-1 text-xs font-semibold uppercase tracking-wide text-loop-moss">
              {formatEventPrice(event)}
            </span>
            <time className="text-sm text-loop-ink/65" dateTime={event.startAt.toISOString()}>
              {formatEventDate(event.startAt, event.timezone)}
            </time>
          </div>

          <h2 className="mt-4 text-2xl font-semibold leading-snug">{event.title}</h2>
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
            View source
          </a>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-loop-ink/50">
            Source: {event.sourceDisplayName}
          </p>
        </article>
      ))}
    </section>
  );
}
