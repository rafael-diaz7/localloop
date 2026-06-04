import type {
  EventCategory,
  EventPriceStatus,
  EventSearchFilters,
  EventStatus,
  LocalLoopEvent
} from "@localloop/domain";

export type ProviderEvent = Omit<LocalLoopEvent, "id" | "source"> & {
  externalId: string;
  provider: string;
};

export type ProviderSourceIdentity = {
  key: string;
  displayName: string;
  platform: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedVenue = {
  externalId?: string;
  name: string;
  displayAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

export type NormalizedEvent = {
  externalId: string;
  title: string;
  description?: string;
  sourceUrl: string;
  startAt: Date;
  endAt?: Date;
  timezone: string;
  venue: NormalizedVenue;
  categories: EventCategory[];
  priceStatus: EventPriceStatus;
  minPriceCents?: number;
  maxPriceCents?: number;
  currency?: string;
  status: EventStatus;
  providerMetadata?: Record<string, unknown>;
  rawPayload?: {
    payload: Record<string, unknown>;
    fetchedAt: Date;
  };
};

export type NormalizedEventSkipReason = {
  key: string;
  label: string;
  count: number;
};

export type NormalizedEventBatch = {
  source: ProviderSourceIdentity;
  events: NormalizedEvent[];
  fetchedCount: number;
  skippedCount: number;
  skippedReasons?: NormalizedEventSkipReason[];
  metadata?: Record<string, unknown>;
};

export interface EventProvider {
  readonly id: string;
  readonly displayName: string;
  searchEvents(filters: EventSearchFilters): Promise<ProviderEvent[]>;
}
