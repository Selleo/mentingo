import { PERMISSIONS } from "@repo/shared";
import { useCallback, useEffect, useState } from "react";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useBulkGroupCourseEnroll } from "~/api/mutations/admin/useBulkGroupCourseEnroll";
import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { useUpdateHasCertificate } from "~/api/mutations/useUpdateHasCertificate";
import { useCurrentUser } from "~/api/queries";
import { useGroupsByCourseQuery } from "~/api/queries/admin/useGroupsByCourse";
import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";

import { useCourseAccessProvider } from "../context/CourseAccessProvider";

import AuthorModal from "./CourseStatBar/AuthorModal";
import AuthorStatCard from "./CourseStatBar/AuthorStatCard";
import CertificateModal from "./CourseStatBar/CertificateModal";
import CertificateStatCard from "./CourseStatBar/CertificateStatCard";
import DeadlineModal, { type GroupDeadline } from "./CourseStatBar/DeadlineModal";
import DeadlineStatCard from "./CourseStatBar/DeadlineStatCard";
import ProgressStatCard from "./CourseStatBar/ProgressStatCard";

import type { SupportedLanguages } from "@repo/shared";
import type { GetCourseResponse } from "~/api/generated-api";

type CourseHeroProps = {
  course: GetCourseResponse["data"];
  language: SupportedLanguages;
};

const getGridClassName = ({
  hasAuthor,
  hasCertificate,
  hasDeadline,
  isAdminExperience,
  showAuthorSection,
}: {
  hasAuthor: boolean;
  hasCertificate: boolean;
  hasDeadline?: boolean;
  isAdminExperience: boolean;
  showAuthorSection: boolean;
}) => {
  if (isAdminExperience) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  const visibleCards =
    1 + (hasDeadline ? 1 : 0) + (hasCertificate ? 1 : 0) + (showAuthorSection && hasAuthor ? 1 : 0);

  if (visibleCards === 1) return "grid-cols-1";
  if (visibleCards === 2) return "grid-cols-1 sm:grid-cols-2";
  if (visibleCards === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
};

export function CourseStatBar({ course, language }: CourseHeroProps) {
  const hasCertificate = Boolean(course.hasCertificate);
  const hasAuthor = Boolean(course.authorId);
  const showAuthorSection = course.showAuthorSection ?? true;

  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [showAuthorSectionDraft, setShowAuthorSectionDraft] = useState(showAuthorSection);
  const [deadlineEnabledDraft, setDeadlineEnabledDraft] = useState(Boolean(course.dueDate));
  const [groupDeadlines, setGroupDeadlines] = useState<GroupDeadline[]>([]);
  const [certificateEnabledDraft, setCertificateEnabledDraft] = useState(hasCertificate);
  const [certificateColor, setCertificateColor] = useState("#3f58b6");

  const { mutate: updateHasCertificate, isPending: isUpdatingCertificate } =
    useUpdateHasCertificate();
  const { mutateAsync: updateCourse, isPending: isUpdatingAuthorSection } = useUpdateCourse();
  const { mutate: updateGroupDeadlines, isPending: isUpdatingDeadlines } = useBulkGroupCourseEnroll(
    course.id,
  );
  const { data: author } = useUserDetails(course.authorId);
  const { data: currentUser } = useCurrentUser();

  const { hasAccess: canManageUsers } = usePermissions({
    required: PERMISSIONS.USER_MANAGE,
  });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });

  const { isCourseStudentModeActive } = useCourseAccessProvider();
  const { mutate: toggleLearningMode } = useToggleCourseStudentMode(course.id);
  const canEditCourse = canManageUsers || (canManageCourses && course.authorId === currentUser?.id);
  const isAdminExperience = canEditCourse && !isCourseStudentModeActive;

  const { data: otherCourses = [] } = useContentCreatorCourses(
    course.authorId,
    {
      scope: "available",
      excludeCourseId: course.id,
      language,
    },
    true,
  );

  const { data: enrolledGroups } = useGroupsByCourseQuery(
    isAdminExperience ? course.id : "",
    language,
  );
  const hasDeadline = isAdminExperience
    ? enrolledGroups?.some((group) => Boolean(group.isMandatory && group.dueDate))
    : Boolean(course.dueDate);

  const resetDeadlineDraft = useCallback(() => {
    const groups = enrolledGroups ?? [];

    setGroupDeadlines(
      groups.map((group) => ({
        id: group.id,
        name: group.name,
        deadline: group.dueDate?.slice(0, 10) ?? "",
      })),
    );
    setDeadlineEnabledDraft(groups.some((group) => Boolean(group.isMandatory && group.dueDate)));
  }, [enrolledGroups]);

  useEffect(() => {
    setCertificateEnabledDraft(hasCertificate);
  }, [hasCertificate]);

  useEffect(() => {
    setShowAuthorSectionDraft(showAuthorSection);
  }, [showAuthorSection]);

  useEffect(() => {
    resetDeadlineDraft();
  }, [resetDeadlineDraft]);

  const openCertificateModal = () => {
    setCertificateEnabledDraft(hasCertificate);
    setShowCertificateModal(true);
  };

  const closeCertificateModal = () => {
    setCertificateEnabledDraft(hasCertificate);
    setShowCertificateModal(false);
  };

  const openAuthorModal = () => {
    setShowAuthorSectionDraft(showAuthorSection);
    setShowAuthorModal(true);
  };

  const closeAuthorModal = () => {
    setShowAuthorSectionDraft(showAuthorSection);
    setShowAuthorModal(false);
  };

  const openDeadlineModal = () => {
    resetDeadlineDraft();
    setShowDeadlineModal(true);
  };

  const closeDeadlineModal = () => {
    resetDeadlineDraft();
    setShowDeadlineModal(false);
  };

  const saveCertificate = () => {
    updateHasCertificate(
      {
        courseId: course.id,
        data: {
          hasCertificate: certificateEnabledDraft,
        },
      },
      {
        onSuccess: () => {
          setShowCertificateModal(false);
        },
      },
    );
  };

  const saveDeadlines = () => {
    updateGroupDeadlines(
      {
        groups: groupDeadlines.map((group) => ({
          id: group.id,
          isMandatory: deadlineEnabledDraft,
          dueDate:
            deadlineEnabledDraft && group.deadline ? new Date(group.deadline).toISOString() : null,
        })),
      },
      {
        onSuccess: () => setShowDeadlineModal(false),
      },
    );
  };

  const saveAuthorSection = async () => {
    await updateCourse({
      courseId: course.id,
      data: {
        language,
        showAuthorSection: showAuthorSectionDraft,
      },
    });

    setShowAuthorModal(false);
  };

  const timeLeftSeconds = course.chapters
    .flatMap((chapter) => chapter.lessons)
    .filter((lesson) => lesson.status !== "completed")
    .reduce((total, lesson) => total + (lesson.estimatedDurationSeconds ?? 0), 0);

  return (
    <div
      className={cn(
        "mb-4 grid gap-4 md:mb-6",
        getGridClassName({
          hasAuthor,
          hasCertificate,
          hasDeadline,
          isAdminExperience,
          showAuthorSection,
        }),
      )}
    >
      <ProgressStatCard
        isAdminExperience={isAdminExperience}
        onEnterLearningMode={() => toggleLearningMode({ enabled: false })}
        timeLeftSeconds={timeLeftSeconds}
      />

      {(isAdminExperience || hasDeadline) && (
        <DeadlineStatCard
          dueDate={course.dueDate}
          hasDeadline={hasDeadline}
          isAdminExperience={isAdminExperience}
          onOpen={openDeadlineModal}
        />
      )}

      {(isAdminExperience || hasCertificate) && (
        <CertificateStatCard
          hasCertificate={hasCertificate}
          isAdminExperience={isAdminExperience}
          onOpen={openCertificateModal}
        />
      )}

      {(isAdminExperience || (showAuthorSection && hasAuthor)) && (
        <AuthorStatCard
          author={author}
          isAdminExperience={isAdminExperience}
          onOpen={openAuthorModal}
          showAuthorSection={showAuthorSection}
        />
      )}

      {showCertificateModal && (
        <CertificateModal
          certificateColor={certificateColor}
          certificateEnabledDraft={certificateEnabledDraft}
          courseTitle={course.title}
          isSaving={isUpdatingCertificate}
          onCertificateColorChange={setCertificateColor}
          onClose={closeCertificateModal}
          onSave={saveCertificate}
          onToggleCertificate={() => setCertificateEnabledDraft((enabled) => !enabled)}
        />
      )}

      {showDeadlineModal && (
        <DeadlineModal
          deadlineEnabledDraft={deadlineEnabledDraft}
          groupDeadlines={groupDeadlines}
          isSaving={isUpdatingDeadlines}
          onChangeGroupDeadlines={setGroupDeadlines}
          onClose={closeDeadlineModal}
          onSave={saveDeadlines}
          onToggleDeadline={() => setDeadlineEnabledDraft((enabled) => !enabled)}
        />
      )}

      {showAuthorModal && (
        <AuthorModal
          author={author}
          isAdminExperience={isAdminExperience}
          isSaving={isUpdatingAuthorSection}
          onClose={closeAuthorModal}
          onSave={saveAuthorSection}
          onToggleShowAuthorSection={() => setShowAuthorSectionDraft((visible) => !visible)}
          otherCourses={otherCourses}
          showAuthorSectionDraft={showAuthorSectionDraft}
        />
      )}
    </div>
  );
}
