import { eventCategories } from "@localloop/domain";
import {
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

const geometryPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Point, 4326)";
  }
});

export const eventCategoryEnum = pgEnum("event_category", eventCategories);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    venueName: text("venue_name"),
    address: text("address"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    location: geometryPoint("location"),
    category: eventCategoryEnum("category").notNull(),
    priceCents: integer("price_cents"),
    priceLabel: text("price_label"),
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    locationIdx: index("events_location_idx").using("gist", table.location),
    startAtIdx: index("events_start_at_idx").on(table.startAt),
    categoryIdx: index("events_category_idx").on(table.category)
  })
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
