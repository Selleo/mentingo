import { Link, useLocation } from "@remix-run/react";
import { last, startCase } from "lodash-es";
import { useEffect, useState } from "react";
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
import { cn } from "~/lib/utils";
import { LessonTypesIcons } from "~/modules/Courses/CourseView/lessonTypes";

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
  const { state } = useLocation();
  const [activeChapter, setActiveChapter] = useState<string | undefined>(state?.chapterId);
  const { t } = useTranslation();

  useEffect(() => {
    setActiveChapter(state?.chapterId);
  }, [state?.chapterId]);

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
              value={activeChapter ?? course?.chapters?.[0]?.id}
              onValueChange={handleAccordionChange}
            >
              {course?.chapters?.map(({ id, title, lessons, chapterProgress = "not_started" }) => {
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
                            state?.chapterId === id && chapterProgress === "not_started"
                              ? "in_progress"
                              : chapterProgress
                          ]
                        }
                        iconClasses="w-6 h-auto shrink-0"
                      />
                      <div className="body-base-md w-full text-start text-neutral-950">{title}</div>
                      <Icon name="CarretDownLarge" className="size-6 text-primary-700" />
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col rounded-b-lg border border-t-0">
                      {lessons?.map(({ id, title, status, type }) => {
                        return (
                          <Link
                            key={id}
                            to={status === "completed" ? `/course/${course.id}/lesson/${id}` : "#"}
                            className={cn("flex gap-x-4 px-6 py-2 hover:bg-neutral-50", {
                              "cursor-not-allowed": status === "not_started",
                              "border-l-2 border-l-primary-600 bg-primary-50 last:rounded-es-lg":
                                lessonId === id,
                            })}
                          >
                            <Badge
                              variant="icon"
                              icon={
                                progressBadge[
                                  id === lessonId && status === "not_started"
                                    ? "in_progress"
                                    : status
                                ]
                              }
                              iconClasses="w-6 h-auto shrink-0"
                            />{" "}
                            <div className="flex w-full flex-col">
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
              })}
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
};
