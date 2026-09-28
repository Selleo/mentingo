import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { NativeArchiveImport } from "~/modules/Admin/AddCourse/components/NativeArchiveImport";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../../e2e/data/learning-paths/handles";
import { LearningPathsSearchInput } from "../../../LearningPaths/components/LearningPathsSearchInput";
import { useAdminLearningPathsPageContext } from "../context/AdminLearningPathsPageContext";

export function AdminLearningPathsHeader() {
  const { t } = useTranslation();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportWorking, setIsImportWorking] = useState(false);
  const { totalPaths, canCreateLearningPaths, canImportLearningPaths, openCreateCard } =
    useAdminLearningPathsPageContext();

  const closeImport = () => {
    setIsImportWorking(false);
    setIsImportOpen(false);
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col lg:p-0">
        <h4 className="h4 pb-1 text-neutral-950" data-testid={LEARNING_PATHS_PAGE_HANDLES.HEADING}>
          {t("adminLearningPathsView.title")}
        </h4>
        <p className="body-lg-md text-neutral-800">{t("adminLearningPathsView.description")}</p>
        <p className="details-md mt-1 text-neutral-600">
          {t("adminLearningPathsView.summary", { count: totalPaths })}
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <LearningPathsSearchInput />
        {canImportLearningPaths && (
          <Dialog
            open={isImportOpen}
            onOpenChange={(open) => {
              if (isImportWorking && !open) return;
              setIsImportOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
                <Upload className="size-4" />
                {t("adminLearningPathsView.importPackage.title")}
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[90vh] max-w-xl overflow-y-auto"
              aria-describedby={undefined}
              noCloseButton={isImportWorking}
            >
              <DialogHeader>
                <DialogTitle>{t("adminLearningPathsView.importPackage.title")}</DialogTitle>
              </DialogHeader>
              <NativeArchiveImport
                onCancel={closeImport}
                onComplete={closeImport}
                onWorkingChange={setIsImportWorking}
              />
            </DialogContent>
          </Dialog>
        )}
        {canCreateLearningPaths && (
          <Button type="button" variant="primary" className="gap-2" onClick={openCreateCard}>
            <Plus className="size-4" />
            {t("adminLearningPathsView.buttons.create")}
          </Button>
        )}
      </div>
    </div>
  );
}
