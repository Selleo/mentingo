import { cn } from "~/lib/utils";

type AiMentorReplayLoaderProps = {
  text: string;
  className?: string;
};

export const AiMentorReplayLoader = ({ text, className }: AiMentorReplayLoaderProps) => (
  <div
    role="status"
    aria-live="polite"
    className={cn("flex min-h-0 flex-1 items-center justify-center px-6 py-10", className)}
  >
    <div className="w-full max-w-md text-center">
      <div className="flex items-center justify-center gap-3">
        <span
          className="size-4 rounded-full border-2 border-neutral-200 border-t-primary-600 motion-safe:animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="loading-text-shimmer text-base font-semibold">{text}</p>
      </div>
    </div>
  </div>
);
