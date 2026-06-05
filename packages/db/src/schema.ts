import {
  eventCategories,
  eventGroupDecisions,
  eventPriceStatuses,
  eventStatuses
} from "@localloop/domain";
import {
  customType,
  index,
  integer,
  jsonb,
  primaryKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point, 4326)";
  }
});

export const eventCategoryEnum = pgEnum("event_category", eventCategories);
export const eventGroupDecisionEnum = pgEnum("event_group_decision", eventGroupDecisions);
export const eventPriceStatusEnum = pgEnum("event_price_status", eventPriceStatuses);
export const eventStatusEnum = pgEnum("event_status", eventStatuses);
export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", [
  "running",
  "succeeded",
  "failed"
]);

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  displayName: text("display_name").notNull(),
  platform: text("platform").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seedId: text("seed_id").notNull().unique(),
    name: text("name").notNull(),
    displayAddress: text("display_address").notNull(),
    locality: text("locality").notNull(),
    region: text("region").notNull(),
    postalCode: text("postal_code"),
    location: geographyPoint("location"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    locationIdx: index("venues_location_idx").using("gist", table.location),
    localityIdx: index("venues_locality_idx").on(table.locality)
  })
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull().default("local-seed"),
    sourceId: text("source_id").notNull().unique(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    description: text("description"),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    timezone: text("timezone").notNull(),
    priceStatus: eventPriceStatusEnum("price_status").notNull(),
    minPriceCents: integer("min_price_cents"),
    maxPriceCents: integer("max_price_cents"),
    currency: text("currency"),
    sourceUrl: text("source_url").notNull(),
    status: eventStatusEnum("status").notNull().default("active"),
    providerMetadata: jsonb("provider_metadata").$type<Record<string, unknown>>(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    startAtIdx: index("events_start_at_idx").on(table.startAt),
    statusStartAtIdx: index("events_status_start_at_idx").on(table.status, table.startAt),
    venueIdx: index("events_venue_id_idx").on(table.venueId),
    sourceExternalIdIdx: uniqueIndex("events_source_external_id_idx").on(
      table.source,
      table.externalId
    )
  })
);

export const eventCategoriesTable = pgTable(
  "event_categories",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    category: eventCategoryEnum("category").notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventId, table.category] }),
    categoryIdx: index("event_categories_category_idx").on(table.category)
  })
);

export const eventGroups = pgTable(
  "event_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalEventId: uuid("canonical_event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    canonicalEventIdx: index("event_groups_canonical_event_id_idx").on(table.canonicalEventId)
  })
);

export const eventGroupMembers = pgTable(
  "event_group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => eventGroups.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    reasons: jsonb("reasons").$type<Record<string, unknown>>().notNull(),
    decision: eventGroupDecisionEnum("decision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.groupId, table.eventId] }),
    eventDecisionIdx: index("event_group_members_event_decision_idx").on(
      table.eventId,
      table.decision
    ),
    decisionIdx: index("event_group_members_decision_idx").on(table.decision)
  })
);

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    status: ingestionRunStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    fetchedCount: integer("fetched_count").notNull().default(0),
    importedCount: integer("imported_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>()
  },
  (table) => ({
    sourceStartedAtIdx: index("ingestion_runs_source_started_at_idx").on(
      table.source,
      table.startedAt
    )
  })
);

export const rawSourceEvents = pgTable(
  "raw_source_events",
  {
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.source, table.externalId] }),
    fetchedAtIdx: index("raw_source_events_fetched_at_idx").on(table.fetchedAt)
  })
);

export type VenueRow = typeof venues.$inferSelect;
export type NewVenueRow = typeof venues.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type EventCategoryRow = typeof eventCategoriesTable.$inferSelect;
export type NewEventCategoryRow = typeof eventCategoriesTable.$inferInsert;
export type EventGroupRow = typeof eventGroups.$inferSelect;
export type NewEventGroupRow = typeof eventGroups.$inferInsert;
export type EventGroupMemberRow = typeof eventGroupMembers.$inferSelect;
export type NewEventGroupMemberRow = typeof eventGroupMembers.$inferInsert;
export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;
export type IngestionRunRow = typeof ingestionRuns.$inferSelect;
export type NewIngestionRunRow = typeof ingestionRuns.$inferInsert;
export type RawSourceEventRow = typeof rawSourceEvents.$inferSelect;
export type NewRawSourceEventRow = typeof rawSourceEvents.$inferInsert;
