import { Link, useLocation } from "@remix-run/react";
import { last, startCase } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import CourseProgress from "~/components/CourseProgress";
import { Icon } from "~/components/Icon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { CategoryChip } from "~/components/ui/CategoryChip";
import { useLessonsSequence } from "~/hooks/useLessonsSequence";
import { cn } from "~/lib/utils";
import {
  CHAPTER_PROGRESS_STATUSES,
  LessonTypesIcons,
} from "~/modules/Courses/CourseView/lessonTypes";

import { getChaptersWithAccess } from "../utils";

import { LESSON_PROGRESS_STATUSES } from "./types";
import { getCurrentChapterId } from "./utils";

import type { GetCourseResponse } from "~/api/generated-api";

type LessonSidebarProps = {
  course: GetCourseResponse["data"];
  lessonId: string;
};

const progressBadge = {
  completed: "InputRoundedMarkerSuccess",
  in_progress: "InProgress",
  not_started: "NotStartedRounded",
  blocked: "Blocked",
} as const;

export const LessonSidebar = ({ course, lessonId }: LessonSidebarProps) => {
  const { t } = useTranslation();
  const { state } = useLocation();

  const [activeChapter, setActiveChapter] = useState<string | undefined>(
    state?.chapterId ?? getCurrentChapterId(course, lessonId),
  );

  const { sequenceEnabled } = useLessonsSequence(course?.id);

  const chapters = useMemo(
    () => getChaptersWithAccess(course?.chapters || [], sequenceEnabled),
    [course?.chapters, sequenceEnabled],
  );

  useEffect(() => {
    setActiveChapter(state?.chapterId ?? getCurrentChapterId(course, lessonId));
  }, [state?.chapterId, lessonId, course]);

  const handleAccordionChange = (value: string | undefined) => {
    setActiveChapter(value);
  };

  if (!course) return null;

  return (
    <div className="sticky top-0 h-auto max-h-fit min-h-screen overflow-y-scroll rounded-lg bg-white">
      <div className="flex flex-col gap-y-12">
        <div className="flex flex-col gap-y-4 px-8 pt-8">
          <div className="flex justify-between">
            <CategoryChip category={course.category} className="body-sm-md bg-primary-50" />
          </div>
          <h1 className="h6 text-neutral-950">{course.title}</h1>
          <CourseProgress
            label={t("studentLessonView.sideSection.other.courseProgress")}
            completedLessonCount={course.completedChapterCount ?? 0}
            courseLessonCount={course.courseChapterCount ?? 0}
            isCompleted={course.completedChapterCount === course.courseChapterCount}
          />
        </div>
        <div className="flex flex-col gap-y-4 px-4">
          <p className="body-lg-md px-4 text-neutral-950">
            {t("studentLessonView.sideSection.header")}
          </p>
          <div className="flex flex-col">
            <Accordion
              type="single"
              collapsible
              value={activeChapter}
              onValueChange={handleAccordionChange}
            >
              {chapters?.map(
                ({
                  id,
                  title,
                  lessons,
                  chapterProgress = CHAPTER_PROGRESS_STATUSES.NOT_STARTED,
                }) => {
                  return (
                    <AccordionItem value={id} key={id}>
                      <AccordionTrigger
                        className={cn(
                          "flex items-start gap-x-4 border border-neutral-200 px-6 py-4 text-start hover:bg-neutral-50 data-[state=closed]:rounded-none data-[state=open]:rounded-t-lg data-[state=closed]:border-x-transparent data-[state=closed]:border-t-transparent [&[data-state=closed]>svg]:duration-200 [&[data-state=closed]>svg]:ease-out [&[data-state=open]>svg]:rotate-180 [&[data-state=open]>svg]:duration-200 [&[data-state=open]>svg]:ease-out",
                          {
                            "data-[state=closed]:border-b-0":
                              last(course?.chapters)?.id === id || activeChapter !== id,
                          },
                        )}
                      >
                        <Badge
                          variant="icon"
                          icon={
                            progressBadge[
                              state?.chapterId === id &&
                              chapterProgress === CHAPTER_PROGRESS_STATUSES.NOT_STARTED
                                ? CHAPTER_PROGRESS_STATUSES.IN_PROGRESS
                                : chapterProgress
                            ]
                          }
                          iconClasses="w-6 h-auto shrink-0"
                        />
                        <div className="body-base-md w-full text-start text-neutral-950">
                          {title}
                        </div>
                        <Icon name="CarretDownLarge" className="size-6 text-primary-700" />
                      </AccordionTrigger>
                      <AccordionContent className="flex flex-col rounded-b-lg border border-t-0">
                        {lessons?.map(({ id, title, status, type, hasAccess }) => {
                          const isBlocked =
                            status === LESSON_PROGRESS_STATUSES.BLOCKED || !hasAccess;

                          return (
                            <Link
                              key={id}
                              to={isBlocked ? "#" : `/course/${course.id}/lesson/${id}`}
                              className={cn("flex gap-x-4 px-6 py-2 hover:bg-neutral-50 pl-10", {
                                "cursor-not-allowed hover:bg-transparent opacity-30": isBlocked,
                                "border-l-2 border-l-primary-600 bg-primary-50 last:rounded-es-lg":
                                  lessonId === id,
                              })}
                            >
                              <Badge
                                variant="icon"
                                icon={
                                  progressBadge[
                                    isBlocked ? LESSON_PROGRESS_STATUSES.BLOCKED : status
                                  ]
                                }
                                iconClasses="w-6 h-auto shrink-0"
                              />{" "}
                              <div className="flex flex-1 flex-col break-words overflow-x-hidden">
                                <p className="body-sm-md text-neutral-950">{title}</p>
                                <p className="details text-neutral-800">{startCase(type)}</p>
                              </div>
                              <Icon
                                name={LessonTypesIcons[type]}
                                className="size-6 text-primary-700"
                              />
                            </Link>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  );
                },
              )}
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
};
