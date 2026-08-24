import { Link, useParams } from "@remix-run/react";
import { PERMISSIONS, COURSE_STATUSES } from "@repo/shared";
import { GraduationCap, Info, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useEnrollCourse } from "~/api/mutations";
import {
  availableCoursesQueryOptions,
  courseQueryOptions,
  studentCoursesQueryOptions,
  useCurrentUser,
} from "~/api/queries";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { topCoursesQueryOptions } from "~/api/queries/useTopCourses";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";
import { useCourseAccessProvider } from "../../context/CourseAccessProvider";

type CourseOverviewActionsProps = {
  isTogglingLearningMode: boolean;
  onContinueLearning: () => void;
  onEnrollmentCompleted: () => void;
  onOpenDetails: () => void;
  onToggleLearningMode: () => void;
};

export default function CourseOverviewActions({
  isTogglingLearningMode,
  onContinueLearning,
  onEnrollmentCompleted,
  onOpenDetails,
  onToggleLearningMode,
}: CourseOverviewActionsProps) {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { language } = useLanguageStore();
  const { data: currentUser } = useCurrentUser();
  const { data: globalSettings } = useGlobalSettings();
  const { mutateAsync: enrollCourse, isPending: isEnrolling } = useEnrollCourse();
  const { course, isAdminExperience, canEditCourse, isCourseStudentModeActive } =
    useCourseAccessProvider();

  const isGroupManager = hasPermission(
    currentUser?.permissions ?? [],
    PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
  );

  const isDraftCourse = course.status === COURSE_STATUSES.DRAFT;

  const handleEnrollCourse = async () => {
    await enrollCourse({ id: course.id });
    await Promise.all([
      queryClient.invalidateQueries(courseQueryOptions(course.id)),
      queryClient.invalidateQueries(courseQueryOptions(id)),
      queryClient.invalidateQueries(topCoursesQueryOptions({ language })),
      queryClient.invalidateQueries(availableCoursesQueryOptions({ language })),
      queryClient.invalidateQueries(studentCoursesQueryOptions({ language })),
    ]);
    onEnrollmentCompleted();
  };

  const renderPrimaryAction = () => {
    if (isAdminExperience || (canEditCourse && isCourseStudentModeActive)) {
      const learningModeButton = (
        <Button
          data-testid={COURSE_OVERVIEW_HANDLES.STUDENT_MODE_BUTTON}
          disabled={isTogglingLearningMode || (isDraftCourse && !isCourseStudentModeActive)}
          onClick={onToggleLearningMode}
          className="flex items-center gap-2 shadow-2xl transition disabled:opacity-50"
        >
          <GraduationCap className="size-4" />

          <span className="text-sm font-semibold">
            {t(
              isCourseStudentModeActive
                ? "modernCourseView.learningMode.exit"
                : "modernCourseView.learningMode.enter",
            )}
          </span>
        </Button>
      );

      if (isDraftCourse && !isCourseStudentModeActive) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{learningModeButton}</span>
              </TooltipTrigger>
              <TooltipContent variant="black">
                {t("modernCourseView.draftCourseTooltip")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      return learningModeButton;
    }

    if (!course.enrolled) {
      if (isGroupManager) return null;

      if (!currentUser) {
        const registerPath = globalSettings?.inviteOnlyRegistration
          ? "/auth/login"
          : "/auth/register";

        return (
          <Link data-testid={COURSE_OVERVIEW_HANDLES.LOGIN_ENROLL_LINK} to={registerPath}>
            <Button className="flex items-center gap-2 shadow-2xl">
              <GraduationCap className="size-4" />
              <span className="text-sm font-semibold">
                {t("studentCourseView.sideSection.button.enrollCourse")}
              </span>
            </Button>
          </Link>
        );
      }

      return (
        <Button
          data-testid={COURSE_OVERVIEW_HANDLES.ENROLL_BUTTON}
          disabled={isEnrolling}
          onClick={() => void handleEnrollCourse()}
          className="flex items-center gap-2 shadow-2xl"
        >
          <GraduationCap className="size-4" />
          <span className="text-sm font-semibold">
            {t("studentCourseView.sideSection.button.enrollCourse")}
          </span>
        </Button>
      );
    }

    return (
      <Button
        data-testid={COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON}
        onClick={onContinueLearning}
        className="flex items-center gap-2 shadow-2xl"
      >
        <Play className="size-4" fill="currentColor" />

        <span className="text-sm font-semibold">
          {t("modernCourseView.overview.continueLearning")}
        </span>
      </Button>
    );
  };

  return (
    <div
      data-testid={COURSE_OVERVIEW_HANDLES.ACTIONS}
      className="flex flex-wrap items-center gap-2 sm:gap-3"
    >
      {renderPrimaryAction()}

      <Button
        data-testid={COURSE_OVERVIEW_HANDLES.DETAILS_BUTTON}
        variant="outline"
        onClick={onOpenDetails}
        className="flex items-center gap-2 backdrop-blur-sm transition "
      >
        <Info className="size-4" />

        <span className="text-sm font-semibold">
          {t("modernCourseView.overview.courseDetails")}
        </span>
      </Button>
    </div>
  );
}
