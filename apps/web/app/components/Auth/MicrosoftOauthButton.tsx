import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { Icon } from "../Icon";

interface MicrosoftOAuthButtonProps {
  text?: string;
  className?: string;
}

export function MicrosoftOAuthButton({
  text,
  className = "mt-4 w-full",
}: MicrosoftOAuthButtonProps) {
  const { t } = useTranslation();

  const handleMicrosoftSignIn = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/microsoft`;
  };

  return (
    <Button type="button" variant="outline" className={className} onClick={handleMicrosoftSignIn}>
      <Icon name="Microsoft" className="mr-2 h-4 w-4" />
      {text || t("common.continueWithMicrosoft")}
    </Button>
  );
}
