import { useTranslation } from "react-i18next";

import { ProviderOAuthLoginButton } from "~/components/Auth/ProviderOAuthLoginButton";

interface SocialLoginProps {
  isGoogleOAuthEnabled?: boolean;
  isMicrosoftOAuthEnabled?: boolean;
}

export function SocialLogin({ isGoogleOAuthEnabled, isMicrosoftOAuthEnabled }: SocialLoginProps) {
  const { t } = useTranslation();

  const handleGoogleSignIn = () =>
    (window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`);

  const handleMicrosoftSignIn = () =>
    (window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/microsoft`);

  return (
    <>
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

      {isGoogleOAuthEnabled && (
        <ProviderOAuthLoginButton
          iconName="Google"
          buttonTextTranslationKey="common.continueWithGoogle"
          handleSignIn={handleGoogleSignIn}
        />
      )}
      {isMicrosoftOAuthEnabled && (
        <ProviderOAuthLoginButton
          iconName="Microsoft"
          buttonTextTranslationKey="common.continueWithMicrosoft"
          handleSignIn={handleMicrosoftSignIn}
        />
      )}
    </>
  );
}
