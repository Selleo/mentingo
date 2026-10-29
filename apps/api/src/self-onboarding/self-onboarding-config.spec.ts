import { createGuideClient } from "@mentingo/guide-sdk";

import { readHelpdeskConfig } from "src/common/configuration/self-onboarding";

import { createHelpdeskSdkClient } from "./self-onboarding-client.provider";

jest.mock("@mentingo/guide-sdk", () => ({
  ...jest.requireActual("@mentingo/guide-sdk"),
  createGuideClient: jest.fn(),
}));

describe("Helpdesk read-only configuration", () => {
  it("defaults to the public HTTPS service with explicit opt-out", () => {
    expect(readHelpdeskConfig({})).toEqual({ enabled: true, baseURL: "https://help.mentingo.com" });
    expect(readHelpdeskConfig({ HELPDESK_ENABLED: "false" }).enabled).toBe(false);
    expect(
      readHelpdeskConfig({
        HELPDESK_API_URL: "http://127.0.0.1:5300",
        HELPDESK_APP_VERSION: "v4.20.1",
      }),
    ).toEqual({
      enabled: true,
      baseURL: "http://127.0.0.1:5300",
      appVersion: "v4.20.1",
    });
  });

  it.each([
    "https://user:secret@help.mentingo.com",
    "https://help.mentingo.com/private",
    "https://help.mentingo.com?key=secret",
    "https://help.mentingo.com#secret",
    "http://example.com",
    "not-an-origin",
  ])("rejects unsafe origins without echoing their values", (value) => {
    expect(() => readHelpdeskConfig({ HELPDESK_API_URL: value })).toThrow(
      /^HELPDESK_API_URL must be/,
    );
    try {
      readHelpdeskConfig({ HELPDESK_API_URL: value });
    } catch (error) {
      expect(String(error)).not.toContain(value);
    }
  });

  it("rejects ambiguous booleans", () => {
    expect(() => readHelpdeskConfig({ HELPDESK_ENABLED: "yes" })).toThrow(
      "HELPDESK_ENABLED must be true or false",
    );
  });

  it("constructs only public SDK facades with bounded timeout and no credentials or startup calls", () => {
    const search = { query: jest.fn() };
    const tutorials = { get: jest.fn(), domains: jest.fn() };
    jest.mocked(createGuideClient).mockReturnValue({
      search,
      tutorials,
      publishing: { private: true },
    } as unknown as ReturnType<typeof createGuideClient>);
    expect(
      createHelpdeskSdkClient(
        readHelpdeskConfig({
          GUIDE_PUBLISH_API_KEY: "private-key",
          HELPDESK_API_KEY: "another-private-key",
        }),
      ),
    ).toEqual({ search, tutorials });
    expect(createGuideClient).toHaveBeenCalledWith({
      baseURL: "https://help.mentingo.com",
      timeoutMs: 5_000,
    });
    expect(search.query).not.toHaveBeenCalled();
    expect(tutorials.get).not.toHaveBeenCalled();
    expect(tutorials.domains).not.toHaveBeenCalled();
  });

  it("creates no SDK at all when disabled", () => {
    jest.mocked(createGuideClient).mockClear();
    expect(createHelpdeskSdkClient(readHelpdeskConfig({ HELPDESK_ENABLED: "false" }))).toBeNull();
    expect(createGuideClient).not.toHaveBeenCalled();
  });
});
