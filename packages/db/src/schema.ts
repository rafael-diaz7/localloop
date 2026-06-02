import { eventCategories, eventPriceStatuses, eventStatuses } from "@localloop/domain";
import {
  customType,
  index,
  integer,
  primaryKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point, 4326)";
  }
});

export const eventCategoryEnum = pgEnum("event_category", eventCategories);
export const eventPriceStatusEnum = pgEnum("event_price_status", eventPriceStatuses);
export const eventStatusEnum = pgEnum("event_status", eventStatuses);

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
    location: geographyPoint("location").notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    startAtIdx: index("events_start_at_idx").on(table.startAt),
    statusStartAtIdx: index("events_status_start_at_idx").on(table.status, table.startAt),
    venueIdx: index("events_venue_id_idx").on(table.venueId)
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

export type VenueRow = typeof venues.$inferSelect;
export type NewVenueRow = typeof venues.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type EventCategoryRow = typeof eventCategoriesTable.$inferSelect;
export type NewEventCategoryRow = typeof eventCategoriesTable.$inferInsert;
