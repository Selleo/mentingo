import type { AiMentorConfigurationRepository } from "../repositories/ai-mentor-configuration.repository";
import type { LocalizedText } from "@repo/shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";

export type AiMentorConfigurationCourseTranslationSource = Awaited<
  ReturnType<AiMentorConfigurationRepository["getConfigurationsForCourse"]>
>[number];

export type AiMentorTranslationCandidate = {
  id: UUIDType;
  source: LocalizedText | null;
  field: AnyPgColumn;
  idColumn: AnyPgColumn;
  metadata: string;
};
