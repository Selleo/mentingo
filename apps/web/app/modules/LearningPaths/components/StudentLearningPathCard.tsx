import { InlineLearningPathCard } from "./InlineLearningPathCard";

import type { LearningPathListItem } from "./learningPaths.types";
import type { SupportedLanguages } from "@repo/shared";

type StudentLearningPathCardProps = {
  learningPath: LearningPathListItem;
  language: SupportedLanguages;
  isPending: boolean;
  onEnroll: (learningPathId: string) => Promise<void>;
  canSelfEnroll: boolean;
  showCourseProgress: boolean;
};

export function StudentLearningPathCard({
  learningPath,
  language,
  isPending,
  onEnroll,
  canSelfEnroll,
  showCourseProgress,
}: StudentLearningPathCardProps) {
  return (
    <InlineLearningPathCard
      learningPath={learningPath}
      canEdit={false}
      canUpdateCourses={false}
      canDelete={false}
      canManageEnrollment={false}
      groupOptions={[]}
      currentLanguage={language}
      selectedLanguage={language}
      onLanguageChange={() => {}}
      onUpdate={async () => {}}
      onDelete={() => {}}
      onAddCourses={async () => {}}
      onRemoveCourse={async () => {}}
      onReorderCourses={async () => {}}
      onEnrollCurrentUser={canSelfEnroll ? () => onEnroll(learningPath.id) : undefined}
      isPending={isPending}
      showCertificate
      showCourseProgress={showCourseProgress}
    />
  );
}
