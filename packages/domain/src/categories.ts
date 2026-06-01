import { z } from "zod";

export const eventCategories = [
  "music",
  "arts-culture",
  "food-drink",
  "sports-fitness",
  "family",
  "community",
  "education",
  "outdoors",
  "business-networking",
  "other"
] as const;

export const eventCategorySchema = z.enum(eventCategories);

export type EventCategory = z.infer<typeof eventCategorySchema>;
