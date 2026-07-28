import { AI_MENTOR_TYPE } from "@repo/shared";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { ConfigurationTextField } from "./fields/AiMentorConfigurationFieldInputs";

import type { AiMentorType } from "@repo/shared";
import type { RefObject } from "react";

type AiMentorFineTuneConfigurationFieldsProps = {
  type: AiMentorType;
  hasOptionalError: boolean;
  optionalFieldsRef: RefObject<HTMLDetailsElement>;
};

export const AiMentorFineTuneConfigurationFields = ({
  type,
  hasOptionalError,
  optionalFieldsRef,
}: AiMentorFineTuneConfigurationFieldsProps) => {
  const { t } = useTranslation();

  return (
    <details
      ref={optionalFieldsRef}
      className={cn("group rounded-lg border bg-white", {
        "border-error-500": hasOptionalError,
        "border-neutral-200": !hasOptionalError,
      })}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <SlidersHorizontal className="size-4 text-neutral-500" />
          <span className="text-sm font-semibold text-neutral-900">
            {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.fineTuneBehavior")}
          </span>
        </span>
        <ChevronDown className="size-4 text-neutral-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-neutral-100 px-4 py-4">
        {type === AI_MENTOR_TYPE.TEACHER ? (
          <ConfigurationTextField
            name="feedbackGuidance"
            label={t(
              "adminCourseView.curriculum.lesson.aiMentorConfiguration.feedbackGuidance.label",
            )}
            placeholder={t(
              "adminCourseView.curriculum.lesson.aiMentorConfiguration.feedbackGuidance.placeholder",
            )}
            richText
            optional
          />
        ) : (
          <ConfigurationTextField
            name="factsAndConstraints"
            label={t(
              "adminCourseView.curriculum.lesson.aiMentorConfiguration.factsAndConstraints.label",
            )}
            placeholder={t(
              "adminCourseView.curriculum.lesson.aiMentorConfiguration.factsAndConstraints.placeholder",
            )}
            richText
            optional
          />
        )}
        <ConfigurationTextField
          name="openingInstruction"
          label={t(
            "adminCourseView.curriculum.lesson.aiMentorConfiguration.openingInstruction.label",
          )}
          placeholder={t(
            "adminCourseView.curriculum.lesson.aiMentorConfiguration.openingInstruction.placeholder",
          )}
          richText
          optional
        />
        <ConfigurationTextField
          name="additionalInstructions"
          label={t(
            "adminCourseView.curriculum.lesson.aiMentorConfiguration.additionalInstructions.label",
          )}
          placeholder={t(
            "adminCourseView.curriculum.lesson.aiMentorConfiguration.additionalInstructions.placeholder",
          )}
          richText
          optional
        />
      </div>
    </details>
  );
};
