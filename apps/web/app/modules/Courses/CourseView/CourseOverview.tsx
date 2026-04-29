import { useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { formatDate } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import { Icon } from "~/components/Icon";
import Viewer from "~/components/RichText/Viever";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { CategoryChip } from "~/components/ui/CategoryChip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { usePermissions } from "~/hooks/usePermissions";
import { courseLanguages } from "~/modules/Admin/EditCourse/components/CourseLanguageSelector";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import {
  fetchCourseTakeaway,
  getCourseTakeawayLocalFallback,
  saveCourseTakeaway,
} from "~/modules/Courses/learning/courseTakeaway";
import { getCourseResumeProgress } from "~/modules/Courses/learning/resumeProgress";

import { COURSE_OVERVIEW_HANDLES } from "../../../../e2e/data/courses/handles";

import type { GetCourseResponse } from "~/api/generated-api";

type CourseOverviewProps = {
  course: GetCourseResponse["data"];
};

export default function CourseOverview({ course }: CourseOverviewProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { hasAccess: canManageUsers } = usePermissions({ required: PERMISSIONS.USER_MANAGE });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { data: currentUser } = useCurrentUser();
  const { isCourseStudentModeActive } = useCourseAccessProvider();
  const { mutate: toggleLearningMode, isPending: isTogglingLearningMode } =
    useToggleCourseStudentMode(course.id);

  const [takeaway, setTakeaway] = useState("");

  const imageUrl = course?.thumbnailUrl ?? CardPlaceholder;
  const title = course?.title;
  const description = course?.description || "";
  const isDraftCourse = course.status === "draft";
  const isEnterLearningModeDisabled = isDraftCourse && !isCourseStudentModeActive;

  const navigateToEditCourse = () => navigate(`/admin/beta-courses/${course.id}`);

  const resume = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return getCourseResumeProgress({ userId: currentUser?.id, courseId: course.id });
  }, [course.id, currentUser?.id]);

  const resumeMeta = useMemo(() => {
    if (!resume?.lessonId) return undefined;

    for (const chapter of course.chapters ?? []) {
      const lesson = chapter.lessons?.find((l) => l.id === resume.lessonId);
      if (!lesson) continue;

      return {
        chapterTitle: chapter.title,
        chapterOrder: chapter.displayOrder,
        lessonTitle: lesson.title,
      };
    }

    return undefined;
  }, [course.chapters, resume?.lessonId]);

  const handleResume = () => {
    if (!resume?.lessonId) return;
    navigate(`/course/${course.slug}/lesson/${resume.lessonId}`, {
      state: resume.chapterId ? { chapterId: resume.chapterId } : undefined,
    });
  };

  useEffect(() => {
    setTakeaway(getCourseTakeawayLocalFallback({ userId: currentUser?.id, courseId: course.id }));

    let cancelled = false;
    void fetchCourseTakeaway({ courseId: course.id })
      .then((content) => {
        if (cancelled) return;
        setTakeaway(content);
      })
      .catch(() => {
        // keep local fallback
      });

    return () => {
      cancelled = true;
    };
  }, [course.id, currentUser?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveCourseTakeaway({ userId: currentUser?.id, courseId: course.id, value: takeaway }).catch(
        () => {
          // local cache still persists
        },
      );
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [course.id, currentUser?.id, takeaway]);

  return (
    <Card className="w-full border-none pt-1 drop-shadow-primary lg:pt-0">
      <CardContent className="flex flex-col px-0">
        {(canManageUsers || (canManageCourses && course.authorId === currentUser?.id)) && (
          <div className="border-b border-1 border-neutral-200 flex items-center justify-between p-4 px-6 mb-8 xl:mb-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex mr-2">
                    <Button
                      data-testid={COURSE_OVERVIEW_HANDLES.STUDENT_MODE_BUTTON}
                      className="flex gap-2"
                      variant={isCourseStudentModeActive ? "primary" : "outline"}
                      onClick={() => toggleLearningMode({ enabled: !isCourseStudentModeActive })}
                      disabled={isTogglingLearningMode || isEnterLearningModeDisabled}
                    >
                      <Icon
                        name={isCourseStudentModeActive ? "X" : "Hat"}
                        className={isCourseStudentModeActive ? "size-2.5" : "size-4"}
                      />
                      {isCourseStudentModeActive
                        ? t("studentCourseView.studentMode.exit")
                        : t("studentCourseView.studentMode.enter")}
                    </Button>
                  </span>
                </TooltipTrigger>
                {isEnterLearningModeDisabled && (
                  <TooltipContent>
                    {t("studentCourseView.studentMode.draftCourseTooltip")}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button className="flex gap-2" variant="primary" onClick={navigateToEditCourse}>
              <Icon name="Edit" className="size-4" />
              {t("pages.editCourse")}
            </Button>
          </div>
        )}
        <div className="align-center flex flex-col gap-6 px-4 lg:p-8 2xl:flex-row">
          <div className="relative aspect-video w-full self-start lg:max-w-[320px]">
            <img
              src={imageUrl}
              alt={title}
              loading="eager"
              decoding="async"
              className="h-full w-full rounded-lg object-cover drop-shadow-sm"
              onError={(event) => {
                event.currentTarget.src = CardPlaceholder;
              }}
            />
          </div>
          <div className="flex w-full flex-col gap-y-2">
            <div className="flex items-center gap-2">
              <CategoryChip category={course?.category} className="bg-primary-50" />
              {course?.dueDate && (
                <CategoryChip
                  category={t("common.other.dueDate", {
                    date: formatDate(course?.dueDate, "dd.MM.yyyy"),
                  })}
                  color="text-warning-600"
                  className="bg-warning-50"
                  textClassName="text-zest-900"
                />
              )}

              <Badge variant="default" className="flex gap-2">
                {courseLanguages
                  .filter((item) => course.availableLocales.includes(item.key))
                  .map((item) => (
                    <Icon key={item.key} name={item.iconName} className="size-4" />
                  ))}
              </Badge>
            </div>
            <h5 className="h5">{title}</h5>
            <div className="mt-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
              <p className="body-sm-md text-neutral-950">
                {t("studentCourseView.takeaway.title", {
                  defaultValue: "Co wyniosłeś dotychczas z kursu",
                })}
              </p>
              <p className="mt-1 text-xs text-neutral-700">
                {t("studentCourseView.takeaway.subtitle", {
                  defaultValue: "Zapisuj własnymi słowami wnioski i notatki.",
                })}
              </p>
              <textarea
                className="mt-3 w-full min-h-28 rounded-md border border-primary-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:ring-2 focus:ring-primary-300"
                value={takeaway}
                onChange={(e) => setTakeaway(e.target.value)}
                placeholder={t("studentCourseView.takeaway.placeholder", {
                  defaultValue:
                    "Np.\n- 3 najważniejsze rzeczy…\n- co wdrażam od jutra…\n- pytania do wyjaśnienia…",
                })}
              />
            </div>
            {!!resume?.lessonId && (
              <div className="mt-2 flex flex-col gap-2 rounded-lg border border-primary-200 bg-primary-50 p-4">
                <div className="flex flex-col gap-1">
                  <p className="body-sm-md text-neutral-950">
                    {t("studentCourseView.resume.title", { defaultValue: "Wznów naukę" })}
                  </p>
                  <p className="text-xs text-neutral-700">
                    {resumeMeta
                      ? `${t("studentLessonView.other.chapter", { defaultValue: "Rozdział" })} ${resumeMeta.chapterOrder}: ${resumeMeta.chapterTitle} — ${resumeMeta.lessonTitle}`
                      : t("studentCourseView.resume.subtitle", {
                          defaultValue: "Wróć do ostatnio otwartej lekcji.",
                        })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    className="flex items-center gap-2"
                    onClick={handleResume}
                  >
                    <Icon name="BookOpen" className="size-4" />
                    {t("studentCourseView.resume.cta", { defaultValue: "Wznów" })}
                  </Button>
                </div>
              </div>
            )}
            <Viewer
              content={description}
              className="body-base mt-2 text-neutral-900"
              variant="content"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
