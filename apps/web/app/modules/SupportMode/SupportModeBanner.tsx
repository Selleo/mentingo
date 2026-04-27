import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useExitSupportMode } from "~/api/mutations/useExitSupportMode";
import { useCurrentUser } from "~/api/queries";
import { Button } from "~/components/ui/button";

import { SUPPORT_MODE_HANDLES } from "../../../e2e/data/support-mode/handles";

const MINUTE = 60_000;

const getMinutesLeft = (expiresAt?: string) => {
  if (!expiresAt) return 0;

  const now = Date.now();
  const expiresMs = new Date(expiresAt).getTime();
  return Math.max(0, Math.ceil((expiresMs - now) / MINUTE));
};

export function SupportModeBanner() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const { mutateAsync: exitSupportMode, isPending: isExitingSupportMode } = useExitSupportMode();
  const expiresAt = currentUser?.supportContext?.expiresAt;
  const [minutesLeft, setMinutesLeft] = useState(() => getMinutesLeft(expiresAt));

  useEffect(() => {
    setMinutesLeft(getMinutesLeft(expiresAt));

    const interval = window.setInterval(() => {
      setMinutesLeft(getMinutesLeft(expiresAt));
    }, MINUTE);

    return () => window.clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (!currentUser?.isSupportMode || minutesLeft > 0) return;

    exitSupportMode().catch(() => {
      window.location.assign("/auth/login");
    });
  }, [currentUser?.isSupportMode, exitSupportMode, minutesLeft]);

  if (!currentUser?.isSupportMode || !currentUser.supportContext) {
    return null;
  }

  return (
    <div
      data-testid={SUPPORT_MODE_HANDLES.BANNER}
      className="bg-warning-500 text-warning-950 px-4 py-2 text-sm flex items-center justify-between gap-3 border-b border-warning-600"
    >
      <p data-testid={SUPPORT_MODE_HANDLES.MESSAGE}>{t("supportMode.banner.message")}</p>
      <div className="flex items-center gap-3">
        <span data-testid={SUPPORT_MODE_HANDLES.TIME_LEFT}>
          {t("supportMode.banner.timeLeft", "{{minutes}} min left", {
            minutes: minutesLeft,
          })}
        </span>
        <Button
          data-testid={SUPPORT_MODE_HANDLES.EXIT_BUTTON}
          size="sm"
          className="bg-warning-600 hover:bg-warning-700 text-warning-50 border border-warning-700"
          onClick={() => exitSupportMode()}
          disabled={isExitingSupportMode}
        >
          {t("supportMode.banner.exit", "Exit support mode")}
        </Button>
      </div>
    </div>
  );
}
