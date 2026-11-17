import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateIntegrationApiKey } from "~/api/mutations/admin/useCreateIntegrationApiKey";
import { useIntegrationApiKeys } from "~/api/queries/admin/useIntegrationApiKeys";
import { DataTable } from "~/components/DataTable";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { copyToClipboard } from "~/utils/copyToClipboard";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";

import { getIntegrationApiKeysColumns } from "./integrationApiKeys.columns";

const KEY_NAME_MAX_LENGTH = 100;

function CreateIntegrationApiKeyDialog({ onCreated }: { onCreated: (rawKey: string) => void }) {
  const { t } = useTranslation();
  const { mutateAsync: createKey, isPending } = useCreateIntegrationApiKey();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");

  const trimmedName = name.trim();

  const createNamedKey = async () => {
    const { key } = await createKey({ name: trimmedName });

    onCreated(key);
    setName("");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid={SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CREATE}>
          {t("integrationApiKey.create.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("integrationApiKey.create.title")}</DialogTitle>
          <DialogDescription>{t("integrationApiKey.create.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="integration-api-key-name">
            {t("integrationApiKey.create.nameLabel")}
          </Label>
          <Input
            id="integration-api-key-name"
            value={name}
            maxLength={KEY_NAME_MAX_LENGTH}
            placeholder={t("integrationApiKey.create.namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
            data-testid={SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_NAME_INPUT}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t("common.button.cancel")}
          </Button>
          <Button
            onClick={createNamedKey}
            disabled={!trimmedName || isPending}
            data-testid={SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CONFIRM_CREATE}
          >
            {t("integrationApiKey.create.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IntegrationApiKeysCard() {
  const { t } = useTranslation();
  const { data: apiKeys, isLoading } = useIntegrationApiKeys();
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const columns = useMemo(() => getIntegrationApiKeysColumns(t), [t]);
  const table = useReactTable({
    data: apiKeys ?? [],
    columns,
    getRowId: (apiKey) => apiKey.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card id="integration-api-key" data-testid={SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_CARD}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="h5">{t("integrationApiKey.title")}</CardTitle>
          <CardDescription className="body-lg-md">
            {t("integrationApiKey.description")}
          </CardDescription>
        </div>
        <CreateIntegrationApiKeyDialog onCreated={setCreatedKey} />
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        {createdKey && (
          <div
            className="mx-6 space-y-3 rounded-lg border border-primary-200 bg-primary-50 p-4"
            data-testid={SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEY_GENERATED}
          >
            <p className="text-sm font-medium">{t("integrationApiKey.generated.title")}</p>
            <p className="break-all text-xs md:text-sm">{createdKey}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  copyToClipboard(
                    createdKey,
                    t("integrationApiKey.toast.copySuccess"),
                    t("integrationApiKey.toast.copyError"),
                  )
                }
              >
                {t("integrationApiKey.copy")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreatedKey(null)}>
                {t("integrationApiKey.generated.dismiss")}
              </Button>
            </div>
          </div>
        )}

        <DataTable
          table={table}
          testId={SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEYS_TABLE}
          getRowTestId={(apiKey) => SETTINGS_PAGE_HANDLES.integrationApiKeyRow(apiKey.id)}
          emptyState={
            isLoading ? (
              <p className="py-10 text-center text-sm text-neutral-600">
                {t("integrationApiKey.loading")}
              </p>
            ) : (
              <div
                className="flex flex-col items-center gap-1 py-10 text-center"
                data-testid={SETTINGS_PAGE_HANDLES.INTEGRATION_API_KEYS_EMPTY}
              >
                <p className="body-sm-md text-neutral-950">{t("integrationApiKey.table.empty")}</p>
                <p className="details text-neutral-700">{t("integrationApiKey.table.emptyHint")}</p>
              </div>
            )
          }
        />
      </CardContent>
    </Card>
  );
}
