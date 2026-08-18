import { AI_MENTOR_TYPE } from "@repo/shared";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { InlineTextDiff } from "~/components/InlineTextDiff/InlineTextDiff";

import type {
  AiMentorGeneratedDraft,
  AiMentorGenerationChange,
  AiMentorQualityFinding,
} from "./aiMentorGeneration.types";

const FIELD_LABEL_KEYS: Record<string, string> = {
  additionalInstructions:
    "adminCourseView.curriculum.lesson.aiMentorConfiguration.additionalInstructions.label",
  aiRole: "adminCourseView.curriculum.lesson.aiMentorConfiguration.aiRole.label",
  characterGoal: "adminCourseView.curriculum.lesson.aiMentorConfiguration.characterGoal.label",
  contentScope: "adminCourseView.curriculum.lesson.aiMentorConfiguration.contentScope.label",
  difficulty: "adminCourseView.curriculum.lesson.aiMentorConfiguration.difficulty.label",
  expertise: "adminCourseView.curriculum.lesson.aiMentorConfiguration.expertise.label",
  factsAndConstraints:
    "adminCourseView.curriculum.lesson.aiMentorConfiguration.factsAndConstraints.label",
  feedbackGuidance:
    "adminCourseView.curriculum.lesson.aiMentorConfiguration.feedbackGuidance.label",
  learnerRole: "adminCourseView.curriculum.lesson.aiMentorConfiguration.learnerRole.label",
  openingInstruction:
    "adminCourseView.curriculum.lesson.aiMentorConfiguration.openingInstruction.label",
  scenario: "adminCourseView.curriculum.lesson.aiMentorConfiguration.scenario.label",
  taskGoal: "adminCourseView.curriculum.lesson.aiMentorConfiguration.taskGoal.label",
  teachingStyle: "adminCourseView.curriculum.lesson.aiMentorConfiguration.teachingStyle.label",
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatReferenceLabel = (reference: string, label: string) => {
  if (label.startsWith("AI ") || reference[0] === reference[0]?.toUpperCase()) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
};

const formatFieldName = (field: string, t: (key: string) => string) => {
  const translationKey = FIELD_LABEL_KEYS[field];
  if (translationKey) return t(translationKey);

  const words = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();
  const label = words.charAt(0).toUpperCase() + words.slice(1);
  return label.replace(/^Ai\b/, "AI");
};

export const humanizeAiMentorFieldReferences = (text: string, t: (key: string) => string) =>
  Object.entries(FIELD_LABEL_KEYS).reduce((result, [field, translationKey]) => {
    const label = t(translationKey);
    return result
      .replace(new RegExp(`\\b${field}\\b`, "g"), (reference) =>
        formatReferenceLabel(reference, label),
      )
      .replace(
        new RegExp(`\\b${escapeRegExp(field.replace(/([a-z])([A-Z])/g, "$1 $2"))}\\b`, "gi"),
        (reference) => formatReferenceLabel(reference, label),
      );
  }, text);

export const AiMentorGenerationDraftSummary = ({ draft }: { draft: AiMentorGeneratedDraft }) => {
  const { t } = useTranslation();
  const detail =
    draft.type === AI_MENTOR_TYPE.TEACHER
      ? draft.expertise || draft.taskGoal
      : draft.aiRole || draft.scenario;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="font-semibold text-neutral-950">
        {t(`adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.${draft.type}.label`)}
      </p>
      {detail && <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{detail}</p>}
    </div>
  );
};

export const AiMentorGenerationFindingList = ({
  findings,
}: {
  findings: AiMentorQualityFinding[];
}) => {
  const { t } = useTranslation();

  if (findings.length === 0) return null;

  return (
    <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
      {findings.map((finding, index) => (
        <li
          key={`${finding.code}-${finding.field ?? "configuration"}-${index}`}
          className="px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium text-neutral-900">
              {humanizeAiMentorFieldReferences(finding.message, t)}
            </p>
            {finding.field && (
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-neutral-600">
                {formatFieldName(finding.field, t)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-5 text-neutral-600">
            {humanizeAiMentorFieldReferences(finding.correction, t)}
          </p>
        </li>
      ))}
    </ul>
  );
};

export const AiMentorGenerationChangeDisclosure = ({
  changes,
}: {
  changes: AiMentorGenerationChange[];
}) => {
  const { t } = useTranslation();
  const visibleChanges = changes.filter(
    ({ before, after }) => before !== after && (before != null || after != null),
  );

  if (visibleChanges.length === 0) return null;

  return (
    <details className="group rounded-lg border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-neutral-900 group-open:rounded-b-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.reviewExactChanges", {
            count: visibleChanges.length,
          })}
        </span>
        <ChevronDown
          className="size-4 text-neutral-500 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="divide-y border-t border-neutral-200 px-4">
        {visibleChanges.map((change, index) => (
          <section key={`${change.field}-${index}`} className="py-3">
            <p className="mb-2 text-sm font-semibold text-neutral-900">
              {formatFieldName(change.field, t)}
            </p>
            <InlineTextDiff before={change.before ?? ""} after={change.after ?? ""} />
          </section>
        ))}
      </div>
    </details>
  );
};
