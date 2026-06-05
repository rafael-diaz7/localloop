import { pathToFileURL } from "node:url";

import {
  normalizeSmithsonianProbeEvents,
  SMITHSONIAN_EVENTS_FEED_URL,
  summarizeSmithsonianProbeEvents
} from "./index";

type ProbeOutput = {
  sourceUrl: string;
  events: ReturnType<typeof normalizeSmithsonianProbeEvents>;
  summary: ReturnType<typeof summarizeSmithsonianProbeEvents>;
};

export async function runSmithsonianProbe() {
  const response = await fetch(SMITHSONIAN_EVENTS_FEED_URL);

  if (!response.ok) {
    throw new Error(
      `Smithsonian probe request failed with ${response.status} ${response.statusText}`
    );
  }

  const events = normalizeSmithsonianProbeEvents(await response.text(), 100);
  const output: ProbeOutput = {
    sourceUrl: SMITHSONIAN_EVENTS_FEED_URL,
    events,
    summary: summarizeSmithsonianProbeEvents(events)
  };

  console.log(JSON.stringify(output, null, 2));

  return output;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runSmithsonianProbe();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}
