# LocalLoop MVP

LocalLoop's MVP direction is a local event discovery experience for DMV-area
events. Users should eventually be able to search by location, radius, date,
category, and price, then subscribe to weekly digests.

Current implemented milestone: developers can run PostgreSQL/PostGIS locally,
apply migrations, seed fictional DMV-area event data, and view a read-only
database-backed `/events` listing in the web app.

This document is a placeholder for product scope, architecture notes, and
milestones. The current implementation intentionally stops short of real event
ingestion, geocoding, radius search, authentication, email digests, maps, and
deployment.
