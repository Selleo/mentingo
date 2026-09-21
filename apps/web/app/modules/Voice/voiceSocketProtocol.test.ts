import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { voiceSocketProtocol } from "./voiceSocketProtocol";

describe("voiceSocketProtocol speech boundaries", () => {
  const boundary = {
    sessionRunId: "run-1",
    boundarySeq: 2,
    tsMs: 1234,
    lastAudioSeq: 7,
  };

  it("builds a typed client speech start event", () => {
    expect(voiceSocketProtocol.buildSpeechStartEmit?.({ boundary })).toEqual({
      event: VOICE_SOCKET_EVENT.CLIENT_SPEECH_START,
      args: [boundary],
    });
  });

  it("builds a typed client speech end event", () => {
    expect(voiceSocketProtocol.buildSpeechEndEmit?.({ boundary })).toEqual({
      event: VOICE_SOCKET_EVENT.CLIENT_SPEECH_END,
      args: [boundary],
    });
  });
});

describe("voiceSocketProtocol conversation target", () => {
  const init = { sr: 16000, channels: 1, format: "pcm_s16le" } as const;

  it.each([{ lessonId: "lesson-1" }, { practiceSessionId: "practice-1", threadId: "attempt-2" }])(
    "preserves the target in audio startup: %j",
    (target) => {
      expect(
        voiceSocketProtocol.buildStartEmit({
          init,
          context: { voiceAction: VOICE_ACTION.VOICE_MENTOR, ...target },
        }),
      ).toEqual({
        event: VOICE_SOCKET_EVENT.START_AUDIO,
        args: [{ voiceAction: VOICE_ACTION.VOICE_MENTOR, ...target, meta: init }],
      });
    },
  );
});
