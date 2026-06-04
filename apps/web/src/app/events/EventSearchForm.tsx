"use client";

import {
  dmvSearchLocations,
  eventDatePresets,
  eventSearchPrices,
  eventSearchRadii,
  eventSearchSorts,
  serializeEventSearchParams,
  type EventCategory,
  type EventSearchParams
} from "@localloop/domain";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { formatCategory } from "./format";

type EventSearchFormProps = {
  initialFilters: Omit<EventSearchParams, "dateRange">;
  categories: EventCategory[];
};

const dateLabels = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
  "next-7-days": "Next 7 days",
  custom: "Custom date range"
};

const priceLabels = {
  any: "Any price",
  free: "Free",
  paid: "Paid",
  unknown: "Price unknown"
};

const sortLabels = {
  soonest: "Soonest",
  closest: "Closest"
};

export function EventSearchForm({ initialFilters, categories }: EventSearchFormProps) {
  const router = useRouter();
  const [near, setNear] = useState(initialFilters.near);
  const [radius, setRadius] = useState(initialFilters.radius);
  const [date, setDate] = useState(initialFilters.date);
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");
  const [include, setInclude] = useState<EventCategory[]>(initialFilters.include);
  const [exclude, setExclude] = useState<EventCategory[]>(initialFilters.exclude);
  const [price, setPrice] = useState(initialFilters.price);
  const [sort, setSort] = useState(initialFilters.sort);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = serializeEventSearchParams({
      near,
      radius,
      date,
      from: date === "custom" ? from : undefined,
      to: date === "custom" ? to : undefined,
      include,
      exclude,
      price,
      sort
    });

    router.push(`/events?${query}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-10 rounded-lg border border-loop-ink/10 bg-white p-5 shadow-sm md:p-6"
    >
      <div className="grid gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-semibold">Location</span>
          <select
            value={near}
            onChange={(event) => setNear(event.target.value as typeof near)}
            className="rounded-lg border border-loop-ink/15 bg-white px-3 py-2 text-sm"
          >
            {dmvSearchLocations.map((location) => (
              <option key={location.slug} value={location.slug}>
                {location.displayName}
              </option>
            ))}
          </select>
          <span className="text-xs leading-5 text-loop-ink/60">
            Location search currently uses preset DMV areas. Address search is coming later.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Radius</span>
          <select
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value) as typeof radius)}
            className="rounded-lg border border-loop-ink/15 bg-white px-3 py-2 text-sm"
          >
            {eventSearchRadii.map((value) => (
              <option key={value} value={value}>
                {value} miles
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Date</span>
          <select
            value={date}
            onChange={(event) => setDate(event.target.value as typeof date)}
            className="rounded-lg border border-loop-ink/15 bg-white px-3 py-2 text-sm"
          >
            {eventDatePresets.map((value) => (
              <option key={value} value={value}>
                {dateLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {date === "custom" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-lg border border-loop-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-lg border border-loop-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <CategoryCheckboxes
          label="Include categories"
          categories={categories}
          selected={include}
          onChange={setInclude}
        />
        <CategoryCheckboxes
          label="Exclude categories"
          categories={categories}
          selected={exclude}
          onChange={setExclude}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Price</span>
          <select
            value={price}
            onChange={(event) => setPrice(event.target.value as typeof price)}
            className="rounded-lg border border-loop-ink/15 bg-white px-3 py-2 text-sm"
          >
            {eventSearchPrices.map((value) => (
              <option key={value} value={value}>
                {priceLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="rounded-lg border border-loop-ink/15 bg-white px-3 py-2 text-sm"
          >
            {eventSearchSorts.map((value) => (
              <option key={value} value={value}>
                {sortLabels[value]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="self-end rounded-lg bg-loop-moss px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-loop-ink"
        >
          Search events
        </button>
      </div>
    </form>
  );
}

function CategoryCheckboxes({
  label,
  categories,
  selected,
  onChange
}: {
  label: string;
  categories: EventCategory[];
  selected: EventCategory[];
  onChange: (categories: EventCategory[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {categories.map((category) => (
          <label
            key={category}
            className="flex items-center gap-2 rounded-lg border border-loop-ink/10 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(category)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, category]
                    : selected.filter((selectedCategory) => selectedCategory !== category)
                )
              }
              className="h-4 w-4 accent-loop-moss"
            />
            <span>{formatCategory(category)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
