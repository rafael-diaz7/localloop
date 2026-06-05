import { z } from "zod";

import { eventCategorySchema } from "./categories";

export const eventPriceStatuses = ["free", "paid", "unknown"] as const;
export const eventPriceStatusSchema = z.enum(eventPriceStatuses);
export type EventPriceStatus = z.infer<typeof eventPriceStatusSchema>;

export const eventStatuses = ["active", "cancelled", "expired"] as const;
export const eventStatusSchema = z.enum(eventStatuses);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const eventSearchFiltersSchema = z
  .object({
    location: z.string().trim().min(1).optional(),
    radiusMiles: z.number().int().positive().max(100).default(10),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    categories: z.array(eventCategorySchema).default([]),
    maxPriceCents: z.number().int().nonnegative().optional(),
    freeOnly: z.boolean().default(false)
  })
  .refine(
    (filters) => !filters.startDate || !filters.endDate || filters.startDate <= filters.endDate,
    {
      message: "endDate must be on or after startDate",
      path: ["endDate"]
    }
  );

export type EventSearchFilters = z.infer<typeof eventSearchFiltersSchema>;

export const localLoopEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  venueName: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  category: eventCategorySchema,
  priceStatus: eventPriceStatusSchema.default("unknown"),
  priceCents: z.number().int().nonnegative().optional(),
  priceLabel: z.string().trim().optional(),
  source: z.string().trim().min(1),
  sourceUrl: z.string().url().optional(),
  status: eventStatusSchema.default("active")
});

export type LocalLoopEvent = z.infer<typeof localLoopEventSchema>;
