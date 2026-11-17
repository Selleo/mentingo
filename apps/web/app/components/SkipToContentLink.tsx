import { useTranslation } from "react-i18next";

import type { MouseEvent } from "react";

export function SkipToContentLink() {
  const { t } = useTranslation();

  // Each layout renders its own <main>, so focus the first one instead of relying on a shared id.
  const focusMainContent = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector("main");

    if (!main) return;

    event.preventDefault();
    main.tabIndex = -1;
    main.focus();
  };

  return (
    <a
      href="#main"
      onClick={focusMainContent}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-primary-800 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-700 body-sm-md"
    >
      {t("navigationSideBar.skipToContent")}
    </a>
  );
}
