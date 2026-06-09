import { GeocodingError, NominatimGeocoder } from "@localloop/domain";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Enter at least two characters to search for a location.", results: [] },
      { status: 400 }
    );
  }

  try {
    const geocoder = new NominatimGeocoder({
      userAgent:
        process.env.NOMINATIM_USER_AGENT ??
        process.env.GEOCODER_USER_AGENT ??
        "LocalLoop/0.1.0 (configure NOMINATIM_USER_AGENT)",
      endpoint: process.env.NOMINATIM_ENDPOINT,
      timeoutMs: parseTimeout(process.env.NOMINATIM_TIMEOUT_MS)
    });

    const results = await geocoder.search(query);
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof GeocodingError) {
      const status = error.code === "timeout" ? 504 : 503;
      const message =
        error.code === "timeout"
          ? "Location search timed out. Try again in a moment."
          : "Location search is unavailable right now.";

      return NextResponse.json({ error: message, results: [] }, { status });
    }

    return NextResponse.json(
      { error: "Location search is unavailable right now.", results: [] },
      { status: 503 }
    );
  }
}

function parseTimeout(value: string | undefined) {
  const timeoutMs = value ? Number(value) : 5000;
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
}
