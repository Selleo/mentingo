import { SearchQueryMode } from "@mentingo/guide-sdk";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { FEATURES, FEATURE_SETTINGS_KEYS, SUPPORTED_LANGUAGES } from "@repo/shared";

import { resolveHelpdeskAppVersion } from "./helpdesk-context";
import { HelpdeskService } from "./helpdesk.service";

import type { HelpdeskClientService } from "./helpdesk-client.service";
import type { HelpdeskConfig } from "src/common/configuration/helpdesk";
import type { SettingsService } from "src/settings/settings.service";

jest.mock("src/settings/settings.service", () => ({ SettingsService: class SettingsService {} }));

describe("HelpdeskService compatibility and privacy", () => {
  const client = {
    search: jest.fn().mockResolvedValue({ mode: "browse", results: [] }),
    getTutorial: jest.fn().mockResolvedValue({ key: "edit-course" }),
    getDomains: jest.fn().mockResolvedValue([]),
  };
  const settings = { getGlobalSettings: jest.fn() };

  function service(config: Partial<HelpdeskConfig> = {}) {
    return new HelpdeskService(
      client as unknown as HelpdeskClientService,
      settings as unknown as SettingsService,
      { enabled: true, baseURL: "https://help.mentingo.com", appVersion: "v4.20.1", ...config },
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    settings.getGlobalSettings.mockResolvedValue({
      [FEATURE_SETTINGS_KEYS[FEATURES.NEWS]]: true,
      [FEATURE_SETTINGS_KEYS[FEATURES.QA]]: false,
      [FEATURE_SETTINGS_KEYS[FEATURES.ARTICLES]]: "true",
      platformName: "Private tenant name",
      platformLogoS3Key: "https://tenant.invalid/private-signed-url",
      userEmailTriggers: { secret: "private value" },
    });
  });

  it("derives version and only enabled public feature keys, never tenant settings", async () => {
    await service().search({
      query: "How do I edit a course?",
      language: SUPPORTED_LANGUAGES.PL,
      pageKey: "courses.edit",
      limit: 4,
    });
    expect(client.search).toHaveBeenCalledWith({
      query: "How do I edit a course?",
      language: "pl",
      pageKey: "courses.edit",
      limit: 4,
      appVersion: "4.20.1",
      features: [FEATURES.NEWS],
    });
    expect(JSON.stringify(client.search.mock.calls)).not.toContain("Private");
  });

  it.each([SearchQueryMode.Keyword, SearchQueryMode.Hybrid])(
    "forwards the explicitly selected %s strategy to the SDK",
    async (mode) => {
      await service().search({ query: "edit course", language: SUPPORTED_LANGUAGES.EN, mode });
      expect(client.search).toHaveBeenCalledWith(expect.objectContaining({ mode }));
    },
  );

  it("derives feature flags on each call, including detail deep links", async () => {
    await service().getTutorial("edit-course", { language: SUPPORTED_LANGUAGES.EN });
    expect(client.getTutorial).toHaveBeenLastCalledWith("edit-course", {
      language: "en",
      appVersion: "4.20.1",
      features: "news",
    });
    settings.getGlobalSettings.mockResolvedValue({ [FEATURE_SETTINGS_KEYS[FEATURES.QA]]: true });
    await service().search({ query: "", language: SUPPORTED_LANGUAGES.EN });
    expect(client.search).toHaveBeenLastCalledWith({
      query: "",
      language: "en",
      appVersion: "4.20.1",
      features: [FEATURES.QA],
    });
  });

  it("omits empty feature query rather than sending an invalid blank feature key", async () => {
    settings.getGlobalSettings.mockResolvedValue({});
    await service().getTutorial("edit-course", { language: SUPPORTED_LANGUAGES.EN });
    expect(client.getTutorial).toHaveBeenLastCalledWith("edit-course", {
      language: "en",
      appVersion: "4.20.1",
    });
  });

  it("rejects caller compatibility overrides, URLs, invalid limits and oversized UTF8 before settings or SDK calls", async () => {
    const inputs = [
      { query: "", language: "en", appVersion: "99.0.0" },
      { query: "", language: "en", features: ["news"] },
      { query: "", language: "en", pageKey: "https://tenant.invalid/private" },
      { query: "", language: "en", limit: 11 },
      { query: "", language: "en", mode: "semantic" },
      { query: "", language: "en", mode: null },
      { query: "😀".repeat(251), language: "en" },
      { query: "bad\0query", language: "en" },
    ];
    for (const input of inputs) {
      await expect(
        service().search(input as Parameters<HelpdeskService["search"]>[0]),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(settings.getGlobalSettings).not.toHaveBeenCalled();
    expect(client.search).not.toHaveBeenCalled();
  });

  it("rejects invalid detail keys/languages and supplied compatibility overrides", async () => {
    await expect(service().getTutorial("../private", { language: "en" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service().getTutorial("course", { language: "en", features: "news" } as Parameters<
        HelpdeskService["getTutorial"]
      >[1]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.getTutorial).not.toHaveBeenCalled();
  });

  it("disables all requests locally, without consulting tenant settings", async () => {
    await expect(
      service({ enabled: false }).search({ query: "", language: "en" }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(() => service({ enabled: false }).getDomains()).toThrow(ServiceUnavailableException);
    expect(settings.getGlobalSettings).not.toHaveBeenCalled();
    expect(client.getDomains).not.toHaveBeenCalled();
  });

  it("does not claim compatibility for the bundled development placeholder", async () => {
    await expect(
      service({ appVersion: undefined }).search({ query: "", language: "en" }),
    ).rejects.toMatchObject({
      response: { message: "helpdesk.errors.versionUnavailable", retryable: false },
    });
    expect(client.search).not.toHaveBeenCalled();
  });
});

describe("Helpdesk application version", () => {
  it("uses release metadata when no override exists and strips its v prefix", () => {
    expect(resolveHelpdeskAppVersion(undefined, "v4.20.1")).toBe("4.20.1");
    expect(resolveHelpdeskAppVersion("v4.20.2-rc.1+build.5", "v4.20.1")).toBe(
      "4.20.2-rc.1+build.5",
    );
  });

  it.each(["unknown", "v0.0.0", "0.0.0-dev", "4.20", "04.20.1", "4.20.1-01", "4.20.1/private"])(
    "rejects unknown or invalid version %s",
    (value) => {
      expect(() => resolveHelpdeskAppVersion(value)).toThrow(ServiceUnavailableException);
    },
  );
});
