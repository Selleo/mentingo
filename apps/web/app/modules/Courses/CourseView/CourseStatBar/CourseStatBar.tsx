import { useCallback, useEffect, useMemo, useState } from "react";

import { useToggleCourseStudentMode } from "~/api/mutations";
import { useBulkGroupCourseEnroll } from "~/api/mutations/admin/useBulkGroupCourseEnroll";
import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { useGroupsByCourseQuery } from "~/api/queries/admin/useGroupsByCourse";
import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
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

export function CourseStatBar({ language }: CourseHeroProps) {
  const { course, canEditCourse, isAdminExperience } = useCourseAccessProvider();

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

  const { data: enrolledGroups } = useGroupsByCourseQuery(canEditCourse ? course.id : "", language);
  const groupDeadlineDueDate = enrolledGroups
    ?.filter((group) => group.isMandatory && group.dueDate)
    .map((group) => group.dueDate)
    .sort()[0];
  const deadlineDueDate = groupDeadlineDueDate ?? course.dueDate;
  const hasDeadline = Boolean(deadlineDueDate);

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
          hasAuthor,
          hasCertificate,
          hasDeadline,
          isAdminExperience,
          showAuthorSection,
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

      {(isAdminExperience || hasDeadline) && (
        <DeadlineStatCard
          dueDate={deadlineDueDate}
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
          courseTitle={course.title}
          hasCertificate={hasCertificate}
          onClose={closeCertificateModal}
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
          onToggleDeadline={toggleDeadlineDraft}
        />
      )}

      {showAuthorModal && (
        <AuthorModal
          author={author}
          isAdminExperience={isAdminExperience}
          isSaving={isUpdatingAuthorSection}
          onClose={closeAuthorModal}
          onSave={saveAuthorSection}
          onToggleShowAuthorSection={toggleShowAuthorSectionDraft}
          otherCourses={otherCourses}
          showAuthorSectionDraft={showAuthorSectionDraft}
        />
      )}
    </div>
  );
}
