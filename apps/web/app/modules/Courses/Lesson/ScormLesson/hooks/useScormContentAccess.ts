import { SCORM_CONTENT_ACCESS } from "@repo/shared";
import { useEffect } from "react";

import { useRenewScormContent } from "~/api/mutations/useRenewScormContent";

import { getScormContentLocation } from "../runtime/scormBridge";

export function useScormContentAccess(launchUrl: string) {
  const { mutate: renew, reset, isError } = useRenewScormContent();

  useEffect(() => {
    const { channel } = getScormContentLocation(launchUrl);
    reset();

    const renewAccess = () => renew(channel);
    renewAccess();

    const onVisible = () => {
      if (document.visibilityState === "visible") renewAccess();
    };

    const timer = window.setInterval(renewAccess, SCORM_CONTENT_ACCESS.RENEW_INTERVAL_MS);

    window.addEventListener("online", renewAccess);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", renewAccess);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [launchUrl, renew, reset]);

  return { contentAccessFailed: isError };
}
