import { LEARNER_TRANSCRIPT_STATUSES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  acceptLearnerTranscriptRevision,
  acceptMentorSpeechAlignment,
  resolveActiveWordIndex,
} from "./voice-mentor-presentation";

import type { LearnerTranscriptRevision } from "./voice-mentor-presentation.types";

const partialRevision: LearnerTranscriptRevision = {
  text: "I would like",
  turnId: "turn-1",
  segmentId: "segment-1",
  revision: 1,
  status: LEARNER_TRANSCRIPT_STATUSES.PARTIAL,
};

describe("voice mentor presentation", () => {
  it("keeps a final learner transcript when a late partial revision arrives", () => {
    const finalRevision: LearnerTranscriptRevision = {
      ...partialRevision,
      text: "I would like a discount",
      revision: 2,
      status: LEARNER_TRANSCRIPT_STATUSES.FINAL,
    };

    expect(acceptLearnerTranscriptRevision(finalRevision, partialRevision)).toBe(finalRevision);
  });

  it("accepts a final transcript regardless of the provider revision counter", () => {
    const finalRevision: LearnerTranscriptRevision = {
      ...partialRevision,
      text: "I would like a discount",
      revision: 0,
      status: LEARNER_TRANSCRIPT_STATUSES.FINAL,
    };

    expect(acceptLearnerTranscriptRevision(partialRevision, finalRevision)).toBe(finalRevision);
  });

  it("ignores stale mentor alignment and resolves words from playback time", () => {
    const alignment = {
      turnId: "turn-1",
      sequence: 2,
      words: [
        { text: "Hello", startMs: 0, endMs: 300 },
        { text: "there", startMs: 300, endMs: 650 },
      ],
    };
    const staleAlignment = { ...alignment, sequence: 1 };

    expect(acceptMentorSpeechAlignment(alignment, staleAlignment)).toBe(alignment);
    expect(resolveActiveWordIndex(alignment, "turn-1", 420)).toBe(1);
    expect(resolveActiveWordIndex(alignment, "another-turn", 420)).toBeNull();
  });
});
