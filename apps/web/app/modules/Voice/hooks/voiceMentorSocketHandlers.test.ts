import { VOICE_SOCKET_EVENT } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import { createVoiceMentorSocketHandlers } from "./voiceMentorSocketHandlers";
import { createVoiceMentorTurnState } from "./voiceMentorTurnState";

import type { RealtimePCMPlayer } from "../audio-player";
import type { MutableRefObject } from "react";

describe("createVoiceMentorSocketHandlers", () => {
  it("forwards streamed mentor response deltas to the UI", () => {
    const onMentorResponseDelta = vi.fn();
    const audioPlayerRef: MutableRefObject<RealtimePCMPlayer | null> = { current: null };
    const turnStateRef = { current: createVoiceMentorTurnState() };
    const handlers = createVoiceMentorSocketHandlers({
      setInput: vi.fn(),
      stopCaptureFromServer: async () => undefined,
      showErrorToast: vi.fn(),
      audioPlayerRef,
      turnStateRef,
      clearTurnState: vi.fn(),
      restartInactivityTimer: vi.fn(),
      clearInactivityTimer: vi.fn(),
      finalizeTurnIfReady: vi.fn(),
      onMentorResponseDelta,
    });

    handlers[VOICE_SOCKET_EVENT.MENTOR_RESPONSE_DELTA]({ text: "A streamed sentence. " });

    expect(onMentorResponseDelta).toHaveBeenCalledWith("A streamed sentence. ");
  });
});
