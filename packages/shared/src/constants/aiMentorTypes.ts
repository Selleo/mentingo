export const AI_MENTOR_TYPE = {
  TEACHER: "teacher",
  ROLEPLAY: "roleplay",
} as const;

export const DEFAULT_AI_MENTOR_TYPE = AI_MENTOR_TYPE.ROLEPLAY;

export type AiMentorType = (typeof AI_MENTOR_TYPE)[keyof typeof AI_MENTOR_TYPE];

export const AI_MENTOR_TEACHING_STYLE = {
  EXPLAIN_AND_PRACTICE: "explain_and_practice",
  GUIDED_DISCOVERY: "guided_discovery",
  SOCRATIC: "socratic",
} as const;

export type AiMentorTeachingStyle =
  (typeof AI_MENTOR_TEACHING_STYLE)[keyof typeof AI_MENTOR_TEACHING_STYLE];

export const AI_MENTOR_ROLEPLAY_DIFFICULTY = {
  COOPERATIVE: "cooperative",
  REALISTIC: "realistic",
  CHALLENGING: "challenging",
} as const;

export type AiMentorRoleplayDifficulty =
  (typeof AI_MENTOR_ROLEPLAY_DIFFICULTY)[keyof typeof AI_MENTOR_ROLEPLAY_DIFFICULTY];
