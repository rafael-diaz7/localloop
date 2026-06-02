import {
  eventCategorySchema,
  eventPriceStatusSchema,
  type EventCategory,
  type EventPriceStatus
} from "@localloop/domain";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDbConnection } from "./client";
import { eventCategoriesTable, events, sources, venues } from "./schema";

type SeedVenue = {
  seedId: string;
  name: string;
  displayAddress: string;
  locality: string;
  region: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
};

type SeedEvent = {
  sourceId: string;
  title: string;
  description?: string;
  venueSeedId: string;
  startsInDays: number;
  startHourUtc: number;
  durationMinutes?: number;
  categories: EventCategory[];
  priceStatus: EventPriceStatus;
  minPriceCents?: number;
  maxPriceCents?: number;
  currency?: string;
  sourceUrl: string;
};

const TIMEZONE = "America/New_York";
const SOURCE = "local-seed";

export const seedVenues = [
  {
    seedId: "arlington-loop-hall",
    name: "Arlington Loop Hall",
    displayAddress: "3100 Wilson Blvd",
    locality: "Arlington",
    region: "VA",
    postalCode: "22201",
    latitude: 38.8809,
    longitude: -77.1024
  },
  {
    seedId: "dc-riverfront-pavilion",
    name: "DC Riverfront Pavilion",
    displayAddress: "355 Water St SE",
    locality: "Washington",
    region: "DC",
    postalCode: "20003",
    latitude: 38.8755,
    longitude: -77.0005
  },
  {
    seedId: "alexandria-courtyard",
    name: "Alexandria Courtyard",
    displayAddress: "120 King St",
    locality: "Alexandria",
    region: "VA",
    postalCode: "22314",
    latitude: 38.8048,
    longitude: -77.0403
  },
  {
    seedId: "silver-spring-commons",
    name: "Silver Spring Commons",
    displayAddress: "8601 Georgia Ave",
    locality: "Silver Spring",
    region: "MD",
    postalCode: "20910",
    latitude: 38.9977,
    longitude: -77.0278
  },
  {
    seedId: "bethesda-green",
    name: "Bethesda Green",
    displayAddress: "7700 Old Georgetown Rd",
    locality: "Bethesda",
    region: "MD",
    postalCode: "20814",
    latitude: 38.9869,
    longitude: -77.0966
  }
] satisfies SeedVenue[];

export const seedEvents = [
  {
    sourceId: "local-seed:porch-jazz-evening",
    title: "Porch Jazz Evening",
    description: "A fictional neighborhood jazz set for LocalLoop development data.",
    venueSeedId: "arlington-loop-hall",
    startsInDays: 2,
    startHourUtc: 23,
    durationMinutes: 120,
    categories: ["music", "community"],
    priceStatus: "free",
    sourceUrl: "https://example.com/localloop/dev/porch-jazz-evening"
  },
  {
    sourceId: "local-seed:riverfront-makers-market",
    title: "Riverfront Makers Market",
    description: "Development-only market listing with local craft and food stalls.",
    venueSeedId: "dc-riverfront-pavilion",
    startsInDays: 4,
    startHourUtc: 15,
    durationMinutes: 300,
    categories: ["community", "food-drink"],
    priceStatus: "unknown",
    sourceUrl: "https://example.com/localloop/dev/riverfront-makers-market"
  },
  {
    sourceId: "local-seed:old-town-dessert-walk",
    title: "Old Town Dessert Walk",
    description: "A fictional tasting route for exercising paid event cards.",
    venueSeedId: "alexandria-courtyard",
    startsInDays: 5,
    startHourUtc: 22,
    durationMinutes: 90,
    categories: ["food-drink"],
    priceStatus: "paid",
    minPriceCents: 1800,
    maxPriceCents: 2800,
    currency: "USD",
    sourceUrl: "https://example.com/localloop/dev/old-town-dessert-walk"
  },
  {
    sourceId: "local-seed:screenprint-night",
    title: "Screenprint Night",
    description: "Development-only arts workshop sample data.",
    venueSeedId: "silver-spring-commons",
    startsInDays: 7,
    startHourUtc: 23,
    durationMinutes: 150,
    categories: ["arts-culture", "education"],
    priceStatus: "paid",
    minPriceCents: 1200,
    maxPriceCents: 1200,
    currency: "USD",
    sourceUrl: "https://example.com/localloop/dev/screenprint-night"
  },
  {
    sourceId: "local-seed:morning-park-loop",
    title: "Morning Park Loop",
    description: "A fictional low-key walking group for outdoors sample coverage.",
    venueSeedId: "bethesda-green",
    startsInDays: 8,
    startHourUtc: 13,
    durationMinutes: 75,
    categories: ["outdoors", "sports-fitness"],
    priceStatus: "free",
    sourceUrl: "https://example.com/localloop/dev/morning-park-loop"
  },
  {
    sourceId: "local-seed:small-stage-story-hour",
    title: "Small Stage Story Hour",
    description: "Development-only performance listing for card layout testing.",
    venueSeedId: "arlington-loop-hall",
    startsInDays: 10,
    startHourUtc: 20,
    durationMinutes: 60,
    categories: ["arts-culture", "family"],
    priceStatus: "free",
    sourceUrl: "https://example.com/localloop/dev/small-stage-story-hour"
  },
  {
    sourceId: "local-seed:neighborhood-history-tour",
    title: "Neighborhood History Tour",
    description: "A fictional museum-and-tour style event for seeded development data.",
    venueSeedId: "dc-riverfront-pavilion",
    startsInDays: 12,
    startHourUtc: 16,
    durationMinutes: 110,
    categories: ["arts-culture", "education"],
    priceStatus: "paid",
    minPriceCents: 900,
    maxPriceCents: 1500,
    currency: "USD",
    sourceUrl: "https://example.com/localloop/dev/neighborhood-history-tour"
  },
  {
    sourceId: "local-seed:alleyway-night-market",
    title: "Alleyway Night Market",
    description: "A fictional nightlife and market listing for LocalLoop development.",
    venueSeedId: "silver-spring-commons",
    startsInDays: 14,
    startHourUtc: 0,
    durationMinutes: 240,
    categories: ["music", "food-drink", "community"],
    priceStatus: "unknown",
    sourceUrl: "https://example.com/localloop/dev/alleyway-night-market"
  }
] satisfies SeedEvent[];

function pointFromCoordinates(longitude: number, latitude: number) {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

function futureDate(now: Date, days: number, hourUtc: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export async function seedDatabase(now = new Date()) {
  validateSeedData();
  const connection = createDbConnection();

  try {
    await connection.db.transaction(async (tx) => {
      const venueIds = new Map<string, string>();

      await tx
        .insert(sources)
        .values({
          key: SOURCE,
          displayName: "Demo data",
          platform: "LocalLoop seed"
        })
        .onConflictDoUpdate({
          target: sources.key,
          set: {
            displayName: "Demo data",
            platform: "LocalLoop seed",
            updatedAt: new Date()
          }
        });

      for (const venue of seedVenues) {
        const [row] = await tx
          .insert(venues)
          .values({
            seedId: venue.seedId,
            name: venue.name,
            displayAddress: venue.displayAddress,
            locality: venue.locality,
            region: venue.region,
            postalCode: venue.postalCode,
            location: pointFromCoordinates(venue.longitude, venue.latitude)
          })
          .onConflictDoUpdate({
            target: venues.seedId,
            set: {
              name: venue.name,
              displayAddress: venue.displayAddress,
              locality: venue.locality,
              region: venue.region,
              postalCode: venue.postalCode,
              location: pointFromCoordinates(venue.longitude, venue.latitude),
              updatedAt: new Date()
            }
          })
          .returning({ id: venues.id });

        if (!row) {
          throw new Error(`Failed to seed venue ${venue.seedId}`);
        }

        venueIds.set(venue.seedId, row.id);
      }

      for (const event of seedEvents) {
        const venueId = venueIds.get(event.venueSeedId);

        if (!venueId) {
          throw new Error(`Missing seeded venue ${event.venueSeedId}`);
        }

        const startAt = futureDate(now, event.startsInDays, event.startHourUtc);
        const endAt = event.durationMinutes
          ? addMinutes(startAt, event.durationMinutes)
          : undefined;

        const [row] = await tx
          .insert(events)
          .values({
            source: SOURCE,
            sourceId: event.sourceId,
            title: event.title,
            description: event.description,
            venueId,
            startAt,
            endAt,
            timezone: TIMEZONE,
            priceStatus: event.priceStatus,
            minPriceCents: event.minPriceCents,
            maxPriceCents: event.maxPriceCents,
            currency: event.currency,
            sourceUrl: event.sourceUrl,
            status: "active"
          })
          .onConflictDoUpdate({
            target: events.sourceId,
            set: {
              title: event.title,
              description: event.description,
              venueId,
              startAt,
              endAt,
              timezone: TIMEZONE,
              priceStatus: event.priceStatus,
              minPriceCents: event.minPriceCents,
              maxPriceCents: event.maxPriceCents,
              currency: event.currency,
              sourceUrl: event.sourceUrl,
              status: "active",
              updatedAt: new Date()
            }
          })
          .returning({ id: events.id });

        if (!row) {
          throw new Error(`Failed to seed event ${event.sourceId}`);
        }

        await tx.delete(eventCategoriesTable).where(eq(eventCategoriesTable.eventId, row.id));
        await tx.insert(eventCategoriesTable).values(
          event.categories.map((category: EventCategory) => ({
            eventId: row.id,
            category
          }))
        );
      }
    });

    return {
      venues: seedVenues.length,
      events: seedEvents.length
    };
  } finally {
    await connection.close();
  }
}

export function validateSeedData() {
  const venueIds = new Set(seedVenues.map((venue) => venue.seedId));
  const eventIds = new Set(seedEvents.map((event) => event.sourceId));

  if (venueIds.size !== seedVenues.length) {
    throw new Error("Seed venue IDs must be unique");
  }

  if (eventIds.size !== seedEvents.length) {
    throw new Error("Seed event source IDs must be unique");
  }

  for (const event of seedEvents) {
    if (!venueIds.has(event.venueSeedId)) {
      throw new Error(`Seed event ${event.sourceId} references a missing venue`);
    }

    if (event.categories.length === 0) {
      throw new Error(`Seed event ${event.sourceId} must have at least one category`);
    }

    for (const category of event.categories) {
      eventCategorySchema.parse(category);
    }

    eventPriceStatusSchema.parse(event.priceStatus);
    new URL(event.sourceUrl);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = await seedDatabase();
  console.log(`Seeded ${result.venues} venues and ${result.events} events.`);
}

export type SeedEventPriceStatus = EventPriceStatus;
