import { runInNewContext } from "node:vm";

import { ScormContentService } from "./scorm-content.service";

describe("SCORM package wrapper", () => {
  it("forwards only successful local calls, rejects calls after finish with error 101", () => {
    const outbound: unknown[] = [];
    let onMessage: (event: unknown) => void = () => undefined;
    let instance: {
      LMSInitialize: (...args: string[]) => string;
      LMSSetValue: (...args: string[]) => string;
      LMSFinish: (...args: string[]) => string;
      LMSGetLastError: () => string;
    };
    class FakeApi {
      LMSInitialize() {
        return "true";
      }
      LMSSetValue(key: string) {
        return key === "invalid" ? "false" : "true";
      }
      LMSCommit() {
        return "true";
      }
      LMSFinish() {
        return "true";
      }
      LMSGetLastError() {
        return "0";
      }
      loadFromFlattenedJSON() {
        return undefined;
      }
      constructor() {
        instance = this as typeof instance;
      }
    }
    const parent = {
      postMessage: (value: unknown, target: string) => {
        expect(target).toBe("https://lms.example");
        outbound.push(value);
      },
    };
    const script = ScormContentService.prototype["bootstrap"](
      "a".repeat(64),
      "https://lms.example",
    );
    runInNewContext(script, {
      window: { Scorm12API: FakeApi, scormAsset: "/assets/index.html" },
      parent,
      crypto: { randomUUID: () => "123e4567-e89b-42d3-a456-426614174000" },
      setInterval: () => 1,
      clearInterval: () => undefined,
      setTimeout: () => undefined,
      addEventListener: (_name: string, callback: typeof onMessage) => {
        onMessage = callback;
      },
      document: { getElementById: () => ({ src: "" }) },
    });
    onMessage({
      source: parent,
      origin: "https://lms.example",
      data: {
        type: "mentingo:scorm:initialize",
        channel: "a".repeat(64),
        session: "123e4567-e89b-42d3-a456-426614174000",
        runtime: {},
      },
    });
    expect(instance!.LMSInitialize("")).toBe("true");
    expect(instance!.LMSSetValue("invalid", "x")).toBe("false");
    expect(instance!.LMSFinish("")).toBe("true");
    expect(instance!.LMSSetValue("cmi.core.lesson_status", "passed")).toBe("false");
    expect(instance!.LMSGetLastError()).toBe("101");
    expect(
      outbound.filter((v) => (v as { type: string }).type === "mentingo:scorm:call"),
    ).toHaveLength(2);
  });
});
