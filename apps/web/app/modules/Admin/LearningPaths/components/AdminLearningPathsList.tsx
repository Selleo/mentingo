import { LEARNING_PATHS_PAGE_SIZE } from "~/api/queries/useLearningPaths";
import { LearningPathsMasonry } from "~/modules/LearningPaths/components/LearningPathsMasonry";
import { LearningPathsNextPageLoader } from "~/modules/LearningPaths/components/LearningPathsNextPageLoader";

import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

import { AdminLearningPathCard } from "./AdminLearningPathCard";
import { AdminLearningPathsCreateButton } from "./AdminLearningPathsCreateButton";

export function AdminLearningPathsList() {
  const {
    learningPathPages,
    canCreateLearningPaths,
    hasNextLearningPathsPage,
    isFetchingNextLearningPathsPage,
    loadNextLearningPathsPage,
  } = useAdminLearningPathsPageContext();

  const shouldShowCreateTile = canCreateLearningPaths && !hasNextLearningPathsPage;

  return (
    <div className="flex flex-col">
      <LearningPathsMasonry
        batchSize={LEARNING_PATHS_PAGE_SIZE}
        batches={learningPathPages.map((learningPathPage) => ({
          key: `learning-paths-page-${learningPathPage.pagination.page}`,
          items: learningPathPage.data.map((learningPath) => (
            <AdminLearningPathCard key={learningPath.id} learningPath={learningPath} />
          )),
        }))}
        trailingItem={shouldShowCreateTile ? <AdminLearningPathsCreateButton /> : undefined}
      />
      <LearningPathsNextPageLoader
        hasNextPage={hasNextLearningPathsPage}
        isFetchingNextPage={isFetchingNextLearningPathsPage}
        onLoadNextPage={loadNextLearningPathsPage}
      />
    </div>
  );
}
