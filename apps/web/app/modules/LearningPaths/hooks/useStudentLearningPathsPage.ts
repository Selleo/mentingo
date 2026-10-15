import { useSearchParams } from "@remix-run/react";

import { useEnrollCurrentUserToLearningPath } from "~/api/mutations/useLearningPathMutations";
import { useLearningPathsSuspense } from "~/api/queries/useLearningPaths";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

export function useStudentLearningPathsPage() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("searchQuery") ?? "";

  const language = useLanguageStore((state) => state.language);

  const { data: learningPaths } = useLearningPathsSuspense({
    language,
    searchQuery,
  });

  const { mutateAsync: enrollCurrentUserToLearningPath, isPending: isEnrollPending } =
    useEnrollCurrentUserToLearningPath();

  const enrollLearningPath = async (learningPathId: string) => {
    await enrollCurrentUserToLearningPath(learningPathId);
  };

  return {
    language,
    learningPaths,
    enrollLearningPath,
    isEnrollPending,
  };
}
