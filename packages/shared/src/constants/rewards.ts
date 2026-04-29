export const REWARD_ACTION_TYPES = {
  CHAPTER_COMPLETED: "chapter_completed",
  AI_CONVERSATION_PASSED: "ai_conversation_passed",
  COURSE_COMPLETED: "course_completed",
} as const;

export type RewardActionType = (typeof REWARD_ACTION_TYPES)[keyof typeof REWARD_ACTION_TYPES];

export const DEFAULT_REWARD_RULE_POINTS: Record<RewardActionType, number> = {
  [REWARD_ACTION_TYPES.CHAPTER_COMPLETED]: 10,
  [REWARD_ACTION_TYPES.AI_CONVERSATION_PASSED]: 30,
  [REWARD_ACTION_TYPES.COURSE_COMPLETED]: 50,
};

export const REWARD_SOURCE_ENTITY_TYPES = {
  CHAPTER: "chapter",
  LESSON: "lesson",
  COURSE: "course",
} as const;

export type RewardSourceEntityType =
  (typeof REWARD_SOURCE_ENTITY_TYPES)[keyof typeof REWARD_SOURCE_ENTITY_TYPES];

export const REWARDS_SOCKET_EVENTS = {
  UPDATED: "rewards:updated",
} as const;
