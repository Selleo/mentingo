import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TYPE,
  type AiMentorRoleplayDifficulty,
} from "@repo/shared";
import { useTranslation } from "react-i18next";

import {
  ConfigurationChoiceCards,
  ConfigurationTextField,
} from "./fields/AiMentorConfigurationFieldInputs";

import type { Choice } from "./fields/AiMentorConfigurationFieldInputs";

type AiMentorRoleplayConfigurationFieldsProps = {
  canEditStructure: boolean;
};

export const AiMentorRoleplayConfigurationFields = ({
  canEditStructure,
}: AiMentorRoleplayConfigurationFieldsProps) => {
  const { t } = useTranslation();

  const difficultyChoices: Choice<AiMentorRoleplayDifficulty>[] = [
    {
      value: AI_MENTOR_ROLEPLAY_DIFFICULTY.COOPERATIVE,
      label: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.cooperative.label",
      ),
      description: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.cooperative.description",
      ),
    },
    {
      value: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
      label: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.realistic.label",
      ),
      description: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.realistic.description",
      ),
    },
    {
      value: AI_MENTOR_ROLEPLAY_DIFFICULTY.CHALLENGING,
      label: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.challenging.label",
      ),
      description: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.challenging.description",
      ),
    },
  ];

  return (
    <div className="space-y-5" key={AI_MENTOR_TYPE.ROLEPLAY}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ConfigurationTextField
          name="aiRole"
          label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.aiRole.label")}
          placeholder={t(
            "adminCourseView.curriculum.lesson.aiMentorConfiguration.aiRole.placeholder",
          )}
          testId="curriculum-ai-mentor-configuration-ai-role-input"
        />
        <ConfigurationTextField
          name="learnerRole"
          label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.learnerRole.label")}
          placeholder={t(
            "adminCourseView.curriculum.lesson.aiMentorConfiguration.learnerRole.placeholder",
          )}
          testId="curriculum-ai-mentor-configuration-learner-role-input"
        />
      </div>
      <ConfigurationTextField
        name="scenario"
        label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.scenario.label")}
        placeholder={t(
          "adminCourseView.curriculum.lesson.aiMentorConfiguration.scenario.placeholder",
        )}
        richText
        testId="curriculum-ai-mentor-configuration-scenario-input"
      />
      <ConfigurationTextField
        name="characterGoal"
        label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.characterGoal.label")}
        placeholder={t(
          "adminCourseView.curriculum.lesson.aiMentorConfiguration.characterGoal.placeholder",
        )}
        richText
        testId="curriculum-ai-mentor-configuration-character-goal-input"
      />
      <ConfigurationChoiceCards
        name="difficulty"
        label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.label")}
        choices={difficultyChoices}
        columns={3}
        disabled={!canEditStructure}
      />
    </div>
  );
};
