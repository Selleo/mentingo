import { InlineLearningPathCard } from "./InlineLearningPathCard";

import type { LearningPathListItem } from "./learningPaths.types";
import type { SupportedLanguages } from "@repo/shared";

type StudentLearningPathCardProps = {
  learningPath: LearningPathListItem;
  language: SupportedLanguages;
  isPending: boolean;
  onEnroll: (learningPathId: string) => Promise<void>;
};

export function StudentLearningPathCard({
  learningPath,
  language,
  isPending,
  onEnroll,
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
      onEnrollCurrentUser={() => onEnroll(learningPath.id)}
      isPending={isPending}
      showCertificate
    />
  );
}
