import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PlatformLogo } from "~/components/PlatformLogo";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

type MagicLinkVerificationCardProps = {
  statusMessage: string;
  isPending: boolean;
  isError: boolean;
  onBack?: () => void;
  backgroundUrl?: string | null;
};

export function MagicLinkVerificationCard({
  statusMessage,
  isPending,
  isError,
  onBack,
  backgroundUrl,
}: MagicLinkVerificationCardProps) {
  const { t } = useTranslation();

  return (
    <>
      {backgroundUrl && (
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${backgroundUrl}) `,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle role="heading" className="text-2xl">
            <div className="mb-6 flex justify-center">
              <PlatformLogo className="h-16 w-auto py-3" alt="Platform Logo" />
            </div>
            {t("loginView.header")}
          </CardTitle>
          <CardDescription>{t("loginView.magicLink.subHeader")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border border-dashed border-muted p-4">
            <Loader2
              className={`h-5 w-5 ${isPending ? "animate-spin" : ""} text-primary shrink-0`}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{statusMessage}</p>
            </div>
            {isError && (
              <Button onClick={onBack} variant="secondary" size="sm">
                {t("loginView.magicLink.backToLogin")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default MagicLinkVerificationCard;
