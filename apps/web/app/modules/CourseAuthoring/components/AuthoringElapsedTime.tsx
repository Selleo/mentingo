import { useEffect, useState } from "react";

import { cn } from "~/lib/utils";

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
};

/** Ticking m:ss counter so long silent phases still visibly progress. Falls back to mount time. */
export const AuthoringElapsedTime = ({
  since,
  className,
}: {
  since?: string | number | null;
  className?: string;
}) => {
  const [mountedAt] = useState(() => Date.now());
  const parsedSince = since ? new Date(since).getTime() : Number.NaN;
  const startedAt = Number.isFinite(parsedSince) ? Math.min(parsedSince, mountedAt) : mountedAt;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <span className={cn("tabular-nums text-neutral-400", className)} aria-hidden="true">
      {formatElapsed(seconds)}
    </span>
  );
};
