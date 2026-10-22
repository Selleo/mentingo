import { useTranslation } from "react-i18next";

import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

import { CreateLearningPathCard } from "./CreateLearningPathCard";

export function AdminLearningPathsCreatePanel() {
  const { t } = useTranslation();
  const {
    isCreateOpen,
    canCreateLearningPaths,
    createLanguage,
    setCreateLanguage,
    closeCreateCard,
    create,
    isCreatePending,
  } = useAdminLearningPathsPageContext();

  return (
    <Dialog
      open={isCreateOpen && canCreateLearningPaths}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isCreatePending) closeCreateCard();
      }}
    >
      <DialogContent
        noCloseButton
        aria-describedby={undefined}
        className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-transparent p-0 shadow-2xl sm:rounded-2xl"
      >
        <DialogTitle className="sr-only">
          {t("adminLearningPathsView.editor.createTitle")}
        </DialogTitle>
        <CreateLearningPathCard
          language={createLanguage}
          onLanguageChange={setCreateLanguage}
          onCancel={closeCreateCard}
          onCreate={create}
          isPending={isCreatePending}
        />
      </DialogContent>
    </Dialog>
  );
}
