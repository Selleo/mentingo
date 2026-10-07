import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export function PhishingLoading() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{t("phishing.loading")}</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function PhishingError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col items-start gap-3">
        {t("phishing.serviceError")}
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            {t("phishing.retry")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function PhishingEmpty({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-8 text-center text-muted-foreground">{message}</CardContent>
    </Card>
  );
}
