import { z } from "zod";

export type SearchLocation = {
  displayName: string;
  latitude: number;
  longitude: number;
};

export const dmvSearchLocations = [
  {
    slug: "courthouse-arlington-va",
    displayName: "Courthouse, Arlington, VA",
    latitude: 38.8904,
    longitude: -77.0869
  },
  {
    slug: "clarendon-arlington-va",
    displayName: "Clarendon, Arlington, VA",
    latitude: 38.887,
    longitude: -77.0953
  },
  {
    slug: "dupont-circle-dc",
    displayName: "Dupont Circle, Washington, DC",
    latitude: 38.9097,
    longitude: -77.0434
  },
  {
    slug: "old-town-alexandria-va",
    displayName: "Old Town Alexandria, VA",
    latitude: 38.8048,
    longitude: -77.047
  },
  {
    slug: "bethesda-md",
    displayName: "Downtown Bethesda, MD",
    latitude: 38.9847,
    longitude: -77.0947
  },
  {
    slug: "silver-spring-md",
    displayName: "Silver Spring, MD",
    latitude: 38.9907,
    longitude: -77.0261
  }
] as const;

export const defaultDmvSearchLocationSlug = "courthouse-arlington-va";
export const defaultSearchLocation: SearchLocation = {
  displayName: "Courthouse, Arlington, VA",
  latitude: 38.8904,
  longitude: -77.0869
};

export const dmvSearchLocationSlugSchema = z.enum(
  dmvSearchLocations.map((location) => location.slug) as [
    (typeof dmvSearchLocations)[number]["slug"],
    ...(typeof dmvSearchLocations)[number]["slug"][]
  ]
);

export type DmvSearchLocationSlug = z.infer<typeof dmvSearchLocationSlugSchema>;
export type DmvSearchLocation = (typeof dmvSearchLocations)[number];

export function getDmvSearchLocation(slug: DmvSearchLocationSlug) {
  return dmvSearchLocations.find((location) => location.slug === slug) ?? dmvSearchLocations[0];
}
