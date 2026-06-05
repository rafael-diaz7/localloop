import {
  chooseCanonicalEvent,
  isLikelyAddonEvent,
  scoreDuplicateCandidate,
  type DuplicateComparisonEvent,
  type DuplicateScore
} from "@localloop/domain";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";

import type { DbClient } from "./client";
import { eventCategoriesTable, eventGroupMembers, eventGroups, events, venues } from "./schema";

export type DeduplicationSummary = {
  eventsScanned: number;
  candidatePairsChecked: number;
  autoGroupsCreated: number;
  needsReviewCandidates: number;
  rejectedIgnoredCandidates: number;
  addonEventsHidden: number;
  addonEventsGrouped: number;
};

type DedupeEvent = DuplicateComparisonEvent & {
  source: string;
  sourceUrl: string;
  createdAt: Date;
  locality: string;
  region: string;
};

type PairCandidate = {
  a: DedupeEvent;
  b: DedupeEvent;
  result: DuplicateScore;
};

const generatedDecisions = ["auto_group", "needs_review", "rejected"] as const;

export async function recomputeEventDeduplication(
  db: DbClient,
  now = new Date()
): Promise<DeduplicationSummary> {
  const eventsToCompare = await loadActiveUpcomingEvents(db, now);
  const summary: DeduplicationSummary = {
    eventsScanned: eventsToCompare.length,
    candidatePairsChecked: 0,
    autoGroupsCreated: 0,
    needsReviewCandidates: 0,
    rejectedIgnoredCandidates: 0,
    addonEventsHidden: 0,
    addonEventsGrouped: 0
  };
  const autoPairs: PairCandidate[] = [];
  const reviewPairs: PairCandidate[] = [];

  for (const bucketEvents of candidateBuckets(eventsToCompare).values()) {
    for (let i = 0; i < bucketEvents.length; i += 1) {
      for (let j = i + 1; j < bucketEvents.length; j += 1) {
        const a = bucketEvents[i];
        const b = bucketEvents[j];

        if (!a || !b || !isCandidatePair(a, b)) {
          continue;
        }

        summary.candidatePairsChecked += 1;

        const result = scoreDuplicateCandidate(a, b);

        if (result.decision === "auto_group") {
          autoPairs.push({ a, b, result });
        } else if (result.decision === "needs_review") {
          reviewPairs.push({ a, b, result });
          summary.needsReviewCandidates += 1;
        } else {
          summary.rejectedIgnoredCandidates += 1;
        }
      }
    }
  }

  await clearGeneratedDedupeRows(db);

  const groupedEventIds = await createAutoGroups(db, eventsToCompare, autoPairs, summary);
  await createNeedsReviewGroups(db, reviewPairs, groupedEventIds);
  await hideStandaloneAddons(db, eventsToCompare, groupedEventIds, summary);

  return summary;
}

async function loadActiveUpcomingEvents(db: DbClient, now: Date) {
  const rows = await db
    .select({
      id: events.id,
      source: events.source,
      title: events.title,
      description: events.description,
      startAt: events.startAt,
      venueName: venues.name,
      locality: venues.locality,
      region: venues.region,
      sourceUrl: events.sourceUrl,
      createdAt: events.createdAt,
      category: eventCategoriesTable.category
    })
    .from(events)
    .innerJoin(venues, eq(events.venueId, venues.id))
    .leftJoin(eventCategoriesTable, eq(events.id, eventCategoriesTable.eventId))
    .where(and(eq(events.status, "active"), gte(events.startAt, now)))
    .orderBy(asc(events.startAt), asc(events.title));

  const byId = new Map<string, DedupeEvent>();

  for (const row of rows) {
    const existing = byId.get(row.id);

    if (existing) {
      if (row.category) {
        existing.categories.push(row.category);
      }
      continue;
    }

    byId.set(row.id, {
      id: row.id,
      source: row.source,
      title: row.title,
      description: row.description,
      startAt: row.startAt,
      venueName: row.venueName,
      locality: row.locality,
      region: row.region,
      categories: row.category ? [row.category] : [],
      sourceUrl: row.sourceUrl,
      createdAt: row.createdAt
    });
  }

  return [...byId.values()];
}

function candidateBuckets(eventsToCompare: DedupeEvent[]) {
  const buckets = new Map<string, DedupeEvent[]>();

  for (const event of eventsToCompare) {
    const key = [
      normalizeBucketValue(event.region),
      normalizeBucketValue(event.locality),
      event.startAt.toISOString().slice(0, 10)
    ].join(":");
    const bucket = buckets.get(key) ?? [];

    bucket.push(event);
    buckets.set(key, bucket);
  }

  return buckets;
}

function isCandidatePair(a: DedupeEvent, b: DedupeEvent) {
  return (
    sameCityRegion(a, b) && Math.abs(a.startAt.getTime() - b.startAt.getTime()) <= 180 * 60_000
  );
}

async function clearGeneratedDedupeRows(db: DbClient) {
  await db.delete(eventGroupMembers).where(inArray(eventGroupMembers.decision, generatedDecisions));

  await db.execute(sql`
    delete from event_groups groups
    where not exists (
      select 1
      from event_group_members members
      where members.group_id = groups.id
    )
  `);
}

async function createAutoGroups(
  db: DbClient,
  eventsToCompare: DedupeEvent[],
  autoPairs: PairCandidate[],
  summary: DeduplicationSummary
) {
  const eventsById = new Map(eventsToCompare.map((event) => [event.id, event]));
  const unionFind = new UnionFind(eventsToCompare.map((event) => event.id));

  for (const pair of autoPairs) {
    unionFind.union(pair.a.id, pair.b.id);
  }

  const components = new Map<string, DedupeEvent[]>();

  for (const event of eventsToCompare) {
    const root = unionFind.find(event.id);

    if (!root) {
      continue;
    }

    const component = components.get(root) ?? [];

    component.push(event);
    components.set(root, component);
  }

  const groupedEventIds = new Set<string>();

  for (const component of components.values()) {
    if (component.length < 2) {
      continue;
    }

    const canonical = chooseCanonicalEvent(component);
    const [group] = await db
      .insert(eventGroups)
      .values({
        canonicalEventId: canonical.id
      })
      .returning({ id: eventGroups.id });

    if (!group) {
      throw new Error(`Failed to create event group for canonical event ${canonical.id}`);
    }

    const memberRows = component.map((event) => {
      const pair = bestPairForEvent(event.id, canonical.id, autoPairs);
      const score = event.id === canonical.id ? 100 : (pair?.result.score ?? 80);

      groupedEventIds.add(event.id);

      return {
        groupId: group.id,
        eventId: event.id,
        score,
        reasons: {
          reasons: event.id === canonical.id ? ["canonical_event"] : (pair?.result.reasons ?? []),
          generatedBy: "dedupe:events"
        },
        decision: "auto_group" as const
      };
    });

    await db.insert(eventGroupMembers).values(memberRows);
    summary.autoGroupsCreated += 1;
    summary.addonEventsGrouped += component.filter((event) =>
      isLikelyAddonEvent(event.title, event.description)
    ).length;
  }

  for (const pair of autoPairs) {
    if (eventsById.has(pair.a.id) && eventsById.has(pair.b.id)) {
      groupedEventIds.add(pair.a.id);
      groupedEventIds.add(pair.b.id);
    }
  }

  return groupedEventIds;
}

async function createNeedsReviewGroups(
  db: DbClient,
  reviewPairs: PairCandidate[],
  groupedEventIds: Set<string>
) {
  for (const pair of reviewPairs) {
    if (groupedEventIds.has(pair.a.id) || groupedEventIds.has(pair.b.id)) {
      continue;
    }

    const canonical = chooseCanonicalEvent([pair.a, pair.b]);
    const [group] = await db
      .insert(eventGroups)
      .values({
        canonicalEventId: canonical.id
      })
      .returning({ id: eventGroups.id });

    if (!group) {
      throw new Error(`Failed to create review event group for canonical event ${canonical.id}`);
    }

    await db.insert(eventGroupMembers).values([
      {
        groupId: group.id,
        eventId: pair.a.id,
        score: pair.result.score,
        reasons: {
          reasons: pair.result.reasons,
          generatedBy: "dedupe:events"
        },
        decision: "needs_review"
      },
      {
        groupId: group.id,
        eventId: pair.b.id,
        score: pair.result.score,
        reasons: {
          reasons: pair.result.reasons,
          generatedBy: "dedupe:events"
        },
        decision: "needs_review"
      }
    ]);
  }
}

async function hideStandaloneAddons(
  db: DbClient,
  eventsToCompare: DedupeEvent[],
  groupedEventIds: Set<string>,
  summary: DeduplicationSummary
) {
  for (const event of eventsToCompare) {
    if (groupedEventIds.has(event.id) || !isLikelyAddonEvent(event.title, event.description)) {
      continue;
    }

    const [group] = await db
      .insert(eventGroups)
      .values({
        canonicalEventId: event.id
      })
      .returning({ id: eventGroups.id });

    if (!group) {
      throw new Error(`Failed to create standalone add-on group for event ${event.id}`);
    }

    await db.insert(eventGroupMembers).values({
      groupId: group.id,
      eventId: event.id,
      score: 0,
      reasons: {
        reasons: ["standalone_addon"],
        standaloneAddon: true,
        generatedBy: "dedupe:events"
      },
      decision: "rejected"
    });
    summary.addonEventsHidden += 1;
  }
}

function bestPairForEvent(eventId: string, canonicalEventId: string, pairs: PairCandidate[]) {
  return pairs
    .filter(
      (pair) =>
        (pair.a.id === eventId && pair.b.id === canonicalEventId) ||
        (pair.b.id === eventId && pair.a.id === canonicalEventId) ||
        pair.a.id === eventId ||
        pair.b.id === eventId
    )
    .sort((a, b) => b.result.score - a.result.score)[0];
}

function normalizeBucketValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameCityRegion(a: DedupeEvent, b: DedupeEvent) {
  return (
    normalizeBucketValue(a.locality) === normalizeBucketValue(b.locality) &&
    normalizeBucketValue(a.region) === normalizeBucketValue(b.region)
  );
}

class UnionFind {
  private readonly parents = new Map<string, string>();

  constructor(ids: string[]) {
    for (const id of ids) {
      this.parents.set(id, id);
    }
  }

  find(id: string): string | undefined {
    const parent = this.parents.get(id);

    if (!parent) {
      return undefined;
    }

    if (parent === id) {
      return parent;
    }

    const root = this.find(parent);

    if (root) {
      this.parents.set(id, root);
    }

    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (!rootA || !rootB || rootA === rootB) {
      return;
    }

    this.parents.set(rootB, rootA);
  }
}
