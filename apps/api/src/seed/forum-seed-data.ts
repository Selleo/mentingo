export const FORUM_SEED_RANDOM_SEED = 2120;

/** Courses with a discussion; override with FORUM_SEED_COURSE_COUNT to test longer lists. */
export const FORUM_SEED_DEFAULT_COURSE_COUNT = 60;

export const FORUM_SEED_CATEGORY = "Forum demo";

export const FORUM_SEED_COURSE_TITLE_PREFIX = "Forum demo course";

export const FORUM_SEED_COURSE_SUBJECTS = [
  "Sales negotiation",
  "Workplace safety",
  "Customer onboarding",
  "Data privacy",
  "Project planning",
  "Public speaking",
  "Time management",
  "Product knowledge",
  "Leadership basics",
  "Conflict resolution",
];

/** Seeded accounts that are enrolled in every demo course, so they see all course discussions. */
export const FORUM_SEED_VIEWER_EMAILS = ["student@example.com", "admin@example.com"];

export const FORUM_SEED_AUTHOR_EMAIL = "admin@example.com";

export const FORUM_SEED_PARTICIPANT_COUNT = 6;

/** The first seeded participant; a tenant that already has it is skipped. */
export const FORUM_SEED_MARKER_EMAIL = "user+forum+1@example.com";

export const FORUM_SEED_ACTIVITY_DAYS_AGO = 60;

export const FORUM_SEED_MESSAGES_PER_COURSE = { min: 1, max: 8 };

/** The first demo course gets enough messages to fill several pages of its discussion. */
export const FORUM_SEED_BUSY_COURSE_MESSAGES = 35;

export const FORUM_SEED_REPLY_CHANCE = 0.3;

export const FORUM_SEED_REPLIES_PER_MESSAGE = { min: 1, max: 4 };

export const FORUM_SEED_REACTION_CHANCE = 0.25;

export const FORUM_SEED_TOPIC_COUNT = 45;

export const FORUM_SEED_REPLIES_PER_TOPIC = { min: 0, max: 6 };

/** The first topic gets enough replies to fill several pages. */
export const FORUM_SEED_LONG_TOPIC_REPLIES = 45;

export const FORUM_SEED_TOPIC_TITLES = [
  "How do you prepare for onboarding week?",
  "Tips for remote workshops",
  "Which reporting template do you use?",
  "Best way to request a new course",
  "Certificate did not show up after the final quiz",
  "Ideas for the next knowledge-sharing session",
  "How to book a mentoring slot",
  "Feedback on the new learning paths",
  "Where to find the compliance checklist",
  "Study group for the leadership track",
];
