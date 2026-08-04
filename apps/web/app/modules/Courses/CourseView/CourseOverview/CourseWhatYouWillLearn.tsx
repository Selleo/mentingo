import { MAX_COURSE_LEARNING_OUTCOMES, type SupportedLanguages } from "@repo/shared";
import { Check, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { cn } from "~/lib/utils";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";
import { useCourseAccessProvider } from "../../context/CourseAccessProvider";

type CourseWhatYouWillLearnProps = {
  courseOutcomes?: string[];
  language: SupportedLanguages;
};

const limitOutcomes = (outcomes: string[]) => outcomes.slice(0, MAX_COURSE_LEARNING_OUTCOMES);

const normalizeOutcomes = (outcomes: string[]) =>
  limitOutcomes(outcomes.map((outcome) => outcome.trim()).filter(Boolean));

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
  const [outcomesDraft, setOutcomesDraft] = useState(limitOutcomes(courseOutcomes));
  const [editingOutcomeIndex, setEditingOutcomeIndex] = useState<number | null>(null);

  useEffect(() => {
    setOutcomesDraft(limitOutcomes(courseOutcomes));
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
      if (currentOutcomes.length >= MAX_COURSE_LEARNING_OUTCOMES) {
        return currentOutcomes;
      }

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
    <aside
      data-testid={COURSE_OVERVIEW_HANDLES.LEARNING_OUTCOMES}
      className="absolute bottom-8 right-8 z-10 hidden w-[34%] max-w-[600px] rounded-2xl bg-black/15 p-4 backdrop-blur-[2px] lg:block"
    >
      <h3 className="mb-4 flex items-center gap-3 font-gothic text-xl font-bold text-white xl:text-2xl">
        <span className="flex items-center justify-center rounded-full text-success-500">
          <CheckCircle2 className="size-8" />
        </span>
        <span className="min-w-0 flex-1 whitespace-nowrap">
          {t("modernCourseView.overview.whatYouWillMaster")}
        </span>
        {isAdminExperience && (
          <>
            <span className="text-lg font-medium text-white/80">
              {outcomesDraft.length}/{MAX_COURSE_LEARNING_OUTCOMES}
            </span>
            <button
              type="button"
              onClick={addOutcome}
              disabled={isPending || outcomesDraft.length >= MAX_COURSE_LEARNING_OUTCOMES}
              aria-label={t("modernCourseView.overview.addLearningOutcome")}
              className="rounded-lg border border-white/30 bg-white/15 p-1.5 shadow-sm transition-all hover:bg-white/25 disabled:opacity-50"
            >
              <Plus className="size-4 text-white" />
            </button>
          </>
        )}
      </h3>

      <div className="space-y-1.5">
        {outcomesDraft.length === 0 && (
          <p className="text-base font-medium leading-relaxed text-neutral-200">
            {t("modernCourseView.overview.noLearningOutcomes")}
          </p>
        )}

        {outcomesDraft.map((outcome, index) => (
          <div
            key={index}
            className={cn("group/outcome flex gap-3", {
              "items-center": editingOutcomeIndex === index,
              "items-start": editingOutcomeIndex !== index,
            })}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full bg-success-500 text-white",
                {
                  "mt-1": editingOutcomeIndex !== index,
                },
              )}
            >
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
                className="flex-1 rounded-lg border-2 border-white bg-transparent px-3 py-2 text-base font-medium text-white outline-none backdrop-blur-lg disabled:opacity-50"
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
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  removeOutcome(index);
                }}
                disabled={isPending}
                aria-label={t("modernCourseView.overview.removeLearningOutcome")}
                className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center self-center rounded bg-white/10 p-1 text-white opacity-0 hover:bg-white/30 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 group-hover/outcome:bg-white/20 group-hover/outcome:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
