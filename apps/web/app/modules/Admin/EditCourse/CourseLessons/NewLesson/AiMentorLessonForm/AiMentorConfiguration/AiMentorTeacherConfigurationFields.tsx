import { AI_MENTOR_TEACHING_STYLE, AI_MENTOR_TYPE, type AiMentorTeachingStyle } from "@repo/shared";
import { useTranslation } from "react-i18next";

import {
  ConfigurationChoiceCards,
  ConfigurationTextField,
} from "./fields/AiMentorConfigurationFieldInputs";

import type { Choice } from "./fields/AiMentorConfigurationFieldInputs";

type AiMentorTeacherConfigurationFieldsProps = {
  canEditStructure: boolean;
};

export const AiMentorTeacherConfigurationFields = ({
  canEditStructure,
}: AiMentorTeacherConfigurationFieldsProps) => {
  const { t } = useTranslation();

  const teachingStyleChoices: Choice<AiMentorTeachingStyle>[] = [
    {
      value: AI_MENTOR_TEACHING_STYLE.EXPLAIN_AND_PRACTICE,
      label: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.explain_and_practice.label",
      ),
      description: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.explain_and_practice.description",
      ),
    },
    {
      value: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
      label: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.guided_discovery.label",
      ),
      description: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.guided_discovery.description",
      ),
    },
    {
      value: AI_MENTOR_TEACHING_STYLE.SOCRATIC,
      label: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.socratic.label",
      ),
      description: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.socratic.description",
      ),
    },
  ];

  return (
    <div className="space-y-5" key={AI_MENTOR_TYPE.TEACHER}>
      <ConfigurationTextField
        name="expertise"
        label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.expertise.label")}
        placeholder={t(
          "adminCourseView.curriculum.lesson.aiMentorConfiguration.expertise.placeholder",
        )}
        testId="curriculum-ai-mentor-configuration-expertise-input"
      />
      <ConfigurationTextField
        name="taskGoal"
        label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.taskGoal.label")}
        placeholder={t(
          "adminCourseView.curriculum.lesson.aiMentorConfiguration.taskGoal.placeholder",
        )}
        richText
        testId="curriculum-ai-mentor-configuration-task-goal-input"
      />
      <ConfigurationTextField
        name="contentScope"
        label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.contentScope.label")}
        placeholder={t(
          "adminCourseView.curriculum.lesson.aiMentorConfiguration.contentScope.placeholder",
        )}
        richText
        testId="curriculum-ai-mentor-configuration-content-scope-input"
      />
      <ConfigurationChoiceCards
        name="teachingStyle"
        label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.label")}
        choices={teachingStyleChoices}
        columns={3}
        disabled={!canEditStructure}
      />
    </div>
  );
};
