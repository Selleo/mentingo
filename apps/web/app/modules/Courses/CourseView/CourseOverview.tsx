import { useNavigate } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { formatDate } from "date-fns";
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
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { usePermissions } from "~/hooks/usePermissions";
import { courseLanguages } from "~/modules/Admin/EditCourse/components/CourseLanguageSelector";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";

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

  const imageUrl = course?.thumbnailUrl ?? CardPlaceholder;
  const title = course?.title;
  const description = course?.description || "";
  const completedStudentAvatars = course.completedStudentAvatars ?? [];
  const completedStudentsCount = course.completedStudentsCount ?? 0;
  const hiddenCompletedStudentsCount = Math.max(
    completedStudentsCount - completedStudentAvatars.length,
    0,
  );
  const isDraftCourse = course.status === "draft";
  const isEnterLearningModeDisabled = isDraftCourse && !isCourseStudentModeActive;

  const navigateToEditCourse = () => navigate(`/admin/beta-courses/${course.id}`);

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
            <Viewer
              content={description}
              className="body-base mt-2 text-neutral-900"
              variant="content"
            />
            {completedStudentsCount > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="body-sm-md text-neutral-700">Completed by</span>
                <div className="flex items-center">
                  {completedStudentAvatars.map((student, index) => (
                    <div
                      key={student.userId}
                      data-testid="completed-student-avatar"
                      className="-ml-2 first:ml-0"
                      style={{ zIndex: completedStudentAvatars.length - index }}
                    >
                      <UserAvatar
                        userName="Completed student"
                        profilePictureUrl={student.avatarUrl}
                        className="size-9 border-2 border-white"
                      />
                    </div>
                  ))}
                  {hiddenCompletedStudentsCount > 0 && (
                    <span className="body-sm-md ml-3 text-neutral-700">
                      +{hiddenCompletedStudentsCount}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
