import { COURSE_STATUSES } from "@repo/shared";
import { Check, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useInfiniteCourses } from "~/api/queries/useInfiniteCourses";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useDebounce } from "~/hooks/useDebounce";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSES_INLINE_EDIT_HANDLES } from "../../../../../../e2e/data/courses/handles";
import ModernCourseCard from "../ModernCourseCard";

import { MEDIA_ITEM_ATTRIBUTE, useViewportMediaStates } from "./useViewportMediaStates";

import type { ReactNode } from "react";

// Start loading the next page about one picker height before the list runs out.
const LOAD_MORE_ROOT_MARGIN = "0px 0px 100% 0px";

type CoursePickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSelect: (courseId: string) => void;
  selectedCourseId?: string | null;
  isPending?: boolean;
  leadingCard?: ReactNode;
};

export function CoursePickerDialog({
  open,
  onOpenChange,
  title,
  description,
  onSelect,
  selectedCourseId,
  isPending,
  leadingCard,
}: CoursePickerDialogProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteCourses(
    {
      title: debouncedSearch.trim() || undefined,
      state: COURSE_STATUSES.PUBLISHED,
      language,
    },
    { enabled: open },
  );
  const courses = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadMoreNode = loadMoreRef.current;
    if (!scrollRoot || !loadMoreNode || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { root: scrollRoot, rootMargin: LOAD_MORE_ROOT_MARGIN },
    );

    observer.observe(loadMoreNode);

    return () => observer.disconnect();
  }, [scrollRoot, hasNextPage, isFetchingNextPage, fetchNextPage, courses.length]);
  const getMediaState = useViewportMediaStates(
    scrollRoot,
    courses.map((course) => course.id).join(),
  );

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        variant="mobileDrawer"
        className="flex flex-col gap-4 pb-4 sm:w-auto sm:[--card-w:min(calc((var(--picker-h)_-_2rem)_/_2.5_*_16_/_9),calc((100vw_-_8rem)_/_2))] sm:[--picker-h:min(60vh,34rem)]"
        data-testid={COURSES_INLINE_EDIT_HANDLES.COURSE_PICKER_DIALOG}
      >
        <DialogHeader className="px-6 pr-12 pt-6 text-left">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="relative px-6">
          <Search
            className="pointer-events-none absolute left-9 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("studentCoursesView.modernView.featuredCourse.search")}
            className="pl-9"
            data-testid={COURSES_INLINE_EDIT_HANDLES.COURSE_PICKER_SEARCH}
          />
        </div>

        <div
          ref={setScrollRoot}
          className="h-[60dvh] overflow-y-auto px-6 py-2 sm:h-[var(--picker-h)] sm:w-[calc(var(--card-w)_*_2_+_4rem)]"
        >
          {isLoading && (
            <div className="flex h-full items-center justify-center text-neutral-500">
              <Loader2 className="size-6 animate-spin" aria-hidden="true" />
            </div>
          )}

          {!isLoading && !courses.length && !leadingCard && (
            <div className="flex h-full items-center justify-center text-neutral-500">
              {t("studentCoursesView.modernView.featuredCourse.empty")}
            </div>
          )}

          {!isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {leadingCard}
              {courses.map((course) => {
                const isSelected = course.id === selectedCourseId;

                return (
                  <div
                    key={course.id}
                    className={cn("relative rounded-lg", {
                      "ring-2 ring-primary-500 ring-offset-2": isSelected,
                      "pointer-events-none opacity-60": isPending,
                    })}
                    data-testid={COURSES_INLINE_EDIT_HANDLES.coursePickerOption(course.id)}
                    {...{ [MEDIA_ITEM_ATTRIBUTE]: course.id }}
                  >
                    <ModernCourseCard
                      id={course.id}
                      title={course.title}
                      description={course.description}
                      thumbnailUrl={course.thumbnailUrl}
                      trailerUrl={course.trailerUrl}
                      estimatedDurationMinutes={course.estimatedDurationMinutes}
                      lessonCount={course.lessonCount}
                      category={course.category}
                      className="max-w-none"
                      variant="picker"
                      mediaState={getMediaState(course.id)}
                      onSelect={() => onSelect(course.id)}
                    />
                    {isSelected && (
                      <span className="pointer-events-none absolute right-2 top-2 z-[130] flex size-7 items-center justify-center rounded-full bg-primary-700 text-white shadow">
                        <Check className="size-4" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && hasNextPage && (
            <div
              ref={loadMoreRef}
              className="flex justify-center py-6 text-neutral-500"
              data-testid={COURSES_INLINE_EDIT_HANDLES.COURSE_PICKER_LOAD_MORE}
            >
              {isFetchingNextPage && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
