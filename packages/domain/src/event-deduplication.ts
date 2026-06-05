import type { EventCategory } from "./categories";

export const eventGroupDecisions = [
  "auto_group",
  "needs_review",
  "rejected",
  "manual_group",
  "manual_reject"
] as const;

export type EventGroupDecision = (typeof eventGroupDecisions)[number];

export type DuplicateComparisonEvent = {
  id: string;
  title: string;
  description?: string | null;
  startAt: Date;
  venueName: string;
  locality?: string | null;
  region?: string | null;
  categories: EventCategory[];
};

export type DuplicateScore = {
  score: number;
  decision: Extract<EventGroupDecision, "auto_group" | "needs_review" | "rejected">;
  reasons: string[];
};

export type CanonicalEventCandidate = DuplicateComparisonEvent & {
  source?: string | null;
  sourceUrl?: string | null;
  createdAt?: Date | null;
};

export const defaultCanonicalSourcePriority = ["smithsonian", "ticketmaster-discovery"];

const addonTerms = [
  "official platinum",
  "vip package",
  "ticket package",
  "merch package",
  "meet and greet",
  "club access",
  "lounge access",
  "fast lane",
  "add on",
  "addon",
  "parking",
  "premium",
  "vip",
  "upgrade",
  "presale"
];

const addonTermPatterns = addonTerms.map(
  (term) => new RegExp(`(^|\\b)${escapeRegExp(term).replaceAll("\\ ", "\\s+")}(\\b|$)`, "i")
);

const genericTitleWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "event",
  "for",
  "live",
  "of",
  "on",
  "presented",
  "presents",
  "the",
  "with"
]);

export function normalizeEventTitle(title: string) {
  return normalizeText(stripAddonTerms(title));
}

export function isLikelyAddonEvent(title: string, description?: string | null) {
  const text = [title, description].filter(Boolean).join(" ");

  return addonTermPatterns.some((pattern) => pattern.test(text));
}

export function eventTitleSimilarity(a: string, b: string) {
  return tokenSimilarity(titleTokens(a), titleTokens(b));
}

export function venueSimilarity(a: string, b: string) {
  return tokenSimilarity(tokens(normalizeText(a)), tokens(normalizeText(b)));
}

export function timeSimilarity(a: Date, b: Date) {
  const diffMinutes = Math.abs(a.getTime() - b.getTime()) / 60_000;

  if (diffMinutes <= 60) {
    return 1;
  }

  if (isSameUtcCalendarDay(a, b) && diffMinutes <= 180) {
    return 0.5;
  }

  return 0;
}

export function scoreDuplicateCandidate(
  a: DuplicateComparisonEvent,
  b: DuplicateComparisonEvent
): DuplicateScore {
  let score = 0;
  const reasons: string[] = [];
  const venueScore = venueSimilarity(a.venueName, b.venueName);
  const timeScore = timeSimilarity(a.startAt, b.startAt);
  const titleScore = eventTitleSimilarity(a.title, b.title);
  const samePlace = sameCityRegion(a, b);
  const categoryOverlap = categoriesOverlap(a.categories, b.categories);
  const aAddon = isLikelyAddonEvent(a.title, a.description);
  const bAddon = isLikelyAddonEvent(b.title, b.description);

  if (venueScore >= 0.7) {
    score += 40;
    reasons.push("same_or_similar_venue");
  }

  if (timeScore === 1) {
    score += 30;
    reasons.push("start_times_within_60_minutes");
  } else if (timeScore === 0.5) {
    score += 15;
    reasons.push("start_times_within_180_minutes_same_day");
  }

  if (titleScore >= 0.75) {
    score += 20;
    reasons.push("high_title_similarity");
  } else if (titleScore >= 0.55) {
    score += 10;
    reasons.push("moderate_title_similarity");
  }

  if (categoryOverlap) {
    score += 10;
    reasons.push("same_or_overlapping_category");
  }

  if (samePlace) {
    score += 10;
    reasons.push("same_city_region");
  }

  if (aAddon !== bAddon) {
    score -= 50;
    reasons.push("addon_mismatch_penalty");

    if (titleScore >= 0.9 && venueScore >= 0.7 && timeScore === 1) {
      score += 30;
      reasons.push("addon_parent_title_match");
    }
  }

  return {
    score,
    // These thresholds are intentionally conservative. They favor hiding only
    // obvious duplicates now and leave borderline candidates for later review.
    decision: score >= 80 ? "auto_group" : score >= 60 ? "needs_review" : "rejected",
    reasons
  };
}

export function chooseCanonicalEvent<T extends CanonicalEventCandidate>(
  events: T[],
  sourcePriority = defaultCanonicalSourcePriority
) {
  if (events.length === 0) {
    throw new Error("Cannot choose a canonical event from an empty group");
  }

  return [...events].sort((a, b) => compareCanonicalCandidates(a, b, sourcePriority))[0] as T;
}

function stripAddonTerms(title: string) {
  return addonTermPatterns
    .reduce((value, pattern) => value.replace(pattern, " "), title)
    .replace(/\bpackages?\b/gi, " ");
}

function titleTokens(title: string) {
  return tokens(normalizeEventTitle(title)).filter((token) => !genericTitleWords.has(token));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return value ? value.split(" ") : [];
}

function tokenSimilarity(aTokens: string[], bTokens: string[]) {
  if (aTokens.length === 0 || bTokens.length === 0) {
    return 0;
  }

  const a = new Set(aTokens);
  const b = new Set(bTokens);
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;

  return union === 0 ? 0 : intersection / union;
}

function categoriesOverlap(a: EventCategory[], b: EventCategory[]) {
  return a.some((category) => b.includes(category));
}

function sameCityRegion(a: DuplicateComparisonEvent, b: DuplicateComparisonEvent) {
  return (
    Boolean(a.locality && b.locality && normalizeText(a.locality) === normalizeText(b.locality)) &&
    Boolean(a.region && b.region && normalizeText(a.region) === normalizeText(b.region))
  );
}

function isSameUtcCalendarDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compareCanonicalCandidates(
  a: CanonicalEventCandidate,
  b: CanonicalEventCandidate,
  sourcePriority: string[]
) {
  const addonDelta =
    Number(isLikelyAddonEvent(a.title, a.description)) -
    Number(isLikelyAddonEvent(b.title, b.description));

  if (addonDelta !== 0) {
    return addonDelta;
  }

  const completenessDelta = completenessScore(b) - completenessScore(a);

  if (completenessDelta !== 0) {
    return completenessDelta;
  }

  const sourceUrlDelta =
    Number(hasUsefulSourceUrl(b.sourceUrl)) - Number(hasUsefulSourceUrl(a.sourceUrl));

  if (sourceUrlDelta !== 0) {
    return sourceUrlDelta;
  }

  const priorityDelta =
    sourcePriorityIndex(a.source, sourcePriority) - sourcePriorityIndex(b.source, sourcePriority);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return createdAtValue(a) - createdAtValue(b);
}

function completenessScore(event: CanonicalEventCandidate) {
  return [
    event.venueName && normalizeText(event.venueName) !== "unknown venue",
    event.locality && normalizeText(event.locality) !== "unknown",
    event.region && normalizeText(event.region) !== "dmv",
    Number.isFinite(event.startAt.getTime())
  ].filter(Boolean).length;
}

function hasUsefulSourceUrl(value: string | null | undefined) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function sourcePriorityIndex(source: string | null | undefined, sourcePriority: string[]) {
  const index = source ? sourcePriority.indexOf(source) : -1;

  return index === -1 ? sourcePriority.length : index;
}

function createdAtValue(event: CanonicalEventCandidate) {
  return event.createdAt instanceof Date ? event.createdAt.getTime() : Number.MAX_SAFE_INTEGER;
}
