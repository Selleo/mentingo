import { AlertTriangle, Info } from "lucide-react";
import { match } from "ts-pattern";

import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

const NOTICE_TONES = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
} as const;

type NoticeTone = (typeof NOTICE_TONES)[keyof typeof NOTICE_TONES];

type DirectorySyncNoticeProps = {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  testId?: string;
};

export function DirectorySyncNotice({ tone, title, children, testId }: DirectorySyncNoticeProps) {
  const NoticeIcon = tone === NOTICE_TONES.INFO ? Info : AlertTriangle;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-4",
        match(tone)
          .with(NOTICE_TONES.INFO, () => "border-primary-200 bg-primary-50 text-neutral-900")
          .with(NOTICE_TONES.WARNING, () => "border-warning-200 bg-warning-50 text-neutral-900")
          .with(NOTICE_TONES.ERROR, () => "border-error-200 bg-error-50 text-error-900")
          .exhaustive(),
      )}
      data-testid={testId}
    >
      <NoticeIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

export { NOTICE_TONES as DIRECTORY_SYNC_NOTICE_TONES };
