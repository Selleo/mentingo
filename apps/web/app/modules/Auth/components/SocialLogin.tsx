import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { ProviderOAuthLoginButton } from "~/components/Auth/ProviderOAuthLoginButton";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { baseUrl } from "~/utils/baseUrl";

interface SocialLoginProps {
  isSSOEnforced?: boolean;
  isGoogleOAuthEnabled?: boolean;
  isMicrosoftOAuthEnabled?: boolean;
  isSlackOAuthEnabled?: boolean;
}

export function SocialLogin({
  isSSOEnforced,
  isGoogleOAuthEnabled,
  isMicrosoftOAuthEnabled,
  isSlackOAuthEnabled,
}: SocialLoginProps) {
  const { t } = useTranslation();

  const handleProviderSignIn = (provider: string) => () =>
    (window.location.href = `${baseUrl}/api/auth/${provider}`);

  return (
    <>
      {!isSSOEnforced && (
        <div className="relative mt-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t("loginView.other.orContinueWith")}
            </span>
          </div>
        </div>
      )}

      <Button type="button" variant="outline" className="mt-4 w-full" asChild>
        <Link to="/auth/magic-link">
          <Icon name="WandSparkles" className="mr-2 size-4" />
          {t("loginView.other.useMagicLink")}
        </Link>
      </Button>

      {isGoogleOAuthEnabled && (
        <ProviderOAuthLoginButton
          iconName="Google"
          buttonTextTranslationKey="common.continueWithGoogle"
          handleSignIn={handleProviderSignIn("google")}
          testId="google-sso"
        />
      )}
      {isMicrosoftOAuthEnabled && (
        <ProviderOAuthLoginButton
          iconName="Microsoft"
          buttonTextTranslationKey="common.continueWithMicrosoft"
          handleSignIn={handleProviderSignIn("microsoft")}
          testId="microsoft-sso"
        />
      )}
      {isSlackOAuthEnabled && (
        <ProviderOAuthLoginButton
          iconName="Slack"
          buttonTextTranslationKey="common.continueWithSlack"
          handleSignIn={handleProviderSignIn("slack")}
          testId="slack-sso"
        />
      )}
    </>
  );
}
