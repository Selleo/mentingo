import { Link, useSearchParams } from "@remix-run/react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useMcpConsent } from "~/api/queries/useMcpConsent";
import { PlatformLogo } from "~/components/PlatformLogo";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export default function McpConsentPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const consent = searchParams.get("consent");
  const { data, isLoading, error } = useMcpConsent(consent);
  const { data: settings } = useGlobalSettings();
  const signInRequired = isAxiosError(error) && error.response?.status === 401;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      {settings?.loginBackgroundImageS3Key && (
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: `url(${settings.loginBackgroundImageS3Key})` }}
        />
      )}
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-6 flex justify-center">
            <PlatformLogo className="h-16 w-auto py-3" alt={t("mcpConnection.platformLogo")} />
          </div>
          <CardTitle className="text-2xl">
            {data
              ? t("mcpConnection.title", { clientName: data.clientName })
              : t("mcpConnection.unavailableTitle")}
          </CardTitle>
          {data && <CardDescription>{t("mcpConnection.description")}</CardDescription>}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">{t("mcpConnection.loading")}</p>
          )}
          {!isLoading && !data && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t(signInRequired ? "mcpConnection.signInRequired" : "mcpConnection.unavailable")}
              </p>
              {signInRequired && (
                <Button asChild>
                  <Link to="/auth/login">{t("mcpConnection.signIn")}</Link>
                </Button>
              )}
            </div>
          )}
          {data && consent && (
            <>
              <p className="text-sm text-muted-foreground">
                {t("mcpConnection.signedInAs", { email: data.accountEmail })}
              </p>
              <form
                method="post"
                action="/api/oauth/authorize"
                className="mt-8 flex justify-end gap-3"
              >
                <input type="hidden" name="consent" value={consent} />
                <Button type="submit" name="decision" value="deny" variant="outline">
                  {t("mcpConnection.deny")}
                </Button>
                <Button type="submit" name="decision" value="approve">
                  {t("mcpConnection.allow")}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
