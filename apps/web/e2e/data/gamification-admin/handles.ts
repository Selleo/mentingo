export const GAMIFICATION_ADMIN_HANDLES = {
  PAGE: "gamification-admin-page",
  CREATE_BUTTON: "gamification-admin-create-achievement",
  ROW_PREFIX: "gamification-admin-achievement-row-",
  row: (achievementId: string) => `gamification-admin-achievement-row-${achievementId}`,
} as const;

export const ACHIEVEMENT_FORM_HANDLES = {
  PAGE: "achievement-form-page",
  LANGUAGE_SELECT: "achievement-form-language-select",
  TITLE_INPUT: "achievement-form-title",
  DESCRIPTION_INPUT: "achievement-form-description",
  WINDOW_DAYS_INPUT: "achievement-form-window-days",
  MIN_SCORE_INPUT: "achievement-form-min-score",
  ADD_LEVEL_BUTTON: "achievement-form-add-level",
  levelThreshold: (index: number) => `achievement-form-level-${index}-threshold`,
  levelXp: (index: number) => `achievement-form-level-${index}-xp`,
  removeLevel: (index: number) => `achievement-form-level-${index}-remove`,
  SUBMIT_BUTTON: "achievement-form-submit",
} as const;
