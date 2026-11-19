import { useTranslation } from "react-i18next";

import type { MouseEvent } from "react";

export function SkipToContentLink() {
  const { t } = useTranslation();

  // Layouts render their own <main> without a shared id, so focus the first <main> in the document.
  const focusMainContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const main = document.querySelector("main");

    if (!main) return;

    main.tabIndex = -1;
    main.focus();
    // Drop it again so later mouse clicks inside <main> don't move focus to <main> itself.
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
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
