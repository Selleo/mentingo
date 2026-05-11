import { useLoaderData } from "@remix-run/react";
import { useState } from "react";

import { useEnrollCurrentUserToLearningPath } from "~/api/mutations/useLearningPathMutations";
import { useLearningPaths } from "~/api/queries/useLearningPaths";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { GetLearningPathsResponse } from "~/api/generated-api";

export function useStudentLearningPathsPage() {
  const loaderLearningPaths = useLoaderData<GetLearningPathsResponse>();

  const language = useLanguageStore((state) => state.language);

  const [searchValue, setSearchValue] = useState("");

  const { data: learningPaths = loaderLearningPaths } = useLearningPaths({
    language,
    searchQuery: searchValue.trim() || undefined,
  });

  const { mutateAsync: enrollCurrentUserToLearningPath, isPending: isEnrollPending } =
    useEnrollCurrentUserToLearningPath();

  const enrollLearningPath = async (learningPathId: string) => {
    await enrollCurrentUserToLearningPath(learningPathId);
  };

  return {
    language,
    learningPaths,
    searchValue,
    setSearchValue,
    enrollLearningPath,
    isEnrollPending,
  };
}
