import { Ban } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useRevokeIntegrationApiKey } from "~/api/mutations/admin/useRevokeIntegrationApiKey";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";

import type { IntegrationApiKeyRow } from "./integrationApiKeys.columns";

export function RevokeIntegrationApiKeyDialog({ apiKey }: { apiKey: IntegrationApiKeyRow }) {
  const { t } = useTranslation();
  const { mutateAsync: revokeKey, isPending } = useRevokeIntegrationApiKey();
  const [isOpen, setIsOpen] = useState(false);

  const revokeThisKey = async () => {
    await revokeKey(apiKey.id);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2 text-error-700 hover:bg-error-50 hover:text-error-800"
          data-testid={SETTINGS_PAGE_HANDLES.integrationApiKeyRevoke(apiKey.id)}
        >
          <Ban className="size-4" aria-hidden="true" />
          {t("integrationApiKey.revoke.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("integrationApiKey.revoke.title", { name: apiKey.name })}</DialogTitle>
          <DialogDescription>{t("integrationApiKey.revoke.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t("common.button.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={revokeThisKey}
            disabled={isPending}
            data-testid={SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CONFIRM_REVOKE}
          >
            {t("integrationApiKey.revoke.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
