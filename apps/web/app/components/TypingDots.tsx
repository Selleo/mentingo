import { cn } from "~/lib/utils";

type TypingDotsProps = {
  className?: string;
  dotClassName?: string;
};

export function TypingDots({ className, dotClassName }: TypingDotsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl bg-primary-50 px-4 py-3",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 animate-[bounce_1s_infinite] rounded-full bg-primary-500 [animation-delay:-0.3s]",
          dotClassName,
        )}
      />
      <span
        className={cn(
          "size-1.5 animate-[bounce_1s_infinite] rounded-full bg-primary-500 [animation-delay:-0.15s]",
          dotClassName,
        )}
      />
      <span
        className={cn(
          "size-1.5 animate-[bounce_1s_infinite] rounded-full bg-primary-500",
          dotClassName,
        )}
      />
    </div>
  );
}
