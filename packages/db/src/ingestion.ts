import type { EventCategory, EventPriceStatus, EventStatus } from "@localloop/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

import type { DbClient } from "./client";
import {
  eventCategoriesTable,
  events,
  ingestionRuns,
  rawSourceEvents,
  sources,
  venues
} from "./schema";

export type ProviderSourceInput = {
  key: string;
  displayName: string;
  platform: string;
  metadata?: Record<string, unknown>;
};

export type ProviderVenueInput = {
  externalId?: string;
  name: string;
  displayAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

export type ProviderEventInput = {
  externalId: string;
  title: string;
  description?: string;
  sourceUrl: string;
  startAt: Date;
  endAt?: Date;
  timezone: string;
  venue: ProviderVenueInput;
  categories: EventCategory[];
  priceStatus: EventPriceStatus;
  minPriceCents?: number;
  maxPriceCents?: number;
  currency?: string;
  status: EventStatus;
  providerMetadata?: Record<string, unknown>;
  rawPayload?: {
    payload: Record<string, unknown>;
    fetchedAt: Date;
  };
};

export type ProviderEventBatchInput = {
  source: ProviderSourceInput;
  events: ProviderEventInput[];
  fetchedCount: number;
  skippedCount: number;
  metadata?: Record<string, unknown>;
};

export type ProviderLifecycleCounts = {
  insertedCount: number;
  updatedCount: number;
  expiredCount: number;
  removedCount: number;
};

export type ProviderEventLifecycleInput = {
  startAt: Date;
  endAt?: Date | null;
};

type ProviderLifecycleDb = Pick<DbClient, "update">;

export async function ensureSource(db: DbClient, source: ProviderSourceInput) {
  const [row] = await db
    .insert(sources)
    .values({
      key: source.key,
      displayName: source.displayName,
      platform: source.platform,
      metadata: source.metadata
    })
    .onConflictDoUpdate({
      target: sources.key,
      set: {
        displayName: source.displayName,
        platform: source.platform,
        metadata: source.metadata,
        updatedAt: new Date()
      }
    })
    .returning({ key: sources.key });

  if (!row) {
    throw new Error(`Failed to ensure source ${source.key}`);
  }

  return row;
}

export async function startIngestionRun(
  db: DbClient,
  sourceKey: string,
  metadata?: Record<string, unknown>
) {
  const [row] = await db
    .insert(ingestionRuns)
    .values({
      source: sourceKey,
      status: "running",
      metadata
    })
    .returning({ id: ingestionRuns.id });

  if (!row) {
    throw new Error(`Failed to start ingestion run for ${sourceKey}`);
  }

  return row;
}

export async function markIngestionRunFailed(db: DbClient, runId: string, errorMessage: string) {
  await db
    .update(ingestionRuns)
    .set({
      status: "failed",
      errorMessage,
      finishedAt: new Date()
    })
    .where(eq(ingestionRuns.id, runId));
}

export async function listRecentIngestionRuns(db: DbClient, limit = 5) {
  return db
    .select({
      source: ingestionRuns.source,
      status: ingestionRuns.status,
      startedAt: ingestionRuns.startedAt,
      finishedAt: ingestionRuns.finishedAt,
      fetchedCount: ingestionRuns.fetchedCount,
      importedCount: ingestionRuns.importedCount,
      skippedCount: ingestionRuns.skippedCount,
      errorMessage: ingestionRuns.errorMessage,
      metadata: ingestionRuns.metadata
    })
    .from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(limit);
}

export async function importProviderEventBatch(
  db: DbClient,
  batch: ProviderEventBatchInput,
  runId: string
) {
  const now = new Date();
  const lifecycleCounts: ProviderLifecycleCounts = {
    insertedCount: 0,
    updatedCount: 0,
    expiredCount: 0,
    removedCount: 0
  };

  await db.transaction(async (tx) => {
    for (const event of batch.events) {
      const venueKey = providerVenueKey(batch.source.key, event);
      const [venue] = await tx
        .insert(venues)
        .values({
          seedId: venueKey,
          name: event.venue.name,
          displayAddress: event.venue.displayAddress ?? "Address unavailable",
          locality: event.venue.locality ?? "Unknown",
          region: event.venue.region ?? "DMV",
          postalCode: event.venue.postalCode,
          location: pointFromVenue(event.venue)
        })
        .onConflictDoUpdate({
          target: venues.seedId,
          set: {
            name: event.venue.name,
            displayAddress: event.venue.displayAddress ?? "Address unavailable",
            locality: event.venue.locality ?? "Unknown",
            region: event.venue.region ?? "DMV",
            postalCode: event.venue.postalCode,
            location: pointFromVenue(event.venue),
            updatedAt: now
          }
        })
        .returning({ id: venues.id });

      if (!venue) {
        throw new Error(`Failed to upsert venue for provider event ${event.externalId}`);
      }

      const [existingEvent] = await tx
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.source, batch.source.key), eq(events.externalId, event.externalId)))
        .limit(1);

      const [eventRow] = await tx
        .insert(events)
        .values({
          source: batch.source.key,
          sourceId: providerEventSourceId(batch.source.key, event.externalId),
          externalId: event.externalId,
          title: event.title,
          description: event.description,
          venueId: venue.id,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: event.timezone,
          priceStatus: event.priceStatus,
          minPriceCents: event.minPriceCents,
          maxPriceCents: event.maxPriceCents,
          currency: event.currency,
          sourceUrl: event.sourceUrl,
          status: event.status,
          providerMetadata: event.providerMetadata,
          lastSeenAt: now
        })
        .onConflictDoUpdate({
          target: [events.source, events.externalId],
          set: {
            sourceId: providerEventSourceId(batch.source.key, event.externalId),
            title: event.title,
            description: event.description,
            venueId: venue.id,
            startAt: event.startAt,
            endAt: event.endAt,
            timezone: event.timezone,
            priceStatus: event.priceStatus,
            minPriceCents: event.minPriceCents,
            maxPriceCents: event.maxPriceCents,
            currency: event.currency,
            sourceUrl: event.sourceUrl,
            status: event.status,
            providerMetadata: event.providerMetadata,
            lastSeenAt: now,
            updatedAt: now
          }
        })
        .returning({ id: events.id });

      if (!eventRow) {
        throw new Error(`Failed to upsert provider event ${event.externalId}`);
      }

      if (existingEvent) {
        lifecycleCounts.updatedCount += 1;
      } else {
        lifecycleCounts.insertedCount += 1;
      }

      await tx.delete(eventCategoriesTable).where(eq(eventCategoriesTable.eventId, eventRow.id));
      await tx.insert(eventCategoriesTable).values(
        event.categories.map((category) => ({
          eventId: eventRow.id,
          category
        }))
      );

      if (event.rawPayload) {
        await tx
          .insert(rawSourceEvents)
          .values({
            source: batch.source.key,
            externalId: event.externalId,
            payload: event.rawPayload.payload,
            payloadHash: hashPayload(event.rawPayload.payload),
            fetchedAt: event.rawPayload.fetchedAt,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: [rawSourceEvents.source, rawSourceEvents.externalId],
            set: {
              payload: event.rawPayload.payload,
              payloadHash: hashPayload(event.rawPayload.payload),
              fetchedAt: event.rawPayload.fetchedAt,
              updatedAt: now
            }
          });
      }
    }

    lifecycleCounts.expiredCount = await expirePastProviderEvents(tx, batch.source.key, now);

    await tx
      .update(ingestionRuns)
      .set({
        status: "succeeded",
        finishedAt: now,
        fetchedCount: batch.fetchedCount,
        importedCount: lifecycleCounts.insertedCount + lifecycleCounts.updatedCount,
        skippedCount: batch.skippedCount,
        metadata: {
          ...batch.metadata,
          lifecycle: {
            ...lifecycleCounts,
            removalReconciliation: "deferred",
            removalReconciliationReason:
              "Bounded provider results do not prove absent provider events were removed."
          }
        }
      })
      .where(eq(ingestionRuns.id, runId));
  });

  return {
    importedCount: lifecycleCounts.insertedCount + lifecycleCounts.updatedCount,
    skippedCount: batch.skippedCount,
    ...lifecycleCounts
  };
}

export async function expirePastProviderEvents(
  db: ProviderLifecycleDb,
  sourceKey: string,
  now = new Date()
) {
  const expiredRows = await db
    .update(events)
    .set({
      status: "expired",
      updatedAt: now
    })
    .where(
      and(
        eq(events.source, sourceKey),
        eq(events.status, "active"),
        sql`coalesce(${events.endAt}, ${events.startAt}) < ${now.toISOString()}::timestamptz`
      )
    )
    .returning({ id: events.id });

  return expiredRows.length;
}

export function providerEventExpiresBefore(event: ProviderEventLifecycleInput) {
  return event.endAt ?? event.startAt;
}

export function isProviderEventExpired(event: ProviderEventLifecycleInput, now = new Date()) {
  return providerEventExpiresBefore(event).getTime() < now.getTime();
}

function providerEventSourceId(sourceKey: string, externalId: string) {
  return `${sourceKey}:${externalId}`;
}

function providerVenueKey(sourceKey: string, event: ProviderEventInput) {
  return `${sourceKey}:venue:${event.venue.externalId ?? event.externalId}`;
}

function pointFromVenue(venue: ProviderVenueInput) {
  if (venue.latitude === undefined || venue.longitude === undefined) {
    return undefined;
  }

  return `SRID=4326;POINT(${venue.longitude} ${venue.latitude})`;
}

function hashPayload(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
