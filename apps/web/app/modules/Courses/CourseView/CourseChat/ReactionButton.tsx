import { cn } from "~/lib/utils";

type ReactionButtonProps = {
  reaction: string;
  count?: number;
  reactedByCurrentUser?: boolean;
  disabled: boolean;
  onClick: () => void;
};

export function ReactionButton({
  reaction,
  count,
  reactedByCurrentUser,
  disabled,
  onClick,
}: ReactionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "caption rounded-full border border-neutral-200 bg-background px-2 py-1 transition hover:border-primary-200 hover:bg-primary-50",
        reactedByCurrentUser && "border-primary-300 bg-primary-50 text-primary-700",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden>{reaction}</span>
      {count ? <span className="ml-1">{count}</span> : null}
    </button>
  );
}
