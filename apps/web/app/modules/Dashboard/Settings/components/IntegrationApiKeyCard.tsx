import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useRotateIntegrationApiKey } from "~/api/mutations/admin/useRotateIntegrationApiKey";
import { useIntegrationApiKey } from "~/api/queries/admin/useIntegrationApiKey";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { copyToClipboard } from "~/utils/copyToClipboard";

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
}

export function IntegrationApiKeyCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useIntegrationApiKey();
  const { mutateAsync: rotateKey, isPending } = useRotateIntegrationApiKey();
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const activeKey = data?.key ?? null;

  const rotate = async () => {
    const result = await rotateKey();
    setGeneratedKey(result.key);
    setIsDialogOpen(false);
  };

  return (
    <Card id="integration-api-key">
      <CardHeader>
        <CardTitle className="h5">{t("integrationApiKey.title")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("integrationApiKey.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">{t("integrationApiKey.status")}</p>
            <p className="text-sm font-medium">
              {activeKey ? t("integrationApiKey.active") : t("integrationApiKey.inactive")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("integrationApiKey.prefix")}</p>
            <p className="text-sm font-medium">{activeKey?.keyPrefix ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("integrationApiKey.createdAt")}</p>
            <p className="text-sm font-medium">{formatDate(activeKey?.createdAt ?? null)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("integrationApiKey.lastUsedAt")}</p>
            <p className="text-sm font-medium">{formatDate(activeKey?.lastUsedAt ?? null)}</p>
          </div>
        </div>

        {generatedKey && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 space-y-3">
            <p className="text-sm font-medium">{t("integrationApiKey.generated.title")}</p>
            <p className="break-all text-xs md:text-sm">{generatedKey}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                copyToClipboard(
                  generatedKey,
                  t("integrationApiKey.toast.copySuccess"),
                  t("integrationApiKey.toast.copyError"),
                )
              }
            >
              {t("integrationApiKey.copy")}
            </Button>
          </div>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">{t("integrationApiKey.loading")}</p>
        )}
      </CardContent>
      <CardFooter className="border-t py-4">
        {activeKey ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={isPending}>{t("integrationApiKey.override")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("integrationApiKey.confirm.title")}</DialogTitle>
                <DialogDescription>{t("integrationApiKey.confirm.description")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t("common.button.cancel")}
                </Button>
                <Button onClick={rotate} disabled={isPending}>
                  {t("integrationApiKey.confirm.action")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button disabled={isPending} onClick={rotate}>
            {t("integrationApiKey.generate")}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
