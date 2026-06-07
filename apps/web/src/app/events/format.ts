import { formatEventPriceRange } from "@localloop/domain";
import type { UpcomingEvent } from "@localloop/db";

const categoryLabels: Record<string, string> = {
  "arts-culture": "Arts and Culture",
  "business-networking": "Business and Networking",
  community: "Community",
  education: "Education",
  family: "Family",
  "food-drink": "Food and Drink",
  music: "Music",
  other: "Other",
  outdoors: "Outdoors",
  "sports-fitness": "Sports and Fitness"
};

const eventPreviewDescriptionMaxLength = 160;

export function formatCategory(category: string) {
  return categoryLabels[category] ?? category;
}

export function formatEventDate(startAt: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  }).format(startAt);
}

export function formatEventPrice(
  event: Pick<UpcomingEvent, "priceStatus" | "minPriceCents" | "maxPriceCents" | "currency">
) {
  return formatEventPriceRange(event);
}

export function formatEventPreviewDescription(description: string) {
  return truncateText(description, eventPreviewDescriptionMaxLength);
}

export function formatDistanceMiles(distanceMiles: number) {
  if (distanceMiles >= 10) {
    return `${Math.round(distanceMiles)} mi away`;
  }

  return `${distanceMiles.toFixed(1)} mi away`;
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const endIndex = Math.max(0, maxLength - 1);
  const candidate = normalized.slice(0, endIndex).trimEnd();
  const wordBoundaryIndex = candidate.lastIndexOf(" ");
  const shouldUseWordBoundary = wordBoundaryIndex >= Math.floor(endIndex * 0.7);
  const truncated = shouldUseWordBoundary ? candidate.slice(0, wordBoundaryIndex) : candidate;

  return `${truncated.replace(/[.,;:!?-]+$/, "").trimEnd()}…`;
}
