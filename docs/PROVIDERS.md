# Provider Ingestion

LocalLoop keeps provider-specific parsing in `packages/providers` and persists
provider data through normalized database rows. The domain model should describe
LocalLoop concepts, not Ticketmaster-specific fields.

## Current Provider

`ticketmaster-discovery` uses the public Ticketmaster Discovery API event search
endpoint:

```text
https://app.ticketmaster.com/discovery/v2/events.json
```

The adapter requires `TICKETMASTER_API_KEY` server-side. The key is passed as
the Ticketmaster `apikey` query parameter and is never exposed to browser code.
LocalLoop does not implement ticket purchase, reservation, affiliate, commerce,
or image download behavior.

Ticketmaster usage is subject to the provider's current terms, including terms
around Event Content storage, removal requests, and monetization. See the
[Discovery API docs](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
and [Ticketmaster Developer Terms](https://developer.ticketmaster.com/support/terms-of-use/).
LocalLoop documents the technical behavior implemented here but does not
interpret or automate legal compliance.

## DMV Import Parameters

The first import covers a bounded upcoming DMV-area slice using a geographic
search instead of only a market ID:

| Parameter                                   | Value                                                       | Why                                                                      |
| ------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `geoPoint`                                  | geohash for Washington, DC center (`38.9072,-77.0369`)      | Uses Ticketmaster's documented geohash location filter.                  |
| `radius`                                    | `TICKETMASTER_INGEST_RADIUS_MILES`, default `25`            | Covers the initial DC, nearby Maryland, and Northern Virginia test area. |
| `unit`                                      | `miles`                                                     | Matches the radius environment variable.                                 |
| `countryCode`                               | `US`                                                        | Keeps the import in the US Discovery catalog.                            |
| `startDateTime` / `endDateTime`             | now through `TICKETMASTER_INGEST_WINDOW_DAYS`, default `30` | Bounded upcoming import.                                                 |
| `includeTBA` / `includeTBD` / `includeTest` | `no`                                                        | Avoids incomplete or test listings in the first slice.                   |
| `sort`                                      | `date,asc`                                                  | Stable upcoming ordering.                                                |
| `locale`                                    | `en-us`                                                     | Initial US English provider payload.                                     |
| `size` / `page`                             | default `100`, up to `5` pages                              | Bounded page import for local development.                               |

The docs note that `latlong` is deprecated in favor of `geoPoint`, so the
adapter encodes the configured center as a geohash.

## Field Mapping

| Ticketmaster field                                                  | LocalLoop target                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `id`                                                                | normalized external event ID and `events.external_id`         |
| `name`                                                              | `events.title`                                                |
| `url`                                                               | `events.source_url`                                           |
| `dates.start.dateTime`                                              | `events.start_at`                                             |
| `dates.end.dateTime`                                                | `events.end_at` when present                                  |
| `dates.timezone` or venue timezone                                  | `events.timezone`                                             |
| `_embedded.venues[0].name`                                          | `venues.name`                                                 |
| venue address/city/state/postal code                                | `venues.display_address`, `locality`, `region`, `postal_code` |
| venue `location.latitude` / `longitude`                             | nullable `venues.location` PostGIS point                      |
| `priceRanges`                                                       | `events.price_status`, min/max cents, currency                |
| `classifications`                                                   | `event_categories` canonical categories                       |
| `type`, `locale`, source/promoter/classification names, date status | `events.provider_metadata`                                    |
| validated event object with `images` fields removed                 | latest `raw_source_events.payload` snapshot plus hash         |

Events without `dates.start.dateTime` are skipped for now because LocalLoop
needs a concrete UTC start timestamp for listing order.

## Category Mapping

Ticketmaster classification segment, genre, sub-genre, type, and sub-type names
map to LocalLoop categories through focused keyword logic:

| Ticketmaster signal                          | LocalLoop category    |
| -------------------------------------------- | --------------------- |
| music                                        | `music`               |
| sports, fitness                              | `sports-fitness`      |
| arts, theatre/theater, comedy, dance, museum | `arts-culture`        |
| family, children, family flag                | `family`              |
| food, drink                                  | `food-drink`          |
| business, network                            | `business-networking` |
| education, lecture, workshop                 | `education`           |
| outdoor, recreation                          | `outdoors`            |
| community, festival, fair                    | `community`           |
| unmapped or uncertain                        | `other`               |

Unmapped classifications are stored as `other` rather than discarded.

## Identity And Upsert Rules

For this slice, an `events` row represents one normalized event listing from one
external source. Ticketmaster rows use:

```text
source = ticketmaster-discovery
external_id = Ticketmaster event id
source_id = ticketmaster-discovery:<Ticketmaster event id>
```

The additive unique index on `(source, external_id)` is the provider-backed
upsert identity. The existing `source_id` unique column remains populated for
compatibility with seeded data and older query assumptions.

Provider venues upsert by a stable provider venue key when Ticketmaster supplies
a venue ID. If a venue ID is missing, the event ID is used so the import remains
idempotent without inventing cross-event venue grouping.

Cross-provider duplicate grouping is deferred. A later `canonical_events` or
`event_groups` layer can group equivalent listings from multiple providers
without changing the provider event identity.

## Raw Payload Retention

`raw_source_events` stores only the latest validated payload snapshot per
`(source, external_id)`, plus a SHA-256 payload hash and fetch timestamp. Image
fields are stripped before storage because this slice does not ingest images. It
does not keep unlimited historical payloads. Retention policy must remain
compatible with the provider's current content-storage terms.

## Future Provider Checklist

- Add provider-specific validation and normalization under `packages/providers`.
- Return provider-neutral source, event, venue, category, price, and metadata
  records.
- Keep provider-specific field names out of core LocalLoop domain types.
- Use a stable `(source, external_id)` identity.
- Add sanitized fixtures and unit tests without live credentials.
- Document request parameters, field mappings, retention behavior, and known
  coverage gaps.
- Avoid implementing cross-provider duplicate grouping until a canonical event
  layer exists.
