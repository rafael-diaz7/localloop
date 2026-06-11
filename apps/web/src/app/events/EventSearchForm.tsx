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

const radiusMin = 1;
const radiusMax = 100;
const defaultRadius = 10;
const defaultDate = "next-7-days";
const defaultPrice = "any";
const defaultSort = "soonest";

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
    if (!filtersExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, [filtersExpanded]);

  useEffect(() => {
    if (!filtersExpanded) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFiltersExpanded(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersExpanded]);

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
          results.length === 0 ? "No US locations found. Try a more specific place." : ""
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
    setFiltersExpanded(false);
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

  function setClampedRadius(value: number) {
    setRadius(clampRadius(value));
  }

  function resetFilters() {
    setRadius(defaultRadius);
    setDate(defaultDate);
    setFrom("");
    setTo("");
    setInclude([]);
    setExclude([]);
    setPrice(defaultPrice);
    setSort(defaultSort);
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

      <section
        id={filterRegionId}
        role={filtersExpanded ? "dialog" : undefined}
        aria-modal={filtersExpanded ? true : undefined}
        className={`md:mt-4 md:block md:border-t md:border-loop-ink/10 md:pt-4 ${
          filtersExpanded
            ? "fixed inset-0 z-50 flex items-end bg-loop-ink/45 p-3 pt-4 md:static md:block md:bg-transparent md:p-0"
            : "hidden"
        }`}
      >
        <div
          className="max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain rounded-t-lg border border-loop-ink/10 bg-loop-surface p-4 shadow-xl md:max-h-none md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
          style={{
            paddingBottom: filtersExpanded ? "max(1rem, env(safe-area-inset-bottom))" : undefined,
            maxHeight: filtersExpanded
              ? "calc(100dvh - max(1rem, env(safe-area-inset-top)) - 1rem)"
              : undefined
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
            <p className="text-sm font-semibold">Filters</p>
            <button
              type="button"
              onClick={() => setFiltersExpanded(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-loop-ink/15 px-4 py-2 text-sm font-semibold text-loop-ink"
            >
              Close
            </button>
          </div>

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
                <span className="text-xs font-semibold leading-5 text-red-700">
                  {locationError}
                </span>
              ) : null}
            </div>

            <RadiusControl radius={radius} onChange={setClampedRadius} />

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
            <CategoryMultiSelect
              label="Include categories"
              categories={categories}
              selected={include}
              onChange={setInclude}
            />
            <CategoryMultiSelect
              label="Exclude categories"
              categories={categories}
              selected={exclude}
              onChange={setExclude}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]">
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
              type="button"
              onClick={resetFilters}
              className="min-h-11 self-end rounded-lg border border-loop-ink/15 px-5 py-2.5 text-sm font-semibold text-loop-ink transition hover:border-loop-moss hover:text-loop-moss"
            >
              Reset
            </button>

            <button
              type="submit"
              className="min-h-11 self-end rounded-lg bg-loop-moss px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-loop-ink dark:hover:bg-loop-leaf"
            >
              Search events
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

function RadiusControl({
  radius,
  onChange
}: {
  radius: number;
  onChange: (radius: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 md:col-span-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Radius</span>
        <span className="text-sm font-semibold text-loop-moss">{radius} miles</span>
      </div>
      <input
        type="range"
        min={radiusMin}
        max={radiusMax}
        step={1}
        value={radius}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full accent-loop-moss"
        aria-label="Radius in miles"
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={radiusMin}
          max={radiusMax}
          step={1}
          value={radius}
          onChange={(event) => onChange(event.target.valueAsNumber)}
          className="min-h-11 w-24 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm"
          aria-label="Radius miles"
        />
        <span className="text-sm text-loop-ink/65">miles</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {eventSearchRadii.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              radius === value
                ? "border-loop-moss bg-loop-moss text-white"
                : "border-loop-ink/15 text-loop-ink hover:border-loop-moss hover:text-loop-moss"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryMultiSelect({
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
  const summaryId = useId();

  function toggleCategory(category: EventCategory, isSelected: boolean) {
    onChange(
      isSelected
        ? selected.filter((selectedCategory) => selectedCategory !== category)
        : [...selected, category]
    );
  }

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">{label}</legend>
      <details className="relative mt-3">
        <summary
          aria-describedby={summaryId}
          className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-loop-ink/15 bg-loop-surface px-3 py-2 text-sm marker:hidden"
        >
          <span>{selected.length === 0 ? "Any category" : `${selected.length} selected`}</span>
          <span
            className="h-2 w-2 rotate-45 border-b border-r border-loop-ink/55"
            aria-hidden="true"
          />
        </summary>
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-lg border border-loop-ink/10 bg-loop-surface p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-loop-ink/10 pb-2">
            <span id={summaryId} className="text-xs font-semibold text-loop-ink/60">
              {selected.length} selected
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="min-h-9 rounded-lg px-2 text-xs font-semibold text-loop-moss hover:bg-loop-mist"
            >
              Clear all
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto pr-1">
            {categories.map((category) => {
              const isSelected = selected.includes(category);

              return (
                <label
                  key={category}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-loop-mist"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCategory(category, isSelected)}
                    className="h-4 w-4 accent-loop-moss"
                  />
                  <span>{formatCategory(category)}</span>
                </label>
              );
            })}
          </div>
        </div>
      </details>
      <div className="mt-3 flex min-h-8 flex-wrap gap-2">
        {selected.map((category) => (
          <span
            key={category}
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-loop-moss/20 bg-loop-mist px-3 py-1 text-xs font-semibold text-loop-ink"
          >
            {formatCategory(category)}
            <button
              type="button"
              onClick={() =>
                onChange(selected.filter((selectedCategory) => selectedCategory !== category))
              }
              className="text-loop-moss hover:text-loop-ink"
              aria-label={`Remove ${formatCategory(category)}`}
            >
              x
            </button>
          </span>
        ))}
      </div>
    </fieldset>
  );
}

function clampRadius(value: number) {
  if (!Number.isFinite(value)) {
    return radiusMin;
  }

  return Math.min(radiusMax, Math.max(radiusMin, Math.round(value)));
}
