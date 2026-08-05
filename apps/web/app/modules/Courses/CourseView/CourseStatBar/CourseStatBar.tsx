import { PERMISSIONS } from "@repo/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useBulkGroupCourseEnroll } from "~/api/mutations/admin/useBulkGroupCourseEnroll";
import { useTransferCourseOwnership } from "~/api/mutations/admin/useTransferCourseOwnership";
import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { useCurrentUser } from "~/api/queries";
import { useCourseOwnershipCandidates } from "~/api/queries/admin/useCourseOwnershipCandidates";
import { useGroupsByCourseQuery } from "~/api/queries/admin/useGroupsByCourse";
import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { hasAllPermissions, hasPermission } from "~/common/permissions/permission.utils";
import { cn } from "~/lib/utils";

import { useCourseAccessProvider } from "../../context/CourseAccessProvider";
import { CHAPTER_PROGRESS_STATUSES } from "../lessonTypes";

import AuthorModal from "./AuthorModal";
import AuthorStatCard from "./AuthorStatCard";
import CertificateModal from "./CertificateModal";
import CertificateStatCard from "./CertificateStatCard";
import DeadlineModal, { type GroupDeadline } from "./DeadlineModal";
import DeadlineStatCard from "./DeadlineStatCard";
import ProgressStatCard from "./ProgressStatCard";

import type { SupportedLanguages } from "@repo/shared";

type CourseHeroProps = {
  language: SupportedLanguages;
};

const getGridClassName = ({
  showAuthorCard,
  showCertificateCard,
  showDeadlineCard,
}: {
  showAuthorCard: boolean;
  showCertificateCard: boolean;
  showDeadlineCard: boolean;
}) => {
  const visibleCards =
    1 + Number(showDeadlineCard) + Number(showCertificateCard) + Number(showAuthorCard);

  if (visibleCards === 1) return "grid-cols-1";
  if (visibleCards === 2) return "grid-cols-1 sm:grid-cols-2";
  if (visibleCards === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
};

export function CourseStatBar({ language }: CourseHeroProps) {
  const { course, canEditCourse, isAdminExperience } = useCourseAccessProvider();
  const { data: currentUser } = useCurrentUser();
  const canManageDeadlines = hasAllPermissions(currentUser?.permissions, [
    PERMISSIONS.COURSE_ENROLLMENT,
    PERMISSIONS.GROUP_READ,
  ]);
  const canManageCourseOwnership = hasPermission(
    currentUser?.permissions,
    PERMISSIONS.COURSE_UPDATE,
  );

  const hasCertificate = Boolean(course.hasCertificate);
  const hasAuthor = Boolean(course.authorId);
  const showAuthorSection = course.showAuthorSection ?? true;

  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [showAuthorSectionDraft, setShowAuthorSectionDraft] = useState(showAuthorSection);
  const [deadlineEnabledDraft, setDeadlineEnabledDraft] = useState(Boolean(course.dueDate));
  const [groupDeadlines, setGroupDeadlines] = useState<GroupDeadline[]>([]);

  const { mutateAsync: updateCourse, isPending: isUpdatingAuthorSection } = useUpdateCourse();
  const { mutate: updateGroupDeadlines, isPending: isUpdatingDeadlines } = useBulkGroupCourseEnroll(
    course.id,
  );
  const { mutateAsync: transferCourseOwnership, isPending: isTransferringOwner } =
    useTransferCourseOwnership();
  const { data: author } = useUserDetails(course.authorId);
  const { mutate: toggleLearningMode } = useToggleCourseStudentMode(course.id);

  const { data: otherCourses = [] } = useContentCreatorCourses(
    course.authorId,
    {
      scope: "all",
      excludeCourseId: course.id,
      language,
    },
    true,
  );

  const { data: enrolledGroups } = useGroupsByCourseQuery(
    canEditCourse && canManageDeadlines ? course.id : "",
    language,
  );
  const { data: courseOwnershipCandidates } = useCourseOwnershipCandidates({
    id: course.id,
    enabled: canManageCourseOwnership,
  });
  const groupDeadlineDueDate = enrolledGroups
    ?.filter((group) => group.isMandatory && group.dueDate)
    .map((group) => group.dueDate)
    .sort()[0];
  const deadlineDueDate = groupDeadlineDueDate ?? course.dueDate;
  const hasDeadline = Boolean(deadlineDueDate);
  const showDeadlineCard = isAdminExperience ? canManageDeadlines : hasDeadline;
  const showCertificateCard = isAdminExperience || hasCertificate;
  const showAuthorCard = isAdminExperience || (showAuthorSection && hasAuthor);
  const canEditOwner = Boolean(
    isAdminExperience &&
      canManageCourseOwnership &&
      courseOwnershipCandidates?.possibleCandidates?.length,
  );

  const resetDeadlineDraft = useCallback(() => {
    const groups = enrolledGroups ?? [];

    setGroupDeadlines(
      groups.map((group) => ({
        id: group.id,
        isMandatory: Boolean(group.isMandatory),
        name: group.name,
        deadline: group.dueDate?.slice(0, 10) ?? "",
      })),
    );
    setDeadlineEnabledDraft(groups.some((group) => Boolean(group.isMandatory && group.dueDate)));
  }, [enrolledGroups]);

  useEffect(() => {
    setShowAuthorSectionDraft(showAuthorSection);
  }, [showAuthorSection]);

  useEffect(() => {
    resetDeadlineDraft();
  }, [resetDeadlineDraft]);

  const openCertificateModal = () => {
    setShowCertificateModal(true);
  };

  const closeCertificateModal = () => {
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

  const transferOwner = async (userId: string) => {
    if (userId === course.authorId) return;

    await transferCourseOwnership({ courseId: course.id, userId });
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

  const enterLearningMode = () => {
    toggleLearningMode({ enabled: true });
  };

  const toggleDeadlineDraft = (enabled: boolean) => {
    setDeadlineEnabledDraft(enabled);
  };

  const toggleShowAuthorSectionDraft = (visible: boolean) => {
    setShowAuthorSectionDraft(visible);
  };

  const saveDeadlines = () => {
    updateGroupDeadlines(
      {
        groups: groupDeadlines.map((group) => ({
          id: group.id,
          isMandatory: group.isMandatory,
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

  const timeLeftSeconds = useMemo(
    () =>
      course.chapters
        .flatMap((chapter) => chapter.lessons)
        .filter((lesson) => lesson.status !== CHAPTER_PROGRESS_STATUSES.COMPLETED)
        .reduce((total, lesson) => total + (lesson.estimatedDurationSeconds ?? 0), 0),
    [course.chapters],
  );

  return (
    <div
      className={cn(
        "mb-4 grid gap-4 md:mb-6",
        getGridClassName({
          showAuthorCard,
          showCertificateCard,
          showDeadlineCard,
        }),
      )}
    >
      <ProgressStatCard
        completedChapterCount={course.completedChapterCount ?? 0}
        courseChapterCount={course.courseChapterCount}
        isAdminExperience={isAdminExperience}
        onEnterLearningMode={enterLearningMode}
        timeLeftSeconds={timeLeftSeconds}
      />

      {showDeadlineCard && (
        <DeadlineStatCard
          dueDate={deadlineDueDate}
          hasDeadline={hasDeadline}
          isAdminExperience={isAdminExperience}
          onOpen={openDeadlineModal}
        />
      )}

      {showCertificateCard && (
        <CertificateStatCard
          hasCertificate={hasCertificate}
          isAdminExperience={isAdminExperience}
          onOpen={openCertificateModal}
        />
      )}

      {showAuthorCard && (
        <AuthorStatCard
          author={author}
          isAdminExperience={isAdminExperience}
          onOpen={openAuthorModal}
          showAuthorSection={showAuthorSection}
        />
      )}

      {showCertificateModal && (
        <CertificateModal
          courseTitle={course.title}
          hasCertificate={hasCertificate}
          onClose={closeCertificateModal}
        />
      )}

      {showDeadlineModal && canManageDeadlines && (
        <DeadlineModal
          deadlineEnabledDraft={deadlineEnabledDraft}
          groupDeadlines={groupDeadlines}
          isSaving={isUpdatingDeadlines}
          onChangeGroupDeadlines={setGroupDeadlines}
          onClose={closeDeadlineModal}
          onSave={saveDeadlines}
          onToggleDeadline={toggleDeadlineDraft}
        />
      )}

      {showAuthorModal && (
        <AuthorModal
          author={author}
          canEditOwner={canEditOwner}
          courseOwnershipCandidates={courseOwnershipCandidates?.possibleCandidates}
          isAdminExperience={isAdminExperience}
          isSaving={isUpdatingAuthorSection}
          isTransferringOwner={isTransferringOwner}
          onClose={closeAuthorModal}
          onSave={saveAuthorSection}
          onTransferOwner={transferOwner}
          onToggleShowAuthorSection={toggleShowAuthorSectionDraft}
          otherCourses={otherCourses}
          showAuthorSectionDraft={showAuthorSectionDraft}
        />
      )}
    </div>
  );
}
