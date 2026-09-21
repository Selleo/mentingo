import { LEARNER_TRANSCRIPT_STATUSES } from "@repo/shared";

import type {
  LearnerTranscriptRevision,
  MentorSpeechAlignment,
} from "./voice-mentor-presentation.types";
import type { AudioOutputAlignmentEventPayload } from "@repo/shared";

export function acceptLearnerTranscriptRevision(
  current: LearnerTranscriptRevision | null,
  incoming: LearnerTranscriptRevision,
): LearnerTranscriptRevision {
  if (!current || current.turnId !== incoming.turnId) {
    return incoming;
  }

  if (incoming.status === LEARNER_TRANSCRIPT_STATUSES.FINAL) {
    return incoming;
  }

  if (
    current.status === LEARNER_TRANSCRIPT_STATUSES.FINAL ||
    incoming.revision < current.revision
  ) {
    return current;
  }

  return incoming;
}

export function acceptMentorSpeechAlignment(
  current: MentorSpeechAlignment | null,
  incoming: AudioOutputAlignmentEventPayload,
): MentorSpeechAlignment {
  if (current && current.turnId === incoming.turnId && incoming.sequence <= current.sequence) {
    return current;
  }

  return incoming;
}

export function resolveActiveWordIndex(
  alignment: MentorSpeechAlignment | null,
  turnId: string,
  elapsedMs: number,
): number | null {
  if (!alignment || alignment.turnId !== turnId || alignment.words.length === 0) {
    return null;
  }

  const activeIndex = alignment.words.findIndex(
    ({ startMs, endMs }) => elapsedMs >= startMs && elapsedMs < endMs,
  );
  if (activeIndex >= 0) {
    return activeIndex;
  }

  for (let index = alignment.words.length - 1; index >= 0; index -= 1) {
    if ((alignment.words[index]?.endMs ?? Number.POSITIVE_INFINITY) <= elapsedMs) {
      return index;
    }
  }

  return null;
}
