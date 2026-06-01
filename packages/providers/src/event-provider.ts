import type { EventSearchFilters, LocalLoopEvent } from "@localloop/domain";

export type ProviderEvent = Omit<LocalLoopEvent, "id" | "source"> & {
  externalId: string;
  provider: string;
};

export interface EventProvider {
  readonly id: string;
  readonly displayName: string;
  searchEvents(filters: EventSearchFilters): Promise<ProviderEvent[]>;
}
