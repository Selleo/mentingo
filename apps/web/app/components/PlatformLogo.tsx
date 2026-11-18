import { memo } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { usePlatformSimpleLogo } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";
import { cn } from "~/lib/utils";

interface PlatformLogoProps {
  className?: string;
  variant?: "full" | "signet";
  alt?: string;
}

export const PlatformLogo = memo(({ className, variant = "full", alt }: PlatformLogoProps) => {
  const { t } = useTranslation();
  const { data: customLogoUrl, isLoading } = usePlatformLogo();
  const { data: customSimpleLogoUrl, isLoading: isSimpleLogoLoading } = usePlatformSimpleLogo();

  if (isLoading) {
    return <div className={className}></div>;
  }

  const customLogoSrc = match(variant)
    .with("full", () => customLogoUrl)
    .with("signet", () => (isSimpleLogoLoading ? null : customSimpleLogoUrl))
    .exhaustive();

  if (customLogoSrc) {
    return (
      <img
        src={customLogoSrc}
        alt={alt ?? t("a11y.platformLogo")}
        className={cn("object-contain", className)}
        loading="eager"
        decoding="async"
      />
    );
  }

  if (variant === "signet") {
    return <Icon name="AppSignet" className={className} />;
  }

  return <Icon name="AppLogo" className={className} />;
});

PlatformLogo.displayName = "PlatformLogo";
