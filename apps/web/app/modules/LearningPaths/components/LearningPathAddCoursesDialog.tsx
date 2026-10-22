import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import { LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES } from "../../../../e2e/data/learning-paths/handles";

import type { LearningPathCourseOption } from "./learningPaths.types";

type LearningPathAddCoursesDialogProps = {
  isOpen: boolean;
  courseOptions: LearningPathCourseOption[];
  isPending: boolean;
  onClose: () => void;
  onAddCourses: (courseIds: string[]) => Promise<void>;
};

export function LearningPathAddCoursesDialog({
  isOpen,
  courseOptions,
  isPending,
  onClose,
  onAddCourses,
}: LearningPathAddCoursesDialogProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  const filteredCourseOptions = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    if (!normalizedSearchQuery) return courseOptions;

    return courseOptions.filter((courseOption) =>
      courseOption.label.toLowerCase().includes(normalizedSearchQuery),
    );
  }, [courseOptions, searchQuery]);

  const resetAndClose = () => {
    setSearchQuery("");
    setSelectedCourseIds([]);
    onClose();
  };

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds((currentCourseIds) =>
      currentCourseIds.includes(courseId)
        ? currentCourseIds.filter((currentCourseId) => currentCourseId !== courseId)
        : [...currentCourseIds, courseId],
    );
  };

  const addSelectedCourses = async () => {
    if (!selectedCourseIds.length) return;

    await onAddCourses(selectedCourseIds);
    resetAndClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isDialogOpen) => {
        if (!isDialogOpen && !isPending) resetAndClose();
      }}
    >
      <DialogContent
        data-testid={LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES.DIALOG}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-5 rounded-2xl p-6 sm:rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-neutral-950">
            {t("adminLearningPathsView.courses.addDialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("adminLearningPathsView.courses.addDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("adminLearningPathsView.courses.searchPlaceholder")}
            data-testid={LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES.SEARCH_INPUT}
            className="pl-9"
          />
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {filteredCourseOptions.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourseOptions.map((courseOption) => {
                const isSelected = selectedCourseIds.includes(courseOption.value);

                return (
                  <li key={courseOption.value}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      data-testid={LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES.option(
                        courseOption.value,
                      )}
                      onClick={() => toggleCourseSelection(courseOption.value)}
                      className={cn(
                        "group flex w-full flex-col gap-2 rounded-xl p-2 text-left ring-2 transition",
                        isSelected
                          ? "bg-primary-50 ring-primary-600"
                          : "ring-transparent hover:bg-neutral-50 hover:ring-neutral-200",
                      )}
                    >
                      <span className="relative block aspect-video overflow-hidden rounded-lg bg-neutral-100">
                        <img
                          src={courseOption.imageUrl || DefaultPhotoCourse}
                          alt=""
                          className="size-full object-cover"
                          onError={(event) => {
                            event.currentTarget.src = DefaultPhotoCourse;
                          }}
                        />
                        <span
                          className={cn(
                            "absolute right-2 top-2 grid size-6 place-items-center rounded-full border-2 transition",
                            isSelected
                              ? "border-primary-600 bg-primary-600 text-white"
                              : "border-white bg-white/80 text-transparent",
                          )}
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                      </span>
                      <span className="line-clamp-2 px-1 text-sm font-semibold leading-5 text-neutral-950">
                        {courseOption.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-neutral-500">
              {t(
                courseOptions.length
                  ? "adminLearningPathsView.courses.noSearchResults"
                  : "adminLearningPathsView.courses.noAvailableCourses",
              )}
            </p>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between sm:space-x-0">
          <span className="text-sm text-neutral-600">
            {t("adminLearningPathsView.courses.selectedCount", {
              count: selectedCourseIds.length,
            })}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={resetAndClose}>
              {t("common.button.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!selectedCourseIds.length || isPending}
              onClick={() => void addSelectedCourses()}
              data-testid={LEARNING_PATH_ADD_COURSES_DIALOG_HANDLES.SUBMIT_BUTTON}
            >
              {t("adminLearningPathsView.courses.addSelected", {
                count: selectedCourseIds.length,
              })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
