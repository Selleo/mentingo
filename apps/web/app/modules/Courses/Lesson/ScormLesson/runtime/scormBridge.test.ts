import { SCORM_BRIDGE_MESSAGE_TYPES } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import { attachScormBridge } from "./scormBridge";
import { createScorm12Api } from "./scormRuntime.helpers";

describe("SCORM bridge", () => {
  const channel = "a".repeat(64);
  const origin = "https://scorm.lms.localhost";
  const session = "00000000-0000-0000-0000-000000000001";
  const launchUrl = `${origin}/api/scorm/delivery/${channel}/player`;

  function setup() {
    const api = createScorm12Api();
    api.loadFromFlattenedJSON({ "cmi.core.lesson_location": "resume" });
    const frame = { postMessage: vi.fn() } as unknown as Window;
    const detach = attachScormBridge({ api, launchUrl, getFrame: () => frame });
    const send = (data: object, source: Window = frame, eventOrigin = origin) =>
      window.dispatchEvent(
        new MessageEvent("message", {
          source,
          origin: eventOrigin,
          data: { channel, session, ...data },
        }),
      );
    const call = (sequence: number, method: string, params = [""]) =>
      send({ type: SCORM_BRIDGE_MESSAGE_TYPES.CALL, sequence, method, params });
    return { api, frame, detach, send, call };
  }

  it("requires the expected frame, origin and grant before disclosing runtime", () => {
    const { frame, detach, send } = setup();
    try {
      send({ type: SCORM_BRIDGE_MESSAGE_TYPES.READY }, window);
      send({ type: SCORM_BRIDGE_MESSAGE_TYPES.READY }, frame, "https://attacker.example");
      send({ type: SCORM_BRIDGE_MESSAGE_TYPES.READY, channel: "wrong" });
      expect(frame.postMessage).not.toHaveBeenCalled();
      send({ type: SCORM_BRIDGE_MESSAGE_TYPES.READY });
      expect(frame.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: expect.objectContaining({ "cmi.core.lesson_location": "resume" }),
        }),
        origin,
      );
    } finally {
      detach();
    }
  });

  it("forwards ordered SCORM calls to the existing runtime and rejects arbitrary methods", () => {
    const { api, detach, send, call } = setup();
    const commit = vi.fn();
    const finish = vi.fn();
    api.on("LMSCommit", commit);
    api.on("LMSFinish", finish);
    try {
      send({ type: SCORM_BRIDGE_MESSAGE_TYPES.READY });
      call(1, "LMSInitialize");
      call(2, "LMSSetValue", ["cmi.core.lesson_location", "chapter-2"]);
      call(2, "LMSSetValue", ["cmi.core.lesson_location", "replay"]);
      call(4, "LMSFinish");
      call(3, "reset");
      expect(api.LMSGetValue("cmi.core.lesson_location")).toBe("chapter-2");
      expect(finish).not.toHaveBeenCalled();
      call(3, "LMSCommit");
      expect(commit).not.toHaveBeenCalled();
      call(4, "LMSCommit");
      call(5, "LMSFinish");
      expect(commit).toHaveBeenCalledTimes(1);
      expect(finish).toHaveBeenCalledTimes(1);
      detach();
      call(6, "LMSCommit");
      expect(commit).toHaveBeenCalledTimes(1);
    } finally {
      detach();
    }
  });

  it("continues after an oversized value from the expected frame and session", () => {
    const { api, detach, send, call } = setup();
    const commit = vi.fn();
    const finish = vi.fn();
    api.on("LMSCommit", commit);
    api.on("LMSFinish", finish);
    try {
      send({ type: SCORM_BRIDGE_MESSAGE_TYPES.READY });
      call(1, "LMSInitialize");
      send(
        {
          type: SCORM_BRIDGE_MESSAGE_TYPES.CALL,
          sequence: 2,
          method: "LMSCommit",
          params: [""],
        },
        window,
      );
      send({
        type: SCORM_BRIDGE_MESSAGE_TYPES.CALL,
        sequence: 2,
        method: "LMSCommit",
        params: [""],
        session: "00000000-0000-0000-0000-000000000002",
      });
      expect(commit).not.toHaveBeenCalled();
      call(2, "LMSSetValue", ["cmi.suspend_data", "S".repeat(5000)]);
      call(3, "LMSSetValue", ["cmi.core.lesson_location", "after"]);
      call(4, "LMSCommit");
      call(5, "LMSFinish");

      expect(api.LMSGetValue("cmi.suspend_data")).toBe("");
      expect(api.LMSGetValue("cmi.core.lesson_location")).toBe("after");
      expect(commit).toHaveBeenCalledTimes(1);
      expect(finish).toHaveBeenCalledTimes(1);
    } finally {
      detach();
    }
  });
});
