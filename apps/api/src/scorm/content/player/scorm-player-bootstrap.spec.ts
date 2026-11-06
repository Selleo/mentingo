import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { SCORM_BRIDGE_MESSAGE_TYPES, SCORM_PLAYER_ATTRIBUTES } from "@repo/shared";

import { renderScormBootstrap } from "./scorm-player-bootstrap";

import type { Scorm12API } from "scorm-again";

describe("SCORM player bootstrap", () => {
  it("forwards only successful calls and stops forwarding after finish", () => {
    const runtimeContext: {
      console: Console;
      setTimeout: typeof setTimeout;
      clearTimeout: typeof clearTimeout;
      Scorm12API?: typeof Scorm12API;
    } = { console, setTimeout, clearTimeout };
    runInNewContext(
      readFileSync(require.resolve("scorm-again/scorm12/min"), "utf8"),
      runtimeContext,
    );
    const runtimeApi = runtimeContext.Scorm12API;
    if (!runtimeApi) throw new Error("SCORM runtime bundle did not expose Scorm12API");

    const parent = { postMessage: jest.fn() };
    const frame = { dataset: {}, setAttribute: jest.fn() };
    const document = {
      createElement: jest.fn(() => frame),
      body: { appendChild: jest.fn() },
    };
    let onMessage:
      | ((event: { origin: string; source: typeof parent; data: object }) => void)
      | undefined;
    const playerWindow = {
      parent,
      Scorm12API: runtimeApi,
      setInterval: jest.fn(() => 1),
      setTimeout: jest.fn(() => 2),
      clearInterval: jest.fn(),
      clearTimeout: jest.fn(),
      addEventListener: jest.fn((type: string, listener: typeof onMessage) => {
        if (type === "message") onMessage = listener;
      }),
      removeEventListener: jest.fn(),
    };
    const parentOrigin = "https://app.lms.localhost";
    const channel = "a".repeat(64);
    const script = renderScormBootstrap({ parentOrigin, channel, assetUrl: "/lesson.html" });
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      runInNewContext(script, {
        window: playerWindow,
        document,
        crypto: { randomUUID: () => "00000000-0000-0000-0000-000000000001" },
      });

      const ready = parent.postMessage.mock.calls[0][0];
      onMessage?.({
        origin: parentOrigin,
        source: parent,
        data: {
          type: SCORM_BRIDGE_MESSAGE_TYPES.INITIALIZE,
          channel,
          session: ready.session,
          runtime: {},
        },
      });

      const api = (
        playerWindow as typeof playerWindow & { API: Record<string, (...args: string[]) => string> }
      ).API;
      const calls = () =>
        parent.postMessage.mock.calls
          .map(([message]) => message)
          .filter((message) => message.type === SCORM_BRIDGE_MESSAGE_TYPES.CALL);

      expect(frame.setAttribute).toHaveBeenCalledWith("sandbox", SCORM_PLAYER_ATTRIBUTES.SANDBOX);
      expect(SCORM_PLAYER_ATTRIBUTES.SANDBOX).toContain("allow-modals");
      expect(api.LMSCommit("")).toBe("false");
      expect(api.LMSGetLastError()).toBe("301");
      expect(calls()).toHaveLength(0);

      expect(api.LMSInitialize("")).toBe("true");
      expect(api.LMSSetValue("cmi.core.lesson_status", "completed")).toBe("true");
      expect(api.LMSFinish("")).toBe("true");
      expect(calls()).toHaveLength(3);

      expect(api.LMSFinish("")).toBe("false");
      expect(api.LMSGetLastError()).toBe("101");
      expect(api.LMSSetValue("cmi.core.lesson_status", "incomplete")).toBe("false");
      expect(api.LMSGetLastError()).toBe("101");
      expect(api.LMSGetValue("cmi.core.lesson_status")).toBe("completed");
      expect(api.LMSCommit("")).toBe("false");
      expect(calls()).toHaveLength(3);
    } finally {
      consoleError.mockRestore();
    }
  });
});
