import type { EventPriceStatus } from "./event";

export type EventPriceRangeInput = {
  priceStatus?: EventPriceStatus | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  currency?: string | null;
};

export function formatEventPriceRange(event: EventPriceRangeInput) {
  if (event.priceStatus === "free") {
    return "Free";
  }

  const min = normalizeCents(event.minPriceCents);
  const max = normalizeCents(event.maxPriceCents);

  if (min !== null && max !== null) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);

    if (low === high) {
      return formatMoney(low, event.currency);
    }

    return `${formatMoney(low, event.currency)}–${formatMoney(high, event.currency)}`;
  }

  if (min !== null) {
    return `From ${formatMoney(min, event.currency)}`;
  }

  if (max !== null) {
    return `Up to ${formatMoney(max, event.currency)}`;
  }

  if (event.priceStatus === "unknown" || !event.priceStatus) {
    return "Price unknown";
  }

  return "Paid";
}

function normalizeCents(cents: number | null | undefined) {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents < 0) {
    return null;
  }

  return Math.round(cents);
}

function formatMoney(cents: number, currency: string | null | undefined) {
  const currencyCode = normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2
    }).format(cents / 100);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2
    }).format(cents / 100);
  }
}

function normalizeCurrency(currency: string | null | undefined) {
  const trimmed = currency?.trim();

  return trimmed ? trimmed.toUpperCase() : "USD";
}
