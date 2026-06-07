import { createDbConnection, getEventDetail, type EventDetail } from "@localloop/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatCategory, formatEventDate, formatEventPrice } from "../format";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await loadEvent(id);

  if (!event) {
    return {
      title: "Event not found | LocalLoop"
    };
  }

  return {
    title: `${event.title} | LocalLoop`,
    description: eventMetadataDescription(event)
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const event = await loadEvent(id);

  if (!event) {
    notFound();
  }

  const description = event.description ? excerpt(event.description, 520) : null;

  return (
    <main className="min-h-screen bg-loop-mist text-loop-ink">
      <section className="mx-auto w-full max-w-4xl px-6 py-10 md:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/events"
            className="inline-flex text-sm font-semibold text-loop-moss underline-offset-4 hover:underline"
          >
            Back to events
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-loop-ink/50">
            Source: {event.sourceDisplayName}
          </p>
        </div>

        <article className="mt-8 rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-loop-moss/20 bg-loop-mist px-3 py-1 text-xs font-semibold uppercase tracking-wide text-loop-moss">
              {formatEventPrice(event)}
            </span>
            <time className="text-sm text-loop-ink/65" dateTime={event.startAt.toISOString()}>
              {formatEventDate(event.startAt, event.timezone)}
            </time>
          </div>

          <h1 className="mt-5 text-4xl font-semibold leading-tight md:text-5xl">{event.title}</h1>

          <section className="mt-7 grid gap-5 border-y border-loop-ink/10 py-6 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-loop-ink/50">
                When
              </h2>
              <p className="mt-2 text-base font-semibold">
                {formatEventDate(event.startAt, event.timezone)}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-loop-ink/50">
                Where
              </h2>
              <p className="mt-2 text-base font-semibold">{event.venueName}</p>
              <div className="mt-1 text-sm leading-6 text-loop-ink/70">
                {event.displayAddress ? <p>{event.displayAddress}</p> : null}
                <p>
                  {event.locality}, {event.region}
                </p>
              </div>
            </div>
          </section>

          {event.categories.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {event.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-loop-sun/45 px-3 py-1 text-xs font-medium text-loop-ink"
                >
                  {formatCategory(category)}
                </span>
              ))}
            </div>
          ) : null}

          {description ? (
            <p className="mt-6 text-base leading-7 text-loop-ink/75">{description}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg bg-loop-moss px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-loop-ink"
            >
              View original event
            </a>
            <p className="max-w-xl text-xs leading-5 text-loop-ink/55">
              Event details come from supported LocalLoop sources and may change on the original
              provider site.
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}

async function loadEvent(id: string) {
  if (!uuidPattern.test(id)) {
    return null;
  }

  const connection = createDbConnection();

  try {
    return await getEventDetail(connection.db, id);
  } finally {
    await connection.close();
  }
}

function eventMetadataDescription(event: EventDetail) {
  const parts = [
    event.description ? excerpt(event.description, 120) : null,
    `${event.venueName} in ${event.locality}, ${event.region}`,
    formatEventDate(event.startAt, event.timezone)
  ].filter(Boolean);

  return excerpt(parts.join(" | "), 160);
}

function excerpt(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}
