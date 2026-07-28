import { AI_MENTOR_TYPE, type AiMentorType } from "@repo/shared";
import { Drama, GraduationCap } from "lucide-react";
import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { AiMentorFineTuneConfigurationFields } from "./AiMentorFineTuneConfigurationFields";
import { AiMentorRoleplayConfigurationFields } from "./AiMentorRoleplayConfigurationFields";
import { AiMentorTeacherConfigurationFields } from "./AiMentorTeacherConfigurationFields";
import { ConfigurationChoiceCards } from "./fields/AiMentorConfigurationFieldInputs";

import type { AiMentorConfigurationDraft } from "./aiMentorConfiguration.types";
import type { Choice } from "./fields/AiMentorConfigurationFieldInputs";

type AiMentorConfigurationFieldsProps = {
  canEditStructure: boolean;
  onTypeChange: (type: AiMentorType) => void;
};

export const AiMentorConfigurationFields = ({
  canEditStructure,
  onTypeChange,
}: AiMentorConfigurationFieldsProps) => {
  const { t } = useTranslation();
  const form = useFormContext<AiMentorConfigurationDraft>();
  const optionalFieldsRef = useRef<HTMLDetailsElement>(null);
  const type = useWatch({ control: form.control, name: "type" });
  const errorKeys = Object.keys(form.formState.errors);
  const hasOptionalError = [
    "feedbackGuidance",
    "factsAndConstraints",
    "openingInstruction",
    "additionalInstructions",
  ].some((field) => errorKeys.includes(field));

  useEffect(() => {
    if (hasOptionalError && optionalFieldsRef.current) optionalFieldsRef.current.open = true;
  }, [hasOptionalError]);

  const modeChoices: Choice<AiMentorType>[] = [
    {
      value: AI_MENTOR_TYPE.ROLEPLAY,
      label: t("adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.roleplay.label"),
      description: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.roleplay.description",
      ),
      icon: Drama,
    },
    {
      value: AI_MENTOR_TYPE.TEACHER,
      label: t("adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.teacher.label"),
      description: t(
        "adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.teacher.description",
      ),
      icon: GraduationCap,
    },
  ];

  return (
    <div className="space-y-5">
      {!canEditStructure && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">
            {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.translationModeTitle")}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {t(
              "adminCourseView.curriculum.lesson.aiMentorConfiguration.translationModeDescription",
            )}
          </p>
        </div>
      )}

      <ConfigurationChoiceCards
        name="type"
        label={t("adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.label")}
        choices={modeChoices}
        columns={2}
        disabled={!canEditStructure}
        onValueChange={(value) => onTypeChange(value)}
      />

      {type === AI_MENTOR_TYPE.TEACHER ? (
        <AiMentorTeacherConfigurationFields canEditStructure={canEditStructure} />
      ) : (
        <AiMentorRoleplayConfigurationFields canEditStructure={canEditStructure} />
      )}

      <AiMentorFineTuneConfigurationFields
        type={type}
        hasOptionalError={hasOptionalError}
        optionalFieldsRef={optionalFieldsRef}
      />
    </div>
  );
};
