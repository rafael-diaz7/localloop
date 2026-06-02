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
  if (event.priceStatus === "free") {
    return "Free";
  }

  if (event.priceStatus === "unknown") {
    return "Price unknown";
  }

  if (event.minPriceCents === null && event.maxPriceCents === null) {
    return "Paid";
  }

  const min = event.minPriceCents ?? event.maxPriceCents;
  const max = event.maxPriceCents ?? event.minPriceCents;

  if (min === null || max === null) {
    return "Paid";
  }

  if (min === max) {
    return formatMoney(min, event.currency);
  }

  return `${formatMoney(min, event.currency)}-${formatMoney(max, event.currency)}`;
}

function formatMoney(cents: number, currency: string | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2
  }).format(cents / 100);
}
