import { render } from "@testing-library/react";
import { createElement } from "react";
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

  it("gives badges the mono design only in mono builds", async () => {
    const loadBadgeClasses = async (value: string) => {
      vi.stubEnv("VITE_DESIGN_VARIANT", value);
      vi.resetModules();

      const { Badge } = await import("~/components/ui/badge");
      const { container } = render(createElement(Badge, { variant: "success" }, "Done"));

      return container.firstElementChild?.className;
    };

    expect(await loadBadgeClasses("mono")).toContain("uppercase");
    expect(await loadBadgeClasses("default")).not.toContain("uppercase");
  });
});
