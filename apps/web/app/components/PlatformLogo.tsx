import { memo } from "react";

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

    if (customLogoUrl && !isLoading) {
      return (
        <img
          src={customLogoUrl}
          alt={alt}
          className={cn("object-contain", className)}
          loading="eager"
          decoding="async"
          onError={(e) => {
            console.warn("Custom logo failed to load:", customLogoUrl);
            e.currentTarget.style.display = "none";
          }}
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
