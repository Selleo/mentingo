export const DUE_DATES_SEED_GROUP_NAME = "Due date demo";

export const DUE_DATES_SEED_LEARNER_COUNT = 50;

/**
 * One row per demo course: the due date relative to the day the seed runs, how many group
 * learners are enrolled and how many already finished. A five-day offset lands in the at-risk
 * email, negative offsets in the overdue email; four of each make both emails show "and N more".
 */
export const DUE_DATES_SEED_COURSES = [
  { dueInDays: 5, enrolledLearners: 50, completedLearners: 0 },
  { dueInDays: 5, enrolledLearners: 30, completedLearners: 12 },
  { dueInDays: 5, enrolledLearners: 20, completedLearners: 15 },
  { dueInDays: 5, enrolledLearners: 15, completedLearners: 10 },
  { dueInDays: -1, enrolledLearners: 25, completedLearners: 13 },
  { dueInDays: -3, enrolledLearners: 18, completedLearners: 8 },
  { dueInDays: -7, enrolledLearners: 12, completedLearners: 4 },
  { dueInDays: -14, enrolledLearners: 10, completedLearners: 6 },
] as const;
