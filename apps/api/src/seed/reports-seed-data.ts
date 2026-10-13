export const REPORTS_SEED_RANDOM_SEED = 2027;

export const REPORTS_SEED_LEARNER_COUNT = 48;

/** The first seeded learner; a tenant that already has it is skipped. */
export const REPORTS_SEED_MARKER_EMAIL = "user+reports+1@example.com";

export const REPORTS_SEED_GROUPS = ["Sales", "Customer Support", "Engineering", "Operations"];

export const REPORTS_SEED_PATH = {
  title: "Compliance essentials",
  description: "Core compliance training every team member completes in their first months.",
  courseCount: 3,
  /** The group whose members are enrolled in the path. */
  groupName: "Customer Support",
};

export const REPORTS_SEED_ENROLLMENTS_PER_LEARNER = { min: 2, max: 4 };

/** Chance of each enrollment outcome; the rest are not started. */
export const REPORTS_SEED_OUTCOME_CHANCE = { completed: 0.45, inProgress: 0.35 };

export const REPORTS_SEED_ENROLLED_DAYS_AGO = { min: 20, max: 240 };

export const REPORTS_SEED_QUIZ_SCORE = { min: 55, max: 100 };

export const REPORTS_SEED_QUIZ_ATTEMPTS = { min: 1, max: 3 };

export const REPORTS_SEED_QUIZ_PASS_PERCENT = 70;

/** Share of completed enrollments that earned a certificate, and of those, the share already expired. */
export const REPORTS_SEED_CERTIFICATE_CHANCE = { issued: 0.85, expired: 0.1 };
