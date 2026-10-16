import {
  isBunnyApiVideoReadyStatus,
  isBunnyWebhookReadyStatus,
  isValidVideoDuration,
} from "./video-metadata.utils";

describe("video metadata duration validation", () => {
  it.each([1, 1.25, Number.MAX_SAFE_INTEGER])("accepts positive finite duration %s", (value) => {
    expect(isValidVideoDuration(value)).toBe(true);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, "12", null, undefined])(
    "rejects invalid duration %s",
    (value) => {
      expect(isValidVideoDuration(value)).toBe(false);
    },
  );
});

describe("Bunny webhook video readiness", () => {
  it.each([3, 4, "3", "4"])("accepts ready status %s", (value) => {
    expect(isBunnyWebhookReadyStatus(value)).toBe(true);
  });

  it.each([0, 1, 2, 5, 8, 9, null, undefined, "invalid"])("rejects status %s", (value) => {
    expect(isBunnyWebhookReadyStatus(value)).toBe(false);
  });
});

describe("Bunny API video readiness", () => {
  it.each([4, "4"])("accepts ready status %s", (value) => {
    expect(isBunnyApiVideoReadyStatus(value)).toBe(true);
  });

  it.each([0, 1, 2, 3, 5, 6, 8, null, undefined, "invalid"])("rejects status %s", (value) => {
    expect(isBunnyApiVideoReadyStatus(value)).toBe(false);
  });
});
