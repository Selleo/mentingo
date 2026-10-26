import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AuthoringElapsedTime } from "./AuthoringElapsedTime";

const SLOW_PHASE_MS = 15_000;

/** Live "still working" row: spinner, phase label, elapsed time and a hint once the phase runs long. */
export const AuthoringPendingIndicator = ({ label }: { label: string }) => {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSlow(true), SLOW_PHASE_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="max-w-xl space-y-0.5" role="status">
      <div className="flex min-h-7 items-center gap-2 text-[13px] leading-5 text-neutral-700">
        <LoaderCircle
          className="size-3.5 shrink-0 text-primary-600 motion-safe:animate-spin"
          aria-hidden="true"
        />
        <span className="loading-text-shimmer min-w-0 truncate">{label}</span>
        <AuthoringElapsedTime className="ml-auto shrink-0 text-xs" />
      </div>
      {slow && (
        <p className="ml-[22px] text-xs text-neutral-500">
          {t("courseAuthoring.conversation.pendingSlowHint")}
        </p>
      )}
    </div>
  );
};
