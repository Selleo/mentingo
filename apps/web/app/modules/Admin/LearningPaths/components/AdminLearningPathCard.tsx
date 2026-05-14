import { InlineLearningPathCard } from "~/modules/LearningPaths/components/InlineLearningPathCard";

import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

import type { LearningPathListItem } from "../types";

type AdminLearningPathCardProps = {
  learningPath: LearningPathListItem;
};

export function AdminLearningPathCard({ learningPath }: AdminLearningPathCardProps) {
  const {
    appLanguage,
    groupOptions,
    getSelectedLanguage,
    setPathLanguage,
    canEditLearningPath,
    canUpdateLearningPathCourses,
    canDeleteLearningPaths,
    canManageLearningPathEnrollment,
    canExportLearningPath,
    updateLearningPath,
    deleteLearningPath,
    addCoursesToLearningPath,
    removeCourseFromLearningPath,
    reorderLearningPathCourses,
    enrollUsersToLearningPath,
    enrollGroupsToLearningPath,
    unenrollUsersFromLearningPath,
    unenrollGroupsFromLearningPath,
    isMutationPending,
  } = useAdminLearningPathsPageContext();

  const selectedLanguage = getSelectedLanguage(learningPath.id);

  return (
    <InlineLearningPathCard
      learningPath={learningPath}
      canEdit={canEditLearningPath(learningPath)}
      canUpdateCourses={canUpdateLearningPathCourses(learningPath)}
      canDelete={canDeleteLearningPaths}
      canManageEnrollment={canManageLearningPathEnrollment}
      canExport={canExportLearningPath}
      currentLanguage={appLanguage}
      selectedLanguage={selectedLanguage}
      onLanguageChange={(language) => setPathLanguage(learningPath.id, language)}
      onUpdate={async (data) => {
        await updateLearningPath({ learningPathId: learningPath.id, data });
      }}
      onDelete={() => deleteLearningPath(learningPath.id)}
      onAddCourses={async (courseIds) => {
        await addCoursesToLearningPath({
          learningPathId: learningPath.id,
          data: { courseIds },
        });
      }}
      onRemoveCourse={async (courseId) => {
        await removeCourseFromLearningPath({ learningPathId: learningPath.id, courseId });
      }}
      onReorderCourses={async (courseIds) => {
        await reorderLearningPathCourses({
          learningPathId: learningPath.id,
          data: { courseIds },
        });
      }}
      onEnrollStudents={async (studentIds) => {
        await enrollUsersToLearningPath({
          learningPathId: learningPath.id,
          data: { studentIds },
        });
      }}
      onEnrollGroups={async (groupIds) => {
        await enrollGroupsToLearningPath({
          learningPathId: learningPath.id,
          data: { groupIds },
        });
      }}
      onUnenrollStudents={async (studentIds) => {
        await unenrollUsersFromLearningPath({
          learningPathId: learningPath.id,
          data: { studentIds },
        });
      }}
      onUnenrollGroups={async (groupIds) => {
        await unenrollGroupsFromLearningPath({
          learningPathId: learningPath.id,
          data: { groupIds },
        });
      }}
      groupOptions={groupOptions}
      isPending={isMutationPending}
      showCourseProgress={false}
    />
  );
}
