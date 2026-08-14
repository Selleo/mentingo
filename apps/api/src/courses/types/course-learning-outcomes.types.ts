import type { SupportedLanguages } from "@repo/shared";

export type CourseLearningOutcomesByLanguage = Partial<Record<SupportedLanguages, string[]>>;
