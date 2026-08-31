import type { LearnerTranscriptionEventPayload, SpeechAlignmentWord } from "@repo/shared";

export type LearnerTranscriptRevision = LearnerTranscriptionEventPayload;

export type MentorSpeechAlignment = {
  turnId: string;
  sequence: number;
  words: SpeechAlignmentWord[];
};

export type MentorSpeechPresentation = MentorSpeechAlignment & {
  activeWordIndex: number | null;
};
