import { PERMISSIONS } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateFeaturedCourse } from "~/api/mutations/admin/useUpdateFeaturedCourse";
import { courseQueryOptions } from "~/api/queries/useCourse";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { usePublishedCourseLookup } from "~/api/queries/usePublishedCourseLookup";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useDebounce } from "~/hooks/useDebounce";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSES_HEADER_HANDLES } from "../../../../../e2e/data/courses/handles";

import type { MouseEvent } from "react";

type FeaturedCourseSelectProps = {
  className?: string;
};

export function FeaturedCourseSelect({ className }: FeaturedCourseSelectProps) {
  const { t } = useTranslation();

  const { language } = useLanguageStore();
  const { hasAccess } = usePermissions({ required: PERMISSIONS.SETTINGS_MANAGE });

  const { data: globalSettings } = useGlobalSettings();
  const featuredCourseId = globalSettings?.featuredCourseId ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const { mutate: updateFeaturedCourse, isPending } = useUpdateFeaturedCourse();
  const { data: selectedCourse, isLoading: isSelectedCourseLoading } = useQuerySelectedCourse(
    featuredCourseId,
    language,
    hasAccess,
  );
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    usePublishedCourseLookup(
      { language, title: debouncedSearch },
      { enabled: hasAccess && isOpen },
    );

  const courses = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

  if (!hasAccess) return null;

  const selectedTitle =
    selectedCourse?.title ?? t("studentCoursesView.modernView.featuredCourse.none");

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  const handleSelect = (courseId: string) => {
    if (courseId === featuredCourseId || isPending) return;

    updateFeaturedCourse(courseId);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isPending || !featuredCourseId) return;

    updateFeaturedCourse(null);
  };

  return (
    <div className={className} data-testid={COURSES_HEADER_HANDLES.FEATURED_COURSE_SELECT}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <div className="flex w-full items-center gap-1 sm:w-auto">
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="min-w-0 flex-1 justify-between gap-2 rounded-lg border-0 bg-white px-2.5 shadow-none transition-colors hover:bg-white sm:w-[17rem] sm:flex-none"
              aria-label={t("studentCoursesView.modernView.featuredCourse.label")}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                  <Star className="size-3.5" aria-hidden="true" />
                </span>
                <span className="truncate text-neutral-950">
                  {isSelectedCourseLoading ? t("common.loading") : selectedTitle}
                </span>
              </span>
              {isPending ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
              )}
            </Button>
          </PopoverTrigger>
          {featuredCourseId && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isPending}
              aria-label={t("studentCoursesView.modernView.featuredCourse.clear")}
              data-testid={COURSES_HEADER_HANDLES.FEATURED_COURSE_CLEAR}
              onClick={handleClear}
              className="size-10 shrink-0 rounded-lg text-neutral-500 hover:bg-white hover:text-neutral-950"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[min(92vw,24rem)] overflow-hidden p-0"
          data-testid={COURSES_HEADER_HANDLES.FEATURED_COURSE_POPOVER}
        >
          <Command shouldFilter={false} className="h-auto">
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t("studentCoursesView.modernView.featuredCourse.search")}
              disabled={isPending}
              data-testid={COURSES_HEADER_HANDLES.FEATURED_COURSE_SEARCH}
            />
            <CommandList className="max-h-80">
              <CommandEmpty>
                {isLoading
                  ? t("common.loading")
                  : t("studentCoursesView.modernView.featuredCourse.empty")}
              </CommandEmpty>
              <CommandGroup>
                {courses.map((course) => (
                  <CommandItem
                    key={course.id}
                    value={course.id}
                    onSelect={() => handleSelect(course.id)}
                    disabled={isPending}
                    className="gap-2"
                    data-testid={COURSES_HEADER_HANDLES.featuredCourseOption(course.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{course.title}</span>
                    {course.id === featuredCourseId && (
                      <Check className="size-4 shrink-0 text-primary-700" aria-hidden="true" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {hasNextPage && (
                <div className="border-t border-input p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2"
                    disabled={isFetchingNextPage || isPending}
                    onClick={() => void fetchNextPage()}
                  >
                    {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                    {t("studentCoursesView.modernView.featuredCourse.loadMore")}
                  </Button>
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function useQuerySelectedCourse(
  courseId: string | null,
  language: Parameters<typeof courseQueryOptions>[1],
  enabled: boolean,
) {
  return useQuery({
    ...courseQueryOptions(courseId ?? "", language),
    enabled: Boolean(courseId) && enabled,
  });
}
