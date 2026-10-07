import { useTranslation } from "react-i18next";

import { ContentViewer } from "~/components/RichText/Viever";
import { Badge } from "~/components/ui/badge";

import { AuthoringContentPreview } from "../review/AuthoringContentPreview";

import type { AuthoringOperation } from "../courseAuthoring.types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const questionTypeTranslationKeys: Record<string, string> = {
  single_choice: "adminCourseView.curriculum.lesson.other.singleChoice",
  multiple_choice: "adminCourseView.curriculum.lesson.other.multipleChoice",
  true_or_false: "adminCourseView.curriculum.lesson.other.trueOrFalse",
  photo_question_single_choice: "courseAuthoring.editors.photoSingleChoice",
  photo_question_multiple_choice: "courseAuthoring.editors.photoMultipleChoice",
  fill_in_the_blanks_text: "adminCourseView.curriculum.lesson.other.fillInTheBlanksText",
  fill_in_the_blanks_dnd: "adminCourseView.curriculum.lesson.other.fillInTheBlanks",
  brief_response: "adminCourseView.curriculum.lesson.other.briefResponse",
  detailed_response: "adminCourseView.curriculum.lesson.other.detailedResponse",
  scale_1_5: "adminCourseView.curriculum.lesson.other.scale_1_5",
};

const translateQuestionType = (t: (key: string) => string, value: unknown) =>
  typeof value === "string"
    ? t(questionTypeTranslationKeys[value] ?? "courseAuthoring.review.question")
    : t("courseAuthoring.review.question");

type Props = {
  operation: AuthoringOperation;
  lessonType?: string;
  compact?: boolean;
  assetPreviewUrls?: Readonly<Record<string, string>>;
};

/** Reuses the review renderer for safe operation-backed lesson inspection. */
export const AuthoringOperationPreview = ({
  operation,
  lessonType: lessonTypeOverride,
  compact = true,
  assetPreviewUrls = {},
}: Props) => {
  const { t } = useTranslation();
  const payload = operation.payload;
  const lessonType =
    typeof payload.lessonType === "string" ? payload.lessonType : (lessonTypeOverride ?? null);

  let html: string | null = null;
  if (typeof payload.html === "string") {
    html = payload.html;
  } else if (lessonType === "content" && typeof payload.description === "string") {
    html = payload.description;
  }

  if (html) {
    return (
      <AuthoringContentPreview
        assetPreviewUrls={assetPreviewUrls}
        content={html}
        className={compact ? "mt-2 max-h-72 overflow-y-auto text-sm" : "mt-4 text-sm"}
      />
    );
  }

  if (lessonType === "quiz" && Array.isArray(payload.questions)) {
    return (
      <div className={compact ? "mt-2 space-y-2" : "mt-4 space-y-3"}>
        <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
          <span>
            {t("courseAuthoring.review.questions", {
              count: payload.questions.length,
              defaultValue: "{{count}} questions",
            })}
          </span>
          {typeof payload.thresholdScore === "number" && (
            <span>
              ·{" "}
              {t("courseAuthoring.review.passScore", {
                score: payload.thresholdScore,
                defaultValue: "{{score}}% pass score",
              })}
            </span>
          )}
          <span>
            ·{" "}
            {typeof payload.attemptsLimit === "number"
              ? t("courseAuthoring.review.attempts", {
                  count: payload.attemptsLimit,
                  defaultValue: "{{count}} attempts",
                })
              : t("courseAuthoring.review.unlimitedAttempts", {
                  defaultValue: "Unlimited attempts",
                })}
          </span>
          {typeof payload.quizCooldownInHours === "number" && (
            <span>
              ·{" "}
              {t("courseAuthoring.editors.cooldownHours", {
                count: payload.quizCooldownInHours,
                defaultValue: "Cooldown: {{count}} hours",
              })}
            </span>
          )}
        </div>
        {payload.questions.map((question, index) => {
          if (!isObject(question)) return null;
          const prompt = stringValue(question.prompt) ?? stringValue(question.description);
          const options = Array.isArray(question.options) ? question.options.filter(isObject) : [];
          return (
            <div
              key={typeof question.id === "string" ? question.id : index}
              className="rounded-md bg-neutral-50 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {typeof question.title === "string"
                    ? question.title
                    : t("courseAuthoring.review.questionNumber", { number: index + 1 })}
                </span>
                <Badge variant="notStarted" className="text-[10px]">
                  {translateQuestionType(t, question.questionType ?? question.type)}
                </Badge>
              </div>
              {prompt && (
                <ContentViewer content={prompt} className="mt-1 text-xs text-neutral-700" />
              )}
              {options.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                  {options.map((option, optionIndex) => {
                    const optionText = stringValue(option.optionText) ?? stringValue(option.text);
                    if (!optionText) return null;
                    return (
                      <li
                        key={typeof option.id === "string" ? option.id : optionIndex}
                        className="flex items-start gap-2"
                      >
                        <span aria-hidden="true">{option.isCorrect === true ? "✓" : "○"}</span>
                        <span>{optionText}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (lessonType === "ai_mentor") {
    const configuration = isObject(payload.configuration) ? payload.configuration : null;
    const judge = isObject(payload.judgeConfiguration) ? payload.judgeConfiguration : null;
    return (
      <div
        className={compact ? "mt-2 grid gap-2 sm:grid-cols-2" : "mt-4 grid gap-3 sm:grid-cols-2"}
      >
        {typeof payload.name === "string" && (
          <div className="rounded-md bg-neutral-50 p-2 text-xs">
            <span className="block text-neutral-500">{t("courseAuthoring.review.mentor")}</span>
            <span className="font-medium">{payload.name}</span>
          </div>
        )}
        {typeof payload.configurationType === "string" && (
          <div className="rounded-md bg-neutral-50 p-2 text-xs">
            <span className="block text-neutral-500">{t("courseAuthoring.review.mode")}</span>
            <span className="font-medium">{payload.configurationType}</span>
          </div>
        )}
        {configuration && typeof configuration.taskGoal === "string" && (
          <div className="rounded-md bg-neutral-50 p-2 text-xs">
            <span className="block text-neutral-500">{t("courseAuthoring.review.task")}</span>
            <span className="font-medium">{configuration.taskGoal}</span>
          </div>
        )}
        {configuration && typeof configuration.scenario === "string" && (
          <div className="rounded-md bg-neutral-50 p-2 text-xs">
            <span className="block text-neutral-500">
              {t("courseAuthoring.editors.scenario", { defaultValue: "Scenario" })}
            </span>
            <span className="font-medium">{configuration.scenario}</span>
          </div>
        )}
        {judge && (
          <div className="rounded-md bg-neutral-50 p-2 text-xs">
            <span className="block text-neutral-500">{t("courseAuthoring.review.assessment")}</span>
            <span className="font-medium">
              {t("courseAuthoring.review.criteria", {
                count: Array.isArray(judge.criteria) ? judge.criteria.length : 0,
              })}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
};
