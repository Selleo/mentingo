import { useSearchParams } from "@remix-run/react";

import { useEnrollCurrentUserToLearningPath } from "~/api/mutations/useLearningPathMutations";
import { useSuspenseInfiniteLearningPaths } from "~/api/queries/useLearningPaths";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

export function useStudentLearningPathsPage() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("searchQuery") ?? "";

  const language = useLanguageStore((state) => state.language);

  const {
    data: learningPathsData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useSuspenseInfiniteLearningPaths({
    language,
    searchQuery,
  });
  const learningPathPages = learningPathsData.pages;

  const { mutateAsync: enrollCurrentUserToLearningPath, isPending: isEnrollPending } =
    useEnrollCurrentUserToLearningPath();

  const enrollLearningPath = async (learningPathId: string) => {
    await enrollCurrentUserToLearningPath(learningPathId);
  };

  return {
    language,
    learningPathPages,
    totalPaths: learningPathPages[0]?.pagination.totalItems ?? 0,
    hasNextLearningPathsPage: hasNextPage,
    isFetchingNextLearningPathsPage: isFetchingNextPage,
    loadNextLearningPathsPage: () => void fetchNextPage(),
    enrollLearningPath,
    isEnrollPending,
  };
}
