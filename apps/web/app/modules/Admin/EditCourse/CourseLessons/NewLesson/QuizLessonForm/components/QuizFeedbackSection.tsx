import { ASSESSMENT_FEEDBACK_MODES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { BaseEditor } from "~/components/RichText/Editor";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { defaultQuizFeedbackRanges } from "../defaults/defaultQuizLessonValues";
import { appendFeedbackRange } from "../utils/feedbackRanges";

import { InfoTooltip } from "./InfoTooltip";

import type { QuizFeedbackRange } from "../QuizLessonForm.types";
import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { AssessmentFeedbackMode } from "@repo/shared";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<QuizLessonFormValues>;
  isStructureLocked: boolean;
  readOnly: boolean;
};

type RangeRowProps = {
  range: QuizFeedbackRange;
  rangeIndex: number;
  isStructureLocked: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<QuizFeedbackRange>) => void;
  onRemove: () => void;
};

const FEEDBACK_MODE_LABELS: Record<AssessmentFeedbackMode, string> = {
  [ASSESSMENT_FEEDBACK_MODES.FULL]: "adminCourseView.curriculum.lesson.settings.feedbackModeFull",
  [ASSESSMENT_FEEDBACK_MODES.SCORE_ONLY]:
    "adminCourseView.curriculum.lesson.settings.feedbackModeScoreOnly",
  [ASSESSMENT_FEEDBACK_MODES.NONE]: "adminCourseView.curriculum.lesson.settings.feedbackModeNone",
};

const parsePercent = (value: string): number => {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? 0 : parsed;
};

const FeedbackRangeRow = ({
  range,
  rangeIndex,
  isStructureLocked,
  readOnly,
  onChange,
  onRemove,
}: RangeRowProps) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-neutral-700">
            {t("adminCourseView.curriculum.lesson.settings.feedbackRangeMin")}
          </Label>
          <Input
            data-testid={QUIZ_LESSON_FORM_HANDLES.feedbackRangeMinInput(rangeIndex)}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            disabled={isStructureLocked}
            value={range.minPercent}
            onChange={(event) => onChange({ minPercent: parsePercent(event.target.value) })}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-neutral-700">
            {t("adminCourseView.curriculum.lesson.settings.feedbackRangeMax")}
          </Label>
          <Input
            data-testid={QUIZ_LESSON_FORM_HANDLES.feedbackRangeMaxInput(rangeIndex)}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            disabled={isStructureLocked}
            value={range.maxPercent}
            onChange={(event) => onChange({ maxPercent: parsePercent(event.target.value) })}
            className="w-24"
          />
        </div>
        {!isStructureLocked && (
          <Button
            type="button"
            data-testid={QUIZ_LESSON_FORM_HANDLES.feedbackRangeRemoveButton(rangeIndex)}
            onClick={onRemove}
            className="bg-color-white ml-auto border border-neutral-300 text-error-700"
          >
            <Icon name="TrashIcon" className="size-4" />
          </Button>
        )}
      </div>
      <div className="mt-3">
        <Label className="text-xs text-neutral-700">
          {t("adminCourseView.curriculum.lesson.settings.feedbackRangeMessage")}
        </Label>
        <BaseEditor
          id={`feedbackRangeMessage-${rangeIndex}`}
          content={range.message}
          editable={!readOnly}
          onChange={(value) => onChange({ message: value })}
          compactToolbar
          parentClassName="flex h-[8lh] flex-col"
          contentClassName="min-h-0 flex-1 overflow-y-auto"
          editorClassName="min-h-0"
        />
      </div>
    </div>
  );
};

const QuizFeedbackSection = ({ form, isStructureLocked, readOnly }: Props) => {
  const { t } = useTranslation();

  const feedbackRanges = form.watch("feedbackRanges") ?? [];
  const rangesError =
    form.formState.errors.feedbackRanges?.message ??
    form.formState.errors.feedbackRanges?.root?.message;

  const setRanges = (next: QuizFeedbackRange[]) => {
    form.setValue("feedbackRanges", next, { shouldDirty: true, shouldValidate: true });
  };

  const updateRange = (rangeIndex: number, patch: Partial<QuizFeedbackRange>) => {
    setRanges(
      feedbackRanges.map((range, index) => (index === rangeIndex ? { ...range, ...patch } : range)),
    );
  };

  const rangesWithAddedRange = appendFeedbackRange(feedbackRanges);

  const removeRange = (rangeIndex: number) => {
    setRanges(feedbackRanges.filter((_, index) => index !== rangeIndex));
  };

  return (
    <div className="mx-l max-w-2xl px-4 pt-4">
      <FormField
        control={form.control}
        name="feedbackMode"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-x-2">
              <Label htmlFor="feedbackMode" className="body-base-md text-sm">
                {t("adminCourseView.curriculum.lesson.settings.feedbackMode")}
              </Label>
              <InfoTooltip
                message={t("adminCourseView.curriculum.lesson.tooltip.feedbackMode")}
                iconClassName="text-sm"
              />
            </div>
            <Select value={field.value} onValueChange={field.onChange} disabled={isStructureLocked}>
              <FormControl>
                <SelectTrigger
                  id="feedbackMode"
                  data-testid={QUIZ_LESSON_FORM_HANDLES.FEEDBACK_MODE_SELECT}
                  className="w-full max-w-md"
                >
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.values(ASSESSMENT_FEEDBACK_MODES).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {t(FEEDBACK_MODE_LABELS[mode])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-x-2">
          <Label className="body-base-md text-sm">
            {t("adminCourseView.curriculum.lesson.settings.feedbackRanges")}
          </Label>
          <InfoTooltip
            message={t("adminCourseView.curriculum.lesson.tooltip.feedbackRanges")}
            iconClassName="text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("adminCourseView.curriculum.lesson.settings.feedbackVariablesHint", {
            firstNameVar: "{{firstName}}",
            scoreVar: "{{score}}",
          })}
        </p>

        {feedbackRanges.map((range, rangeIndex) => (
          <FeedbackRangeRow
            key={range.id ?? rangeIndex}
            range={range}
            rangeIndex={rangeIndex}
            isStructureLocked={isStructureLocked}
            readOnly={readOnly}
            onChange={(patch) => updateRange(rangeIndex, patch)}
            onRemove={() => removeRange(rangeIndex)}
          />
        ))}

        {rangesError && <p className="text-sm text-error-700">{rangesError}</p>}

        {!isStructureLocked && (
          <div className="flex gap-3">
            <Button
              type="button"
              data-testid={QUIZ_LESSON_FORM_HANDLES.FEEDBACK_ADD_RANGE_BUTTON}
              disabled={!rangesWithAddedRange}
              onClick={() => rangesWithAddedRange && setRanges(rangesWithAddedRange)}
              className="bg-color-white border border-neutral-300"
            >
              {t("adminCourseView.curriculum.lesson.settings.feedbackRangeAdd")}
            </Button>
            {feedbackRanges.length === 0 && (
              <Button
                type="button"
                onClick={() => setRanges(defaultQuizFeedbackRanges)}
                className="bg-color-white border border-neutral-300"
              >
                {t("adminCourseView.curriculum.lesson.settings.feedbackRangeReset")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizFeedbackSection;
