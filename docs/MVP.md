# LocalLoop MVP

LocalLoop's MVP direction is a local event discovery experience for DMV-area
events. Users should eventually be able to search by location, radius, date,
category, and price, then subscribe to weekly digests.

Current implemented milestone: developers can run PostgreSQL/PostGIS locally,
apply migrations, seed fictional DMV-area event data, ingest bounded
Ticketmaster Discovery events, and use `/events` to search normalized records by
fixed DMV location preset, radius, date window, category inclusion/exclusion,
price, and sort order. Search state is encoded in the URL for sharing and
reopening.

This document is a placeholder for product scope, architecture notes, and
milestones. The current implementation intentionally stops short of free-text
geocoding, weekly digest subscriptions, authentication, maps, public deployment,
and cross-provider duplicate grouping.
