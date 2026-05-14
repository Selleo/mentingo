import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

import { CreateLearningPathCard } from "./CreateLearningPathCard";

export function AdminLearningPathsCreatePanel() {
  const {
    createCardRef,
    createLanguage,
    setCreateLanguage,
    closeCreateCard,
    create,
    isCreatePending,
  } = useAdminLearningPathsPageContext();

  return (
    <div ref={createCardRef}>
      <CreateLearningPathCard
        language={createLanguage}
        onLanguageChange={setCreateLanguage}
        onCancel={closeCreateCard}
        onCreate={create}
        isPending={isCreatePending}
      />
    </div>
  );
}
