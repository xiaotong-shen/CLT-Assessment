import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("true is true", () => {
    expect(true).toBe(true);
  });

  it("message files exist", async () => {
    const en = await import("../../../messages/en.json");
    const zh = await import("../../../messages/zh-Hans.json");
    expect(en.intake.submit).toBeTruthy();
    expect(zh.intake.submit).toBeTruthy();
  });
});
