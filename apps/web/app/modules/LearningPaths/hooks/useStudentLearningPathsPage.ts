import { useLoaderData, useSearchParams } from "@remix-run/react";

import { useEnrollCurrentUserToLearningPath } from "~/api/mutations/useLearningPathMutations";
import { useLearningPaths } from "~/api/queries/useLearningPaths";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { GetLearningPathsResponse } from "~/api/generated-api";

export function useStudentLearningPathsPage() {
  const loaderLearningPaths = useLoaderData<GetLearningPathsResponse>();

  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("searchQuery") ?? "";

  const language = useLanguageStore((state) => state.language);

  const { data: learningPaths = loaderLearningPaths } = useLearningPaths({
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
