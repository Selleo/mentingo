import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Link, useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { CardBadge } from "~/components/CardBadge";
import { Icon } from "~/components/Icon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { formatWithPlural } from "~/lib/utils";
import { ChapterCounter } from "~/modules/Courses/CourseView/components/ChapterCounter";
import { CourseChapterLesson } from "~/modules/Courses/CourseView/CourseChapterLesson";

import { LESSON_PROGRESS_STATUSES } from "../Lesson/types";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseChapterProps = {
  chapter: GetCourseResponse["data"]["chapters"][0];
  enrolled: GetCourseResponse["data"]["enrolled"];
  course: GetCourseResponse["data"];
};

export const CourseChapter = ({ chapter, enrolled, course }: CourseChapterProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const lessonText = formatWithPlural(
    chapter.lessonCount ?? 0,
    t("courseChapterView.other.lesson"),
    t("courseChapterView.other.lessons"),
  );
  const quizText = formatWithPlural(
    chapter.quizCount ?? 0,
    t("courseChapterView.other.quiz"),
    t("courseChapterView.other.quizzes"),
  );

  const isAllLessonsCompleted = chapter.completedLessonCount === chapter.lessonCount;
  const isAllLessonsNotStarted = chapter.completedLessonCount === 0;
  const firstInProgressLesson = chapter.lessons.find(
    ({ status }) => status === LESSON_PROGRESS_STATUSES.IN_PROGRESS,
  );
  const firstNotStartedLesson = chapter.lessons.find(
    ({ status }) => status === LESSON_PROGRESS_STATUSES.NOT_STARTED,
  );

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <div className="flex w-full gap-x-4">
          <ChapterCounter
            chapterProgress={chapter.chapterProgress}
            displayOrder={chapter.displayOrder}
          />
          <div className="flex w-full flex-col">
            <AccordionTrigger className="border text-start data-[state=closed]:rounded-lg data-[state=open]:rounded-t-lg data-[state=open]:border-primary-500 data-[state=open]:bg-primary-50 [&[data-state=open]>div>div>svg]:rotate-180 [&[data-state=open]>div>div>svg]:duration-200 [&[data-state=open]>div>div>svg]:ease-out">
              <div className="flex w-full items-center gap-x-1 px-2 py-4 md:gap-x-4 md:p-4">
                <div className="grid size-8 place-items-center">
                  <Icon name="CarretDownLarge" className="h-auto w-6 text-primary-700" />
                </div>
                <div className="flex w-full flex-col">
                  <div className="details text-neutral-800">
                    {lessonText} {lessonText && quizText ? "• " : ""} {quizText}
                  </div>
                  <p className="body-base-md text-neutral-950">{chapter.title}</p>
                  <div className="details flex max-w-[620px] items-center gap-x-1 text-neutral-800">
                    <span className="pr-2">
                      {chapter.completedLessonCount}/{chapter.lessonCount}
                    </span>
                    {Array.from({ length: chapter.lessonCount }).map((_, index) => {
                      if (
                        typeof chapter?.completedLessonCount === "number" &&
                        index >= chapter.completedLessonCount
                      ) {
                        return (
                          <span key={index} className="h-1 w-full rounded-lg bg-primary-100" />
                        );
                      }

                      if (chapter.completedLessonCount && index < chapter.completedLessonCount) {
                        return (
                          <span key={index} className="h-1 w-full rounded-lg bg-success-500" />
                        );
                      }

                      return (
                        <span key={index} className="h-1 w-full rounded-lg bg-secondary-500" />
                      );
                    })}
                  </div>
                </div>
                {chapter.isFreemium && (
                  <CardBadge variant="successFilled">
                    <Icon name="FreeRight" className="w-4" />
                    {t("courseChapterView.other.free")}
                  </CardBadge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="divide-y divide-neutral-200 rounded-b-lg border-x border-b border-primary-500">
                {chapter?.lessons?.map((lesson) => {
                  if (!lesson) return null;
                  if (enrolled || chapter.isFreemium) {
                    return (
                      <Link to={`/course/${course.id}/lesson/${lesson.id}`} key={lesson.id}>
                        <div className="pb-4 pl-14 pt-3 hover:bg-neutral-50">
                          <CourseChapterLesson lesson={lesson} />
                        </div>
                      </Link>
                    );
                  } else {
                    const tooltipMessage =
                      !enrolled && course.priceInCents === 0
                        ? t("studentChapterView.other.enrollmentRequired")
                        : t("studentChapterView.other.purchaseRequired");
                    return (
                      <TooltipProvider key={lesson.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-not-allowed pb-4 pl-14 pt-3 opacity-60">
                              <CourseChapterLesson lesson={lesson} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{tooltipMessage}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }
                })}
                {course.enrolled ||
                  (chapter.isFreemium && (
                    <>
                      {isAllLessonsCompleted && (
                        <Button
                          className="my-3 ml-14 flex gap-2 px-5"
                          onClick={() => {
                            navigate(
                              `/course/${course.id}/lesson/${course.chapters[chapter.displayOrder].lessons[0].id}`,
                            );
                          }}
                        >
                          <Icon name="Play" className="size-4 h-auto" />
                          {t("studentChapterView.button.open")}
                        </Button>
                      )}
                      {(firstInProgressLesson ||
                        (firstNotStartedLesson && (chapter.completedLessonCount ?? 0) > 0)) && (
                        <Button
                          className="my-3 ml-14 flex gap-2 px-5"
                          onClick={() => {
                            const targetLesson = firstInProgressLesson || firstNotStartedLesson;
                            if (targetLesson) {
                              navigate(`/course/${course.id}/lesson/${targetLesson.id}`);
                            }
                          }}
                        >
                          <Icon name="Play" className="size-4 h-auto" />
                          {t("studentChapterView.button.continue")}
                        </Button>
                      )}
                      {isAllLessonsNotStarted && (
                        <Button
                          className="my-3 ml-14 flex gap-2 px-5"
                          onClick={() => {
                            navigate(
                              `/course/${course.id}/lesson/${course.chapters[chapter.displayOrder].lessons[0].id}`,
                            );
                          }}
                        >
                          <Icon name="Play" className="size-4 h-auto" />
                          {t("studentChapterView.button.playChapter")}
                        </Button>
                      )}
                    </>
                  ))}
              </div>
            </AccordionContent>
          </div>
        </div>
      </AccordionItem>
    </Accordion>
  );
};
