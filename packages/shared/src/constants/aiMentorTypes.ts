export const AI_MENTOR_TYPE = {
  MENTOR: "mentor",
  TEACHER: "teacher",
  ROLEPLAY: "roleplay",
} as const;

export type AiMentorType = (typeof AI_MENTOR_TYPE)[keyof typeof AI_MENTOR_TYPE];
