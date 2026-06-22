import { t } from "i18next";
import { CheckCircle2, CircleAlert } from "lucide-react";

import { Button } from "~/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { USERS_IMPORT_MODAL_HANDLES } from "../../../../../../e2e/data/users/handles";

import { ImportedUsersList } from "./ImportedUsersList";
import { SkippedUsersList } from "./SkippedUsersList";

import type { ImportUsersResponse } from "~/api/generated-api";

interface ImportUsersResultProps {
  onClose: () => void;
  importResult: ImportUsersResponse;
}

export const ImportUsersResult = ({ onClose, importResult }: ImportUsersResultProps) => {
  const {
    data: { skippedUsersAmount, importedUsersAmount, importedUsersList, skippedUsersList },
  } = importResult;
  const processedUsersAmount = importedUsersAmount + skippedUsersAmount;
  const defaultTab = importedUsersAmount > 0 ? "imported" : "skipped";

  return (
    <DialogContent
      data-testid={USERS_IMPORT_MODAL_HANDLES.RESULT}
      className="max-w-3xl gap-0 overflow-hidden p-0"
    >
      <DialogHeader>
        <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{t("adminUsersView.modal.title.importResult")}</DialogTitle>
              <p className="mt-1 text-sm text-neutral-600">
                {t("adminUsersView.modal.importResult.processed", {
                  count: processedUsersAmount,
                })}
              </p>
            </div>
          </div>
        </div>
      </DialogHeader>

      <div className="px-6 py-5">
        <Tabs className="w-full" defaultValue={defaultTab}>
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger
              data-testid={USERS_IMPORT_MODAL_HANDLES.RESULT_IMPORTED_TAB}
              value="imported"
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              {t("adminUsersView.modal.tabs.imported")}
              <span className="font-semibold">({importedUsersAmount})</span>
            </TabsTrigger>
            <TabsTrigger
              data-testid={USERS_IMPORT_MODAL_HANDLES.RESULT_SKIPPED_TAB}
              value="skipped"
              className="gap-2"
            >
              <CircleAlert className="size-4" />
              {t("adminUsersView.modal.tabs.skipped")}
              <span className="font-semibold">({skippedUsersAmount})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="imported" className="mt-4 min-h-52">
            <ImportedUsersList
              emptyText={t("adminUsersView.modal.description.noUsersImported")}
              emails={importedUsersList}
            />
          </TabsContent>
          <TabsContent value="skipped" className="mt-4 min-h-52">
            <SkippedUsersList
              emptyText={t("adminUsersView.modal.description.noUsersSkipped")}
              items={skippedUsersList.map(({ email, reason }) => ({
                email,
                reason: t(reason),
              }))}
            />
          </TabsContent>
        </Tabs>
      </div>

      <DialogFooter className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
        <Button data-testid={USERS_IMPORT_MODAL_HANDLES.RESULT_CLOSE} onClick={onClose}>
          {t("common.button.close")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
