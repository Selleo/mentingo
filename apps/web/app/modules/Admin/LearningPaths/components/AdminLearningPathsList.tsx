import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

import { AdminLearningPathCard } from "./AdminLearningPathCard";
import { AdminLearningPathsCreateButton } from "./AdminLearningPathsCreateButton";
import { AdminLearningPathsCreatePanel } from "./AdminLearningPathsCreatePanel";

export function AdminLearningPathsList() {
  const { learningPaths, isCreateOpen, canCreateLearningPaths } =
    useAdminLearningPathsPageContext();

  return (
    <div className="flex flex-col gap-4">
      {learningPaths.data.map((learningPath) => (
        <AdminLearningPathCard key={learningPath.id} learningPath={learningPath} />
      ))}

      {isCreateOpen && canCreateLearningPaths && <AdminLearningPathsCreatePanel />}

      {canCreateLearningPaths && !isCreateOpen && <AdminLearningPathsCreateButton />}
    </div>
  );
}
