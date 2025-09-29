import { useTranslation } from "react-i18next";

import { ProviderOAuthLoginButton } from "~/components/Auth/ProviderOAuthLoginButton";

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

  const baseUrl = import.meta.env.VITE_APP_URL || "http://localhost:5173";

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

      {isGoogleOAuthEnabled && (
        <ProviderOAuthLoginButton
          iconName="Google"
          buttonTextTranslationKey="common.continueWithGoogle"
          handleSignIn={handleProviderSignIn("google")}
        />
      )}
      {isMicrosoftOAuthEnabled && (
        <ProviderOAuthLoginButton
          iconName="Microsoft"
          buttonTextTranslationKey="common.continueWithMicrosoft"
          handleSignIn={handleProviderSignIn("microsoft")}
        />
      )}
      {isSlackOAuthEnabled && (
        <ProviderOAuthLoginButton
          iconName="Slack"
          buttonTextTranslationKey="common.continueWithSlack"
          handleSignIn={handleProviderSignIn("slack")}
        />
      )}
    </>
  );
}
