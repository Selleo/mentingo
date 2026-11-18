import { useLayoutEffect } from "react";

import { useCompanyInformation } from "~/api/queries/useCompanyInformation";
import { formatPageTitle, getPlatformName } from "~/utils/setPageTitle";

// Remix `meta` cannot read query data, so pages with data-driven titles set them here and keep
// them when Remix re-renders the route's static `<title>` (e.g. after a replace navigation).
// A layout effect so the observer disconnects within the commit that unmounts the page.
export const usePageTitle = (parts: Array<string | null | undefined>) => {
  const { data: companyInformation } = useCompanyInformation();
  const title = formatPageTitle(parts, getPlatformName(companyInformation?.data));

  useLayoutEffect(() => {
    // The route's own title, restored on cleanup: the next route may render the same `<title>`
    // string, in which case React leaves our title in the DOM.
    let routeTitle = document.title;

    document.title = title;

    // Watch the whole head: Remix may update the `<title>` text or replace the element.
    const observer = new MutationObserver(() => {
      if (document.title === title) return;

      routeTitle = document.title;
      document.title = title;
    });

    observer.observe(document.head, { childList: true, characterData: true, subtree: true });

    return () => {
      observer.disconnect();
      // Keep a title Remix committed in the same commit as the unmount.
      if (document.title === title) document.title = routeTitle;
    };
  }, [title]);
};
