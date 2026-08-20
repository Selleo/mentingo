import { VOICE_SOCKET_EVENT } from "@repo/shared";
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
