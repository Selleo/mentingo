import type { AiJudgeConfigurationDraft } from "./AiJudge/aiJudgeConfiguration.types";
import type { AiMentorConfigurationDraft } from "./AiMentorConfiguration/aiMentorConfiguration.types";

/** Proposed configuration shown read-only when an AI Mentor lesson is reviewed before applying. */
export type AiMentorLessonReviewPreview = {
  /** Whether the lesson already exists, so unchanged configuration can still be loaded. */
  isPersisted: boolean;
  aiMentorConfiguration?: AiMentorConfigurationDraft;
  aiJudgeConfiguration?: AiJudgeConfigurationDraft;
  /** Attached authoring source files, resolved from the current session catalog. */
  sourceFiles?: Array<{ id: string; name: string; mediaType: string | null }>;
};
