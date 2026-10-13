import { AI_MENTOR_TYPE } from "@repo/shared";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { ConfigurationTextField } from "./fields/AiMentorConfigurationFieldInputs";

import type { AiMentorType } from "@repo/shared";

type AiMentorFineTuneConfigurationFieldsProps = {
  type: AiMentorType;
  hasOptionalError: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AiMentorFineTuneConfigurationFields = ({
  type,
  hasOptionalError,
  isOpen,
  onOpenChange,
}: AiMentorFineTuneConfigurationFieldsProps) => {
  const { t } = useTranslation();
  const contentId = useId();
  const triggerId = `${contentId}-trigger`;

  return (
    <div
      className={cn("rounded-lg border bg-white", {
        "border-error-500": hasOptionalError,
        "border-neutral-200": !hasOptionalError,
      })}
    >
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => onOpenChange(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span className="flex items-center gap-3">
          <SlidersHorizontal className="size-4 text-neutral-500" />
          <span className="text-sm font-semibold text-neutral-900">
            {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.fineTuneBehavior")}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 text-neutral-500 transition-transform", {
            "rotate-180": isOpen,
          })}
        />
      </button>
      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!isOpen}
        className="space-y-4 border-t border-neutral-100 px-4 py-4"
      >
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
    </div>
  );
};
