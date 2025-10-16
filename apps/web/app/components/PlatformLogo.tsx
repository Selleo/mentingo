import { memo } from "react";

import { usePlatformSimpleLogo } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";
import { cn } from "~/lib/utils";

interface PlatformLogoProps {
  className?: string;
  variant?: "full" | "signet";
  alt?: string;
}

export const PlatformLogo = memo(
  ({ className, variant = "full", alt = "Platform Logo" }: PlatformLogoProps) => {
    const { data: customLogoUrl, isLoading } = usePlatformLogo();
    const { data: customSimpleLogoUrl, isLoading: isSimpleLogoLoading } = usePlatformSimpleLogo();

    if (isLoading) {
      return <div className={className}></div>;
    }

    if (customLogoUrl && !isLoading && variant === "full") {
      return (
        <img
          src={customLogoUrl}
          alt={alt}
          className={cn("object-contain", className)}
          loading="eager"
          decoding="async"
        />
      );
    }

    if (customSimpleLogoUrl && !isSimpleLogoLoading && variant === "signet") {
      return (
        <img
          src={customSimpleLogoUrl}
          alt={alt}
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
  },
);

PlatformLogo.displayName = "PlatformLogo";
