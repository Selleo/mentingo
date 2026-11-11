import type { AiMentorConfigurationValidationIssue } from "../schemas/ai-mentor-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

export function preserveAiMentorRepairScope(
  current: AiMentorConfigurationContent,
  generated: AiMentorConfigurationContent,
  issues: AiMentorConfigurationValidationIssue[],
): AiMentorConfigurationContent {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(generated).filter(([field]) =>
        issues.some((issue) => issue.target.field === field),
      ),
    ),
  };
}
