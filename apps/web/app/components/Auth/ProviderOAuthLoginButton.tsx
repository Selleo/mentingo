import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { Icon } from "../Icon";

import type { IconName } from "~/types/shared";

interface ProviderOAuthLoginButtonProps {
  iconName: IconName;
  buttonTextTranslationKey: string;
  handleSignIn: () => void;
  buttonClassName?: string;
}

export function ProviderOAuthLoginButton({
  iconName,
  buttonTextTranslationKey,
  handleSignIn,
  buttonClassName,
}: ProviderOAuthLoginButtonProps) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(buttonClassName, "mt-4 w-full")}
      onClick={handleSignIn}
    >
      <Icon name={iconName} className="mr-2 size-4" />
      {t(buttonTextTranslationKey)}
    </Button>
  );
}
