import { isMcpNativeFeatureCapabilities } from "./mcp-native-read.types";

const valid = {
  articles: { enabled: false, canList: false, canRead: false },
  news: { enabled: true, canList: true, canRead: true },
  qa: { enabled: true, canList: false, canRead: false },
  developmentPaths: { enabled: true, canList: true, canRead: false },
};

describe("Native capability snapshot validation", () => {
  it("accepts complete boolean access metadata including disabled and permission-denied modules", () => {
    expect(isMcpNativeFeatureCapabilities(valid)).toBe(true);
  });

  it.each([
    undefined,
    null,
    [],
    true,
    {},
    { ...valid, articles: null },
    { ...valid, news: [] },
    { ...valid, qa: { enabled: "false", canList: false, canRead: false } },
    { ...valid, developmentPaths: { enabled: true, canList: true } },
    { ...valid, articles: { enabled: false, canList: null, canRead: false } },
  ])("rejects incomplete or nonboolean capability payload %#", (value) => {
    expect(isMcpNativeFeatureCapabilities(value)).toBe(false);
  });
});
