import { GripVertical, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { SortableList } from "~/components/SortableList/SortableList";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { LearningPathEditorCourse, LearningPathEditorCourseOption } from "../types";

type LearningPathEditorCoursesSectionProps = {
  isCreateMode: boolean;
  canUpdateCourses: boolean;
  isCourseMutationPending: boolean;
  pathCourses: LearningPathEditorCourse[];
  availableCourseOptions: LearningPathEditorCourseOption[];
  onAddCourse: (courseId: string) => Promise<void>;
  onReorderCourses: (courseIds: string[]) => Promise<void>;
  onRemoveCourse: (courseId: string) => Promise<void>;
};

type SortableLearningPathCourse = LearningPathEditorCourse & {
  sortableId: string;
};

const mapToSortableCourses = (courses: LearningPathEditorCourse[]): SortableLearningPathCourse[] =>
  courses.map((course) => ({ ...course, sortableId: course.courseId }));

export function LearningPathEditorCoursesSection({
  isCreateMode,
  canUpdateCourses,
  isCourseMutationPending,
  pathCourses,
  availableCourseOptions,
  onAddCourse,
  onReorderCourses,
  onRemoveCourse,
}: LearningPathEditorCoursesSectionProps) {
  const { t } = useTranslation();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [sortableCourses, setSortableCourses] = useState<SortableLearningPathCourse[]>(() =>
    mapToSortableCourses(pathCourses),
  );

  useEffect(() => {
    setSortableCourses(mapToSortableCourses(pathCourses));
  }, [pathCourses]);

  const handleAddCourse = async () => {
    if (!selectedCourseId) return;

    await onAddCourse(selectedCourseId);
    setSelectedCourseId("");
  };

  const handleReorderCourses = async (items: SortableLearningPathCourse[]) => {
    const previousCourses = sortableCourses;
    setSortableCourses(items);

    try {
      await onReorderCourses(items.map((course) => course.courseId));
    } catch {
      setSortableCourses(previousCourses);
    }
  };

  return (
    <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-semibold text-neutral-950">
        {t("adminLearningPathsView.editor.courses")}
      </h2>
      <div className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select
            value={selectedCourseId}
            onValueChange={setSelectedCourseId}
            disabled={isCreateMode || !canUpdateCourses || !availableCourseOptions.length}
          >
            <SelectTrigger className="md:max-w-xl">
              <SelectValue
                placeholder={
                  isCreateMode
                    ? t("adminLearningPathsView.courses.saveFirst")
                    : t("adminLearningPathsView.courses.select")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableCourseOptions.map((course) => (
                <SelectItem key={course.value} value={course.value}>
                  {course.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={
              isCreateMode || !canUpdateCourses || !selectedCourseId || isCourseMutationPending
            }
            onClick={handleAddCourse}
          >
            <Plus className="size-4" />
            {t("adminLearningPathsView.courses.add")}
          </Button>
        </div>

        <SortableList
          items={sortableCourses}
          className="flex flex-col gap-2"
          onChange={(items) => {
            void handleReorderCourses(items as SortableLearningPathCourse[]);
          }}
          renderItem={(course) => {
            const courseImageUrl = course.thumbnailUrl || DefaultPhotoCourse;

            return (
              <SortableList.Item id={course.sortableId}>
                <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  {canUpdateCourses && (
                    <SortableList.DragHandle
                      className="inline-flex size-10 shrink-0 cursor-grab items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-950 active:cursor-grabbing"
                      aria-label={t("adminLearningPathsView.courses.drag")}
                    >
                      <GripVertical className="size-4" />
                    </SortableList.DragHandle>
                  )}

                  <div className="aspect-video h-12 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <img
                      src={courseImageUrl}
                      alt={course.title ?? t("adminLearningPathsView.courses.course")}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = DefaultPhotoCourse;
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="body-sm-md truncate text-neutral-950">
                      {course.title ?? t("adminLearningPathsView.courses.unknownCourse")}
                    </p>
                  </div>

                  {canUpdateCourses && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={isCourseMutationPending}
                      onClick={() => onRemoveCourse(course.courseId)}
                      aria-label={t("adminLearningPathsView.courses.delete")}
                    >
                      <X className="size-4 text-error-600" />
                    </Button>
                  )}
                </div>
              </SortableList.Item>
            );
          }}
        />

        {!pathCourses.length && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-neutral-600">
            {isCreateMode
              ? t("adminLearningPathsView.courses.saveFirst")
              : t("adminLearningPathsView.courses.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
