import { describe, expect, it } from "vitest";

import { getWorkerStatus } from ".";

describe("worker placeholder", () => {
  it("reports an idle status", () => {
    expect(getWorkerStatus()).toEqual({
      name: "localloop-worker",
      status: "idle"
    });
  });
});
