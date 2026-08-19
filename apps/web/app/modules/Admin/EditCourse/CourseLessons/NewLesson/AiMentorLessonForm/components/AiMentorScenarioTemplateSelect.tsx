import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import {
  AI_MENTOR_SCENARIO_TEMPLATES,
  type AiMentorScenarioTemplate,
} from "../utils/AiMentorScenarioTemplate.helpers";

type AiMentorScenarioTemplateSelectProps = {
  onSelect: (template: AiMentorScenarioTemplate) => void;
};

export const AiMentorScenarioTemplateSelect = ({
  onSelect,
}: AiMentorScenarioTemplateSelectProps) => {
  const { t } = useTranslation();

  return (
    <div className="mb-6 rounded-lg bg-neutral-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.scenarioTemplates.label")}
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {AI_MENTOR_SCENARIO_TEMPLATES.map((template) => (
          <Button
            key={template}
            type="button"
            variant="outline"
            size="sm"
            data-testid={`curriculum-ai-mentor-scenario-template-${template}`}
            className="box-border min-w-0 justify-center px-4 text-center"
            onClick={() => onSelect(template)}
          >
            <span className="block w-full truncate">
              {t(`adminCourseView.curriculum.lesson.other.${template}`)}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};
