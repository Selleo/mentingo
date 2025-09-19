import { t } from "i18next";

import { Button } from "~/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import type { ImportUsersResponse } from "~/api/generated-api";

interface ImportUsersResultProps {
  onClose: () => void;
  importResult: ImportUsersResponse;
}

export const ImportUsersResult = ({ onClose, importResult }: ImportUsersResultProps) => {
  const {
    data: { skippedUsersAmount, importedUsersAmount, importedUsersList, skippedUsersList },
  } = importResult;

  return (
    <DialogContent className="gap-2">
      <DialogHeader>
        <DialogTitle>{t("adminUsersView.modal.title.importResult")}</DialogTitle>
      </DialogHeader>

      <Tabs className="mt-4 w-full" defaultValue="imported">
        <TabsList className="flex">
          <TabsTrigger value="imported" className="grow">
            {t("adminUsersView.modal.tabs.imported")}
            <span className="font-semibold"> ({importedUsersAmount})</span>
          </TabsTrigger>
          <TabsTrigger value="skipped" className="grow">
            {t("adminUsersView.modal.tabs.skipped")}
            <span className="font-semibold"> ({skippedUsersAmount})</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="imported" className="mt-4 min-h-10">
          {importedUsersAmount > 0 ? (
            <ScrollArea className="h-40 w-full">
              <ol className="list-decimal pl-10">
                {importedUsersList.map((email) => (
                  <li key={email}>{email}</li>
                ))}
              </ol>
            </ScrollArea>
          ) : (
            <p className="w-full text-center">
              {t("adminUsersView.modal.description.noUsersImported")}
            </p>
          )}
        </TabsContent>
        <TabsContent value="skipped" className="mt-4 min-h-10">
          {skippedUsersAmount > 0 ? (
            <ScrollArea className="h-40 w-full">
              <ol className="list-decimal pl-10">
                {skippedUsersList.map(({ email, reason }) => (
                  <li key={email}>
                    <span className="font-semibold">{email}</span> -{" "}
                    <span className="italic">{t(reason)}</span>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          ) : (
            <p className="w-full text-center">
              {t("adminUsersView.modal.description.noUsersSkipped")}
            </p>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter className="mt-4">
        <Button onClick={onClose}>{t("common.button.close")}</Button>
      </DialogFooter>
    </DialogContent>
  );
};
