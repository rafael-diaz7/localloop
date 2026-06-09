"use client";

import {
  eventDatePresets,
  eventSearchPrices,
  eventSearchRadii,
  eventSearchSorts,
  serializeEventSearchParams,
  type EventCategory,
  type EventSearchParams,
  type LocationCandidate,
  type SearchLocation
} from "@localloop/domain";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";

import { formatCategory } from "./format";

type EventSearchFormProps = {
  initialFilters: Omit<EventSearchParams, "dateRange">;
  categories: EventCategory[];
  activeSummary: string;
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

type GeocodeResponse = {
  error?: string;
  results?: LocationCandidate[];
};

export function EventSearchForm({
  initialFilters,
  categories,
  activeSummary
}: EventSearchFormProps) {
  const router = useRouter();
  const filterRegionId = useId();
  const [locationInput, setLocationInput] = useState(initialFilters.location.displayName);
  const [selectedLocation, setSelectedLocation] = useState<SearchLocation | null>(
    initialFilters.location
  );
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<LocationCandidate[]>([]);
  const [isFindingLocations, setIsFindingLocations] = useState(false);
  const [radius, setRadius] = useState(initialFilters.radius);
  const [date, setDate] = useState(initialFilters.date);
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");
  const [include, setInclude] = useState<EventCategory[]>(initialFilters.include);
  const [exclude, setExclude] = useState<EventCategory[]>(initialFilters.exclude);
  const [price, setPrice] = useState(initialFilters.price);
  const [sort, setSort] = useState(initialFilters.sort);

  useEffect(() => {
    const trimmedLocation = locationInput.trim();

    if (selectedLocation && trimmedLocation === selectedLocation.displayName) {
      setLocationSuggestions([]);
      setLocationNotice("");
      setIsFindingLocations(false);
      return;
    }

    if (trimmedLocation.length < 2) {
      setLocationSuggestions([]);
      setLocationNotice("");
      setIsFindingLocations(false);
      return;
    }

    let isCurrent = true;
    const timeout = setTimeout(async () => {
      setIsFindingLocations(true);

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedLocation)}`);
        const body = (await response.json()) as GeocodeResponse;

        if (!isCurrent) {
          return;
        }

        if (!response.ok) {
          setLocationSuggestions([]);
          setLocationNotice(body.error ?? "Location search is unavailable right now.");
          return;
        }

        const results = body.results ?? [];
        setLocationSuggestions(results);
        setLocationNotice(
          results.length === 0 ? "No matching locations found. Try a more specific place." : ""
        );
      } catch {
        if (isCurrent) {
          setLocationSuggestions([]);
          setLocationNotice("Location search is unavailable right now.");
        }
      } finally {
        if (isCurrent) {
          setIsFindingLocations(false);
        }
      }
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [locationInput, selectedLocation]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLocation) {
      setLocationError("Choose a location from the suggestions before searching.");
      return;
    }

    const query = serializeEventSearchParams({
      location: selectedLocation,
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

  function updateLocationInput(value: string) {
    setLocationInput(value);
    setLocationError("");

    if (selectedLocation && value !== selectedLocation.displayName) {
      setSelectedLocation(null);
    }
  }

  function selectLocation(candidate: LocationCandidate) {
    const nextLocation = {
      displayName: candidate.displayName,
      latitude: candidate.latitude,
      longitude: candidate.longitude
    };

    setSelectedLocation(nextLocation);
    setLocationInput(nextLocation.displayName);
    setLocationError("");
    setLocationNotice("");
    setLocationSuggestions([]);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sticky z-20 mt-8 rounded-lg border border-loop-ink/10 bg-loop-surface/95 p-3 shadow-sm backdrop-blur md:mt-10 md:p-5"
      style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-loop-moss">
            Active search
          </p>
          <p className="mt-1 text-sm leading-6 text-loop-ink/75">{activeSummary}</p>
        </div>
        <button
          type="button"
          aria-controls={filterRegionId}
          aria-expanded={filtersExpanded}
          onClick={() => setFiltersExpanded((isExpanded) => !isExpanded)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-loop-ink/15 px-4 py-2 text-sm font-semibold text-loop-ink transition hover:border-loop-moss hover:text-loop-moss md:hidden"
        >
          {filtersExpanded ? "Hide filters" : "Edit search"}
        </button>
      </div>

      <div
        id={filterRegionId}
        className={`mt-4 border-t border-loop-ink/10 pt-4 md:block ${
          filtersExpanded ? "block max-h-[calc(100dvh-7rem)] overflow-y-auto pr-1" : "hidden"
        } md:max-h-none md:overflow-visible md:pr-0`}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative flex flex-col gap-2 md:col-span-2">
            <label htmlFor="event-location" className="text-sm font-semibold">
              Location
            </label>
            <input
              id="event-location"
              type="text"
              value={locationInput}
              onChange={(event) => updateLocationInput(event.target.value)}
              placeholder="Address, neighborhood, city, or ZIP code"
              autoComplete="off"
              className="min-h-11 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm"
            />
            {locationSuggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-[4.75rem] z-30 overflow-hidden rounded-lg border border-loop-ink/10 bg-loop-surface shadow-lg">
                {locationSuggestions.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => selectLocation(candidate)}
                    className="block min-h-11 w-full px-3 py-2 text-left text-sm leading-5 hover:bg-loop-mist"
                  >
                    {candidate.displayName}
                  </button>
                ))}
              </div>
            ) : null}
            <span className="min-h-5 text-xs leading-5 text-loop-ink/60">
              {selectedLocation
                ? `Using ${selectedLocation.displayName}`
                : isFindingLocations
                  ? "Finding locations..."
                  : locationNotice || "Choose a suggestion to set coordinates for search."}
            </span>
            {locationError ? (
              <span className="text-xs font-semibold leading-5 text-red-700">{locationError}</span>
            ) : null}
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Radius</span>
            <select
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value) as typeof radius)}
              className="min-h-11 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm"
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
              className="min-h-11 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm"
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
                className="min-h-11 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">To</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="min-h-11 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 md:grid-cols-2">
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

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Price</span>
            <select
              value={price}
              onChange={(event) => setPrice(event.target.value as typeof price)}
              className="min-h-11 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm"
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
              className="min-h-11 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm"
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
            className="min-h-11 self-end rounded-lg bg-loop-moss px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-loop-ink dark:hover:bg-loop-leaf"
          >
            Search events
          </button>
        </div>
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
            className="flex min-h-11 items-center gap-2 rounded-lg border border-loop-ink/10 px-3 py-2 text-sm"
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
