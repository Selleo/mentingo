import { validateScormCall } from "@repo/shared";

import { resolveScormContentConfig, contentHeaders } from "./scorm-content.config";

describe("isolated SCORM policy", () => {
  it("rejects unsafe or identical origins and malformed connect configuration", () => {
    expect(() =>
      resolveScormContentConfig(
        { SCORM_CONTENT_ORIGIN: "https://lms.example", SCORM_CONTENT_ENFORCE_CONNECT_SRC: "false" },
        "https://lms.example",
      ),
    ).toThrow();
    for (const origin of [
      "http://scorm.example",
      "https://scorm.example/",
      "https://user@scorm.example",
      "https://scorm.example/path",
    ]) {
      expect(() =>
        resolveScormContentConfig({ SCORM_CONTENT_ORIGIN: origin }, "https://lms.example"),
      ).toThrow();
    }
    expect(() =>
      resolveScormContentConfig(
        {
          SCORM_CONTENT_ORIGIN: "https://scorm.example",
          SCORM_CONTENT_ALLOWED_CONNECT_ORIGINS: "https://api.example/path",
        },
        "https://lms.example",
      ),
    ).toThrow();
    expect(() =>
      resolveScormContentConfig(
        { SCORM_CONTENT_ORIGIN: "https://scorm.example", SCORM_CONTENT_ENFORCE_CONNECT_SRC: "yes" },
        "https://lms.example",
      ),
    ).toThrow();
  });

  it("only enforces connect-src when explicitly enabled", () => {
    const config = resolveScormContentConfig(
      {
        SCORM_CONTENT_ORIGIN: "https://scorm.example",
        SCORM_CONTENT_ALLOWED_CONNECT_ORIGINS: "https://api.example:8443",
      },
      "https://lms.example",
    );
    expect(contentHeaders(config)["Content-Security-Policy"]).not.toContain("connect-src");
    expect(
      contentHeaders({ ...config, enforceConnectSrc: true })["Content-Security-Policy"],
    ).toContain("connect-src 'self' https://api.example:8443");
    expect(contentHeaders(config)["Content-Security-Policy"]).toContain("form-action 'none'");
  });

  it("consumes invalid call details without losing bridge sequence", () => {
    const state = {
      channel: "a".repeat(64),
      session: "123e4567-e89b-42d3-a456-426614174000",
      sequence: 0,
    };
    expect(
      validateScormCall(
        {
          type: "mentingo:scorm:call",
          channel: state.channel,
          session: state.session,
          sequence: 1,
          method: "LMSSetValue",
          params: ["bad"],
        },
        state,
      ),
    ).toBeNull();
    expect(state.sequence).toBe(1);
    expect(
      validateScormCall(
        {
          type: "mentingo:scorm:call",
          channel: state.channel,
          session: state.session,
          sequence: 2,
          method: "LMSCommit",
          params: [""],
        },
        state,
      )?.method,
    ).toBe("LMSCommit");
    expect(
      validateScormCall(
        {
          type: "mentingo:scorm:call",
          channel: state.channel,
          session: state.session,
          sequence: 2,
          method: "LMSCommit",
          params: [""],
        },
        state,
      ),
    ).toBeNull();
    expect(state.sequence).toBe(2);
  });
});
