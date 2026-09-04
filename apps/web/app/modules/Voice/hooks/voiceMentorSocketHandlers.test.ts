import { LEARNER_TRANSCRIPT_STATUSES, VOICE_SOCKET_EVENT } from "@repo/shared";
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
      closeLearnerTurn: vi.fn(),
      onMentorResponseDelta,
    });

    handlers[VOICE_SOCKET_EVENT.MENTOR_RESPONSE_DELTA]({ text: "A streamed sentence. " });

    expect(onMentorResponseDelta).toHaveBeenCalledWith("A streamed sentence. ");
  });

  it("closes turn-scoped upload when the finalized learner transcript arrives", () => {
    const closeLearnerTurn = vi.fn();
    const onLearnerTranscription = vi.fn();
    const handlers = createVoiceMentorSocketHandlers({
      setInput: vi.fn(),
      stopCaptureFromServer: async () => undefined,
      showErrorToast: vi.fn(),
      audioPlayerRef: { current: null },
      turnStateRef: { current: createVoiceMentorTurnState() },
      clearTurnState: vi.fn(),
      restartInactivityTimer: vi.fn(),
      clearInactivityTimer: vi.fn(),
      finalizeTurnIfReady: vi.fn(),
      closeLearnerTurn,
      onLearnerTranscription,
    });

    const revision = {
      text: "Learner message",
      turnId: "turn-1",
      segmentId: "segment-1",
      revision: 1,
      status: LEARNER_TRANSCRIPT_STATUSES.FINAL,
    };
    handlers[VOICE_SOCKET_EVENT.LEARNER_TRANSCRIPTION](revision);

    expect(closeLearnerTurn).toHaveBeenCalledOnce();
    expect(onLearnerTranscription).toHaveBeenCalledWith(revision);
  });

  it("keeps capture open while forwarding a partial learner transcript", () => {
    const closeLearnerTurn = vi.fn();
    const onLearnerTranscription = vi.fn();
    const handlers = createVoiceMentorSocketHandlers({
      setInput: vi.fn(),
      stopCaptureFromServer: async () => undefined,
      showErrorToast: vi.fn(),
      audioPlayerRef: { current: null },
      turnStateRef: { current: createVoiceMentorTurnState() },
      clearTurnState: vi.fn(),
      restartInactivityTimer: vi.fn(),
      clearInactivityTimer: vi.fn(),
      finalizeTurnIfReady: vi.fn(),
      closeLearnerTurn,
      onLearnerTranscription,
    });

    const revision = {
      text: "Learner is still speaking",
      turnId: "turn-1",
      segmentId: "segment-1",
      revision: 2,
      status: LEARNER_TRANSCRIPT_STATUSES.PARTIAL,
    };
    handlers[VOICE_SOCKET_EVENT.LEARNER_TRANSCRIPTION](revision);

    expect(closeLearnerTurn).not.toHaveBeenCalled();
    expect(onLearnerTranscription).toHaveBeenCalledWith(revision);
  });
});
