import { lookup } from "node:dns/promises";

import { ServiceUnavailableException } from "@nestjs/common";

import { isAllowedPluginOrigin, toPluginOrigin } from "./integration-plugin-origin.utils";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));

describe("Plugin origin DNS deadline", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(lookup).mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it.each([toPluginOrigin, isAllowedPluginOrigin])(
    "bounds DNS validation for %p",
    async (validate) => {
      jest.mocked(lookup).mockImplementation(() => new Promise(() => {}));
      let failure: unknown;
      let settled = false;
      const pending = validate("https://plugins.example.test").then(
        () => {
          settled = true;
        },
        (error) => {
          settled = true;
          failure = error;
        },
      );
      await jest.advanceTimersByTimeAsync(5_000);
      expect(settled).toBe(true);
      await pending;
      expect(failure).toBeInstanceOf(ServiceUnavailableException);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it("clears the deadline after a successful lookup", async () => {
    jest.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    await expect(isAllowedPluginOrigin("https://plugins.example.test")).resolves.toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
