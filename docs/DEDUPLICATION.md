# Event Deduplication

LocalLoop groups likely duplicate event rows for public display without merging
or deleting source records. Provider rows in `events`, category rows, venue
rows, and `raw_source_events` remain available for debugging, provider
comparison, and future review tooling.

## Data Model

Deduplication is stored separately from provider ingestion:

```text
event_groups
- id
- canonical_event_id
- created_at
- updated_at

event_group_members
- group_id
- event_id
- score
- reasons jsonb
- decision
- created_at
- updated_at
```

Decision values are:

```text
auto_group
needs_review
rejected
manual_group
manual_reject
```

Generated `auto_group`, `needs_review`, and `rejected` rows can be recomputed.
Manual decisions are reserved for future review tools.

## Scoring

The current matcher is deterministic and intentionally conservative:

```text
+40 same or very similar venue
+30 start times within 60 minutes
+20 high title similarity
+10 same or overlapping category
+10 same city/region
-50 one event appears to be an add-on and the other does not
```

An add-on can still auto-group with a parent event when the stripped title,
venue, and time strongly match.

Thresholds:

```text
score >= 80 => auto_group
score 60-79 => needs_review
score < 60 => rejected / ignored
```

These thresholds favor hiding only obvious duplicates now. They should be tuned
after reviewing real provider data.

## Add-On Filtering

Ticketmaster often returns non-event offers such as parking, VIP packages,
premium packages, club access, lounge access, fast lane, upgrades, presales,
meet and greet, merch packages, and ticket packages.

If an add-on confidently matches a parent event, it is grouped under the parent
and the public `/events` query displays the canonical parent card. If an add-on
does not confidently match a parent, dedupe records it as a rejected standalone
add-on and the default public search hides it. The source event row remains in
the database.

## Canonical Selection

When a group has multiple events, LocalLoop chooses one canonical display row:

1. Prefer non-add-on events.
2. Prefer rows with more complete venue/time data.
3. Prefer rows with a useful source URL.
4. Prefer configured source priority as a tie-breaker.
5. Prefer the earliest-created event as the final tie-breaker.

The initial source priority is `smithsonian` before `ticketmaster-discovery`
only as a late tie-breaker, not as a global provider override.

## Running Dedupe

Run dedupe after provider ingestion:

```bash
pnpm ingest:ticketmaster
pnpm ingest:smithsonian
pnpm dedupe:events
```

The command scans active upcoming events, compares candidate pairs within
same-day city/region buckets, stores group records, and prints:

```text
events scanned
candidate pairs checked
auto groups created
needs review candidates
rejected/ignored candidates
add-on events hidden
add-on events grouped
```

## Display Behavior

The public `/events` query still applies radius, date, included category,
excluded category, price, and sorting filters to matching source events. It then
resolves the displayed row to the group's canonical event and returns one card
per canonical group. If grouped events have different source URLs, the current
UI shows the canonical event source URL only.

## Known Limitations

- There is no manual review UI yet.
- Needs-review candidates are stored but not shown differently in the public UI.
- The matcher uses simple token and time rules, not external enrichment or ML.
- Venue similarity is name-based; richer address/geospatial comparison can be
  added later.
