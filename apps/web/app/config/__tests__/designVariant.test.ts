import { afterEach, describe, expect, it, vi } from "vitest";

const loadDesignVariant = async (value: string) => {
  vi.stubEnv("VITE_DESIGN_VARIANT", value);
  vi.resetModules();

  return (await import("../designVariant")).DESIGN_VARIANT;
};

describe("DESIGN_VARIANT", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the design variant configured for the build", async () => {
    expect(await loadDesignVariant("mono")).toBe("mono");
  });

  it("falls back to the default design variant for missing or unknown values", async () => {
    expect(await loadDesignVariant("")).toBe("default");
    expect(await loadDesignVariant("unknown")).toBe("default");
  });
});
