import { useNavigate } from "@remix-run/react";
import { find } from "lodash-es";
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
import { formatWithPlural } from "~/lib/utils";
import { ChapterCounter } from "~/modules/Courses/CourseView/components/ChapterCounter";
import { CourseChapterLesson } from "~/modules/Courses/CourseView/CourseChapterLesson";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseChapterProps = {
  chapter: GetCourseResponse["data"]["chapters"][0];
};

export const CourseChapter = ({ chapter }: CourseChapterProps) => {
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

  const navigate = useNavigate();

  const playChapter = (chapter: CourseChapterProps["chapter"]) => {
    const firstNotStartedLesson = find(
      chapter.lessons,
      (lesson) => lesson.status === "not_started",
    )?.id;
    const lessonToPlay = firstNotStartedLesson ?? chapter.lessons[0].id;

    return navigate(`lesson/${lessonToPlay}`);
  };

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
              <div className="divide-y divide-neutral-200 rounded-b-lg border-x border-b border-primary-500 pb-4 pl-14 pt-3">
                {chapter?.lessons?.map((lesson) => {
                  if (!lesson) return null;

                  return <CourseChapterLesson key={lesson.id} lesson={lesson} />;
                })}
                {chapter.isFreemium && (
                  <Button
                    variant="primary"
                    className="mt-4 gap-2"
                    onClick={() => playChapter(chapter)}
                  >
                    <Icon name="Play" className="size-4" />
                    {t("studentCoursesView.button.playChapter")}
                  </Button>
                )}
              </div>
            </AccordionContent>
          </div>
        </div>
      </AccordionItem>
    </Accordion>
  );
};
