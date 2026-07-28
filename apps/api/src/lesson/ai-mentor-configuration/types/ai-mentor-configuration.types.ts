import type { AiMentorType, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  aiMentorConfigurations,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
} from "src/storage/schema";

export type AiMentorConfigurationGraph = {
  configuration: typeof aiMentorConfigurations.$inferSelect;
  teacherConfiguration: typeof aiMentorTeacherConfigurations.$inferSelect | null;
  roleplayConfiguration: typeof aiMentorRoleplayConfigurations.$inferSelect | null;
};

export type AiMentorConfigurationLessonContext = {
  courseId: UUIDType;
  lessonId: UUIDType;
  lessonType: string;
  aiMentorLessonId: UUIDType | null;
  configurationId: UUIDType | null;
  configurationType: AiMentorType | null;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
};

export type ConfiguredAiMentorLessonContext = Omit<
  AiMentorConfigurationLessonContext,
  "aiMentorLessonId" | "configurationId" | "configurationType"
> & {
  aiMentorLessonId: UUIDType;
  configurationId: UUIDType;
  configurationType: AiMentorType;
};
