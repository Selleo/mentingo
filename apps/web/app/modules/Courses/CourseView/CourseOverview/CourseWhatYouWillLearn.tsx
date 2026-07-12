import { Check, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { cn } from "~/lib/utils";

import { useCourseAccessProvider } from "../../context/CourseAccessProvider";

import type { SupportedLanguages } from "@repo/shared";

type CourseWhatYouWillLearnProps = {
  courseOutcomes?: string[];
  language: SupportedLanguages;
};

const normalizeOutcomes = (outcomes: string[]) =>
  outcomes.map((outcome) => outcome.trim()).filter(Boolean);

const areOutcomesEqual = (first: string[], second: string[]) =>
  first.length === second.length && first.every((outcome, index) => outcome === second[index]);

export default function CourseWhatYouWillLearn({
  courseOutcomes = [],
  language,
}: CourseWhatYouWillLearnProps) {
  const { t } = useTranslation();
  const { course, isAdminExperience } = useCourseAccessProvider();
  const { mutateAsync: updateCourse, isPending } = useUpdateCourse();

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [outcomesDraft, setOutcomesDraft] = useState(courseOutcomes);
  const [editingOutcomeIndex, setEditingOutcomeIndex] = useState<number | null>(null);

  useEffect(() => {
    setOutcomesDraft(courseOutcomes);
  }, [courseOutcomes]);

  useEffect(() => {
    if (editingOutcomeIndex === null) return;

    inputRefs.current[editingOutcomeIndex]?.focus();
  }, [editingOutcomeIndex]);

  if (!isAdminExperience && courseOutcomes.length === 0) {
    return null;
  }

  const saveOutcomes = async (nextOutcomes = outcomesDraft) => {
    const normalizedOutcomes = normalizeOutcomes(nextOutcomes);
    const normalizedCourseOutcomes = normalizeOutcomes(courseOutcomes);

    setOutcomesDraft(normalizedOutcomes);
    setEditingOutcomeIndex(null);

    if (areOutcomesEqual(normalizedOutcomes, normalizedCourseOutcomes)) {
      return;
    }

    await updateCourse({
      courseId: course.id,
      data: {
        language,
        learningOutcomes: normalizedOutcomes,
      },
    });
  };

  const addOutcome = () => {
    setOutcomesDraft((currentOutcomes) => {
      const nextOutcomes = [...currentOutcomes, ""];
      setEditingOutcomeIndex(nextOutcomes.length - 1);

      return nextOutcomes;
    });
  };

  const updateOutcome = (index: number, value: string) => {
    setOutcomesDraft((currentOutcomes) =>
      currentOutcomes.map((outcome, outcomeIndex) => (outcomeIndex === index ? value : outcome)),
    );
  };

  const saveOutcome = (index: number, value: string) => {
    const nextOutcomes = outcomesDraft.map((outcome, outcomeIndex) =>
      outcomeIndex === index ? value : outcome,
    );

    setOutcomesDraft(nextOutcomes);
    void saveOutcomes(nextOutcomes);
  };

  const removeOutcome = (index: number) => {
    const nextOutcomes = outcomesDraft.filter((_, outcomeIndex) => outcomeIndex !== index);

    setOutcomesDraft(nextOutcomes);
    void saveOutcomes(nextOutcomes);
  };

  return (
    <aside className="absolute bottom-8 right-8 z-10 hidden w-[30%] max-w-[520px] rounded-2xl bg-black/15 p-4 backdrop-blur-[2px] lg:block">
      <h3 className="mb-4 flex items-center gap-3 font-gothic text-2xl font-bold text-white">
        <span className="flex items-center justify-center rounded-full text-success-500">
          <CheckCircle2 className="size-8" />
        </span>
        {t("modernCourseView.overview.whatYouWillLearn")}
        {isAdminExperience && (
          <button
            type="button"
            onClick={addOutcome}
            disabled={isPending}
            aria-label={t("modernCourseView.overview.addLearningOutcome")}
            className="ml-auto rounded-lg p-1 transition-all hover:bg-white/20 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 text-white" />
          </button>
        )}
      </h3>

      <div className="space-y-1.5">
        {outcomesDraft.length === 0 && (
          <p className="text-base font-medium leading-relaxed text-neutral-200">
            {t("modernCourseView.overview.noLearningOutcomes")}
          </p>
        )}

        {outcomesDraft.map((outcome, index) => (
          <div key={index} className="group/outcome flex items-start gap-3">
            <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>

            {editingOutcomeIndex === index ? (
              <input
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                value={outcome}
                onChange={(event) => updateOutcome(index, event.target.value)}
                onBlur={(event) => saveOutcome(index, event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveOutcome(index, event.currentTarget.value);
                  }
                }}
                disabled={isPending}
                className="flex-1 rounded-lg border-2 border-primary-700 bg-white/95 px-3 py-2 text-base font-medium text-neutral-950 outline-none disabled:opacity-50"
                placeholder={t("modernCourseView.overview.learningOutcomePlaceholder")}
              />
            ) : (
              <button
                type="button"
                disabled={!isAdminExperience || isPending}
                onClick={() => {
                  if (isAdminExperience) {
                    setEditingOutcomeIndex(index);
                  }
                }}
                className={cn(
                  "min-h-7 flex-1 rounded-lg border-2 border-dashed border-transparent px-2 py-0.5 text-left text-base font-medium leading-6 text-white transition-all",
                  {
                    "cursor-pointer group-hover/outcome:border-white  group-hover/outcome:bg-opacity-10 hover:border-white  hover:bg-opacity-10 hover:text-white focus-visible:border-white focus-visible:bg-white focus-visible:bg-opacity-10 focus-visible:outline-none":
                      isAdminExperience,
                    "cursor-default disabled:opacity-100": !isAdminExperience,
                  },
                )}
              >
                {outcome}
              </button>
            )}

            {isAdminExperience && editingOutcomeIndex !== index && (
              <button
                type="button"
                onClick={() => removeOutcome(index)}
                disabled={isPending}
                aria-label={t("modernCourseView.overview.removeLearningOutcome")}
                className="rounded p-1 opacity-0 transition-all hover:bg-white/20 group-hover/outcome:opacity-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 text-white" />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
