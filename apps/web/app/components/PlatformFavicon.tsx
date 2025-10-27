import { useEffect } from "react";

import { usePlatformSimpleLogo } from "../api/queries/usePlatformSimpleLogo";
import appSignetSvg from "../assets/svgs/app-signet.svg";

export function PlatformFavicon() {
  const { data: platformSimpleLogoUrl, isLoading } = usePlatformSimpleLogo();

  useEffect(() => {
    if (isLoading) return;

    const finalUrl = platformSimpleLogoUrl || appSignetSvg;

    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach((link) => link.remove());

    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = finalUrl;
    document.head.appendChild(link);
  }, [platformSimpleLogoUrl, isLoading]);

  return null;
}
