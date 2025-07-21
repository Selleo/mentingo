import { useTranslation } from "react-i18next";

import { GoogleOAuthButton } from "~/components/Auth/GoogleOAuthButton";
import { MicrosoftOAuthButton } from "~/components/Auth/MicrosoftOauthButton";

interface SocialLoginProps {
  isGoogleOAuthEnabled?: boolean;
  isMicrosoftOAuthEnabled?: boolean;
}

export function SocialLogin({ isGoogleOAuthEnabled, isMicrosoftOAuthEnabled }: SocialLoginProps) {
  const { t } = useTranslation();

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

      {isGoogleOAuthEnabled && <GoogleOAuthButton />}
      {isMicrosoftOAuthEnabled && <MicrosoftOAuthButton />}
    </>
  );
}
