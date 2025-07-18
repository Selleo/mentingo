import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { Icon } from "../Icon";

interface GoogleOAuthButtonProps {
  text?: string;
  className?: string;
}

export function GoogleOAuthButton({ text, className = "mt-4 w-full" }: GoogleOAuthButtonProps) {
  const { t } = useTranslation();

  const handleGoogleSignIn = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`;
  };

  return (
    <Button type="button" variant="outline" className={className} onClick={handleGoogleSignIn}>
      <Icon name="Google" className="mr-2 h-4 w-4" />
      {text || t("common.continueWithGoogle")}
    </Button>
  );
}
