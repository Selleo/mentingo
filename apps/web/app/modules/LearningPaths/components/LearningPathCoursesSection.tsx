import { Link } from "@remix-run/react";
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  GripVertical,
  Lock,
  PlayCircle,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { SortableList } from "~/components/SortableList/SortableList";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import MultipleSelector from "~/components/ui/multiselect";

import type {
  LearningPathCourseOption,
  LearningPathCoursePreview,
  SortableLearningPathCourse,
} from "./learningPaths.types";
import type { Option } from "~/components/ui/multiselect";

type LearningPathCoursesSectionProps = {
  availableCourseOptions: LearningPathCourseOption[];
  pathCourses: LearningPathCoursePreview[];
  isPending: boolean;
  canManage: boolean;
  canPlayCourses: boolean;
  showProgress?: boolean;
  onAddCourses: (courseIds: string[]) => Promise<void>;
  onReorderCourses: (courseIds: string[]) => Promise<void>;
  onRemoveCourse: (courseId: string) => Promise<void>;
};

const getCourseImage = (
  course?:
    | (Partial<Pick<LearningPathCourseOption, "imageUrl">> &
        Partial<Pick<LearningPathCoursePreview, "thumbnailUrl">>)
    | null,
) => course?.thumbnailUrl || course?.imageUrl || DefaultPhotoCourse;

const getNormalizedCourseOption = (courseOption: LearningPathCourseOption) => ({
  ...courseOption,
  imageUrl: courseOption.imageUrl ?? undefined,
});

const mapToSortableCourses = (courses: LearningPathCoursePreview[]) =>
  courses.map((course) => ({ ...course, sortableId: course.courseId }));

export function LearningPathCoursesSection({
  pathCourses,
  availableCourseOptions,
  isPending,
  canManage,
  canPlayCourses,
  showProgress = true,
  onAddCourses,
  onReorderCourses,
  onRemoveCourse,
}: LearningPathCoursesSectionProps) {
  const { t } = useTranslation();
  const normalizedCourseOptions = useMemo(
    () => availableCourseOptions.map(getNormalizedCourseOption),
    [availableCourseOptions],
  );

  const [selectedCourses, setSelectedCourses] = useState<Option[]>([]);
  const [isAddingCourses, setIsAddingCourses] = useState(false);
  const [sortableCourses, setSortableCourses] = useState<SortableLearningPathCourse[]>(() =>
    mapToSortableCourses(pathCourses),
  );

  useEffect(() => {
    setSortableCourses(mapToSortableCourses(pathCourses));
  }, [pathCourses]);

  const renderCourse = (course: SortableLearningPathCourse, index: number, sortable = false) => {
    const title = course.title || t("adminLearningPathsView.courses.unknownCourse");
    const isPlayable = canPlayCourses && !course.isLocked && course.progress !== "blocked";
    const courseState =
      course.isLocked || course.progress === "blocked" ? "locked" : course.progress;
    const courseStateConfig = match(courseState)
      .with("completed", () => ({
        badgeVariant: "success" as const,
        icon: <CheckCircle2 className="size-3.5" />,
        label: t("learningPathsView.courseState.completed"),
      }))
      .with("in_progress", () => ({
        badgeVariant: "inProgress" as const,
        icon: <Clock3 className="size-3.5" />,
        label: t("learningPathsView.courseState.inProgress"),
      }))
      .with("not_started", () => ({
        badgeVariant: "notStarted" as const,
        icon: <CircleDashed className="size-3.5" />,
        label: t("learningPathsView.courseState.notStarted"),
      }))
      .with("locked", () => ({
        badgeVariant: "blocked" as const,
        icon: <Lock className="size-3.5" />,
        label: t("learningPathsView.courseState.locked"),
      }))
      .exhaustive();

    const content = (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-9 shrink-0 text-right text-xs font-semibold text-primary-200">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="h-7 w-10 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
          <img
            src={getCourseImage(course)}
            alt={title}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = DefaultPhotoCourse;
            }}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5 text-neutral-900">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {!!course.courseChapterCount && (
              <p className="truncate text-xs leading-4 text-neutral-600">
                {t("adminLearningPathsView.courses.chapter", {
                  count: course.courseChapterCount,
                })}
              </p>
            )}
            {showProgress && (
              <Badge
                variant={courseStateConfig.badgeVariant}
                className="gap-1 px-1.5 py-0.5 text-xs"
              >
                {courseStateConfig.icon}
                {courseStateConfig.label}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <div className="flex items-center gap-2 py-1.5">
        {sortable && canManage && (
          <SortableList.DragHandle
            className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 active:cursor-grabbing"
            aria-label={t("adminLearningPathsView.courses.drag")}
          >
            <GripVertical className="size-4" />
          </SortableList.DragHandle>
        )}
        {canManage || !isPlayable ? (
          <div className="flex min-w-0 flex-1">{content}</div>
        ) : (
          <Link
            to={`/course/${course.courseId}`}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg hover:bg-neutral-50"
          >
            {content}
            <PlayCircle className="mr-2 size-4 shrink-0 text-primary-700" />
          </Link>
        )}
        {canManage && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => onRemoveCourse(course.courseId)}
            aria-label={t("adminLearningPathsView.courses.delete")}
          >
            <X className="size-4 text-neutral-500" />
          </Button>
        )}
      </div>
    );
  };

  const handleAddSelectedCourses = async () => {
    if (!selectedCourses.length) return;

    await onAddCourses(selectedCourses.map((course) => course.value));
    setSelectedCourses([]);
    setIsAddingCourses(false);
  };

  const handleReorderCourses = async (items: SortableLearningPathCourse[]) => {
    setSortableCourses(items);

    try {
      await onReorderCourses(items.map((course) => course.courseId));
    } catch {
      setSortableCourses(mapToSortableCourses(pathCourses));
    }
  };

  return (
    <div className="mt-7">
      {canManage ? (
        <SortableList
          items={sortableCourses}
          className="flex flex-col gap-2"
          onChange={(items) => {
            void handleReorderCourses(items as SortableLearningPathCourse[]);
          }}
          renderItem={(course, index) => (
            <SortableList.Item id={course.sortableId}>
              {renderCourse(course, index, true)}
            </SortableList.Item>
          )}
        />
      ) : (
        <ol className="flex flex-col">
          {pathCourses.map((course, index) => (
            <li key={course.id}>
              {renderCourse(
                {
                  ...course,
                  sortableId: course.courseId,
                },
                index,
              )}
            </li>
          ))}
        </ol>
      )}

      {!pathCourses.length && (
        <p className="py-4 text-sm text-neutral-500">
          {t("learningPathsView.detail.emptyCourses")}
        </p>
      )}

      {canManage && (
        <div className="mt-3">
          {isAddingCourses ? (
            <div className="flex w-full flex-col gap-2 md:flex-row md:items-end">
              <MultipleSelector
                value={selectedCourses}
                options={normalizedCourseOptions}
                onChange={setSelectedCourses}
                placeholder={t("adminLearningPathsView.courses.select")}
                className="min-h-10 flex-1"
                maxSelectedVisible={2}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={!selectedCourses.length || isPending}
                  onClick={handleAddSelectedCourses}
                >
                  {t("adminLearningPathsView.courses.add")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsAddingCourses(false)}>
                  {t("common.button.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="text-primary-700 w-full flex gap-2 items-center justify-start"
              disabled={!availableCourseOptions.length}
              onClick={() => setIsAddingCourses(true)}
            >
              <Plus className="size-4" />
              {t("adminLearningPathsView.courses.add")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
