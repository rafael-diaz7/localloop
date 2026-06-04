import { z } from "zod";

import { eventCategories, eventCategorySchema, type EventCategory } from "./categories";
import {
  defaultDmvSearchLocationSlug,
  dmvSearchLocationSlugSchema,
  type DmvSearchLocationSlug
} from "./locations";

export const dmvTimeZone = "America/New_York";
export const eventSearchRadii = [1, 3, 5, 10, 25] as const;
export const eventDatePresets = ["today", "tomorrow", "weekend", "next-7-days", "custom"] as const;
export const eventSearchPrices = ["any", "free", "paid", "unknown"] as const;
export const eventSearchSorts = ["soonest", "closest"] as const;

export const eventSearchRadiusSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(5),
  z.literal(10),
  z.literal(25)
]);
export const eventDatePresetSchema = z.enum(eventDatePresets);
export const eventSearchPriceSchema = z.enum(eventSearchPrices);
export const eventSearchSortSchema = z.enum(eventSearchSorts);
export const eventSearchCategorySlugSchema = eventCategorySchema;

export type EventSearchRadius = z.infer<typeof eventSearchRadiusSchema>;
export type EventDatePreset = z.infer<typeof eventDatePresetSchema>;
export type EventSearchPrice = z.infer<typeof eventSearchPriceSchema>;
export type EventSearchSort = z.infer<typeof eventSearchSortSchema>;

export type EventDateRange = {
  start: Date;
  end: Date;
};

export type EventSearchParams = {
  near: DmvSearchLocationSlug;
  radius: EventSearchRadius;
  date: EventDatePreset;
  from?: string;
  to?: string;
  include: EventCategory[];
  exclude: EventCategory[];
  price: EventSearchPrice;
  sort: EventSearchSort;
  dateRange: EventDateRange;
};

export type ParsedEventSearchParams = {
  filters: EventSearchParams;
  ignoredParams: string[];
};

type SearchParamInput = URLSearchParams | Record<string, string | string[] | undefined>;

const defaultDatePreset = "next-7-days" satisfies EventDatePreset;
const defaultRadius = 10 satisfies EventSearchRadius;
const defaultPrice = "any" satisfies EventSearchPrice;
const defaultSort = "soonest" satisfies EventSearchSort;
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseEventSearchParams(
  input: SearchParamInput | undefined,
  now = new Date()
): ParsedEventSearchParams {
  const reader = createSearchParamReader(input);
  const ignoredParams: string[] = [];
  const near = parseWithFallback(
    "near",
    reader.first("near"),
    dmvSearchLocationSlugSchema,
    defaultDmvSearchLocationSlug,
    ignoredParams
  );
  const radius = parseRadius(reader.first("radius"), ignoredParams);
  const date = parseWithFallback(
    "date",
    reader.first("date"),
    eventDatePresetSchema,
    defaultDatePreset,
    ignoredParams
  );
  const include = parseCategoryList("include", reader.all("include"), ignoredParams);
  const exclude = parseCategoryList("exclude", reader.all("exclude"), ignoredParams);
  const price = parseWithFallback(
    "price",
    reader.first("price"),
    eventSearchPriceSchema,
    defaultPrice,
    ignoredParams
  );
  const sort = parseWithFallback(
    "sort",
    reader.first("sort"),
    eventSearchSortSchema,
    defaultSort,
    ignoredParams
  );
  const customRange = parseCustomDateRange(reader.first("from"), reader.first("to"), ignoredParams);
  const resolvedDate =
    date === "custom" && customRange ? "custom" : date === "custom" ? defaultDatePreset : date;

  if (date === "custom" && !customRange) {
    ignoredParams.push("date");
  }

  return {
    filters: {
      near,
      radius,
      date: resolvedDate,
      from: resolvedDate === "custom" ? customRange?.from : undefined,
      to: resolvedDate === "custom" ? customRange?.to : undefined,
      include,
      exclude,
      price,
      sort,
      dateRange:
        resolvedDate === "custom" && customRange
          ? customRange.range
          : resolveDatePresetRange(resolvedDate, now)
    },
    ignoredParams: [...new Set(ignoredParams)]
  };
}

export function serializeEventSearchParams(filters: Omit<EventSearchParams, "dateRange">) {
  const params = new URLSearchParams();

  params.set("near", filters.near);
  params.set("radius", String(filters.radius));
  params.set("date", filters.date);

  if (filters.date === "custom" && filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }

  if (filters.include.length > 0) {
    params.set("include", filters.include.join(","));
  }

  if (filters.exclude.length > 0) {
    params.set("exclude", filters.exclude.join(","));
  }

  params.set("price", filters.price);
  params.set("sort", filters.sort);

  return params.toString();
}

export function resolveDatePresetRange(
  preset: Exclude<EventDatePreset, "custom">,
  now = new Date()
) {
  const today = zonedDateFromInstant(now);

  if (preset === "today") {
    return localDateRange(today, today);
  }

  if (preset === "tomorrow") {
    const tomorrow = addLocalDays(today, 1);
    return localDateRange(tomorrow, tomorrow);
  }

  if (preset === "weekend") {
    const daysUntilSaturday = (6 - today.weekday + 7) % 7;
    const saturday = addLocalDays(today, daysUntilSaturday);
    const sunday = addLocalDays(saturday, 1);
    return localDateRange(saturday, sunday);
  }

  return {
    start: localDateTimeToUtc(today.year, today.month, today.day, 0, 0, 0),
    end: localDateTimeToUtc(
      addLocalDays(today, 7).year,
      addLocalDays(today, 7).month,
      addLocalDays(today, 7).day,
      0,
      0,
      0
    )
  };
}

export function resolveCustomDateRange(from: string, to: string): EventDateRange | null {
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);

  if (!fromDate || !toDate || compareLocalDates(toDate, fromDate) < 0) {
    return null;
  }

  return localDateRange(fromDate, toDate);
}

export function eventCategorySetMatchesFilters(
  categories: EventCategory[],
  include: EventCategory[],
  exclude: EventCategory[]
) {
  if (categories.some((category) => exclude.includes(category))) {
    return false;
  }

  if (include.length === 0) {
    return true;
  }

  return categories.some((category) => include.includes(category));
}

function parseRadius(rawValue: string | undefined, ignoredParams: string[]) {
  const parsedNumber = rawValue ? Number(rawValue) : defaultRadius;
  const parsed = eventSearchRadiusSchema.safeParse(parsedNumber);

  if (parsed.success) {
    return parsed.data;
  }

  if (rawValue !== undefined) {
    ignoredParams.push("radius");
  }

  return defaultRadius;
}

function parseWithFallback<T extends z.ZodTypeAny>(
  name: string,
  rawValue: string | undefined,
  schema: T,
  fallback: z.infer<T>,
  ignoredParams: string[]
) {
  const parsed = schema.safeParse(rawValue ?? fallback);

  if (parsed.success) {
    return parsed.data;
  }

  if (rawValue !== undefined) {
    ignoredParams.push(name);
  }

  return fallback;
}

function parseCategoryList(name: string, rawValues: string[], ignoredParams: string[]) {
  const categories: EventCategory[] = [];
  const seen = new Set<EventCategory>();

  for (const rawValue of rawValues) {
    for (const value of rawValue.split(",")) {
      const candidate = value.trim();

      if (!candidate) {
        continue;
      }

      const parsed = eventSearchCategorySlugSchema.safeParse(candidate);

      if (!parsed.success) {
        ignoredParams.push(name);
        continue;
      }

      if (!seen.has(parsed.data)) {
        seen.add(parsed.data);
        categories.push(parsed.data);
      }
    }
  }

  return categories;
}

function parseCustomDateRange(
  from: string | undefined,
  to: string | undefined,
  ignoredParams: string[]
) {
  if (!from && !to) {
    return null;
  }

  if (!from || !to) {
    ignoredParams.push("from", "to");
    return null;
  }

  const range = resolveCustomDateRange(from, to);

  if (!range) {
    ignoredParams.push("from", "to");
    return null;
  }

  return { from, to, range };
}

function createSearchParamReader(input: SearchParamInput | undefined) {
  if (input instanceof URLSearchParams) {
    return {
      first: (key: string) => input.get(key) ?? undefined,
      all: (key: string) => input.getAll(key)
    };
  }

  return {
    first: (key: string) => {
      const value = input?.[key];
      return Array.isArray(value) ? value[0] : value;
    },
    all: (key: string) => {
      const value = input?.[key];

      if (Array.isArray(value)) {
        return value;
      }

      return value === undefined ? [] : [value];
    }
  };
}

type LocalDate = {
  year: number;
  month: number;
  day: number;
  weekday: number;
};

function zonedDateFromInstant(date: Date): LocalDate {
  const parts = getZonedDateParts(date);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    weekday: parts.weekday
  };
}

function localDateRange(from: Omit<LocalDate, "weekday">, to: Omit<LocalDate, "weekday">) {
  const exclusiveEnd = addLocalDays(to, 1);

  return {
    start: localDateTimeToUtc(from.year, from.month, from.day, 0, 0, 0),
    end: localDateTimeToUtc(exclusiveEnd.year, exclusiveEnd.month, exclusiveEnd.day, 0, 0, 0)
  };
}

function parseDateOnly(value: string): LocalDate | null {
  if (!dateOnlyPattern.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const roundTrip = new Date(Date.UTC(year, month - 1, day));

  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() + 1 !== month ||
    roundTrip.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, weekday: roundTrip.getUTCDay() };
}

function addLocalDays(date: Omit<LocalDate, "weekday">, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    weekday: next.getUTCDay()
  };
}

function compareLocalDates(left: Omit<LocalDate, "weekday">, right: Omit<LocalDate, "weekday">) {
  return (
    Date.UTC(left.year, left.month - 1, left.day) - Date.UTC(right.year, right.month - 1, right.day)
  );
}

function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = new Date(target);

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = getZonedDateParts(instant);
    const current = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    instant = new Date(instant.getTime() - (current - target));
  }

  return instant;
}

function getZonedDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: dmvTimeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short"
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayNumber(parts.weekday ?? "Sun")
  };
}

function weekdayNumber(weekday: string) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

export function allEventSearchCategories() {
  return [...eventCategories];
}
