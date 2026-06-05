import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns a lightweight service health response", async () => {
    const response = GET();

    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "localloop-web"
    });
  });
});
