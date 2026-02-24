import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";

type UploadFileCardProps = {
  name: string;
  meta: string;
  onRemove: () => void;
  error?: boolean;
  compact?: boolean;
  removeDisabled?: boolean;
};

export function UploadFileCard({
  name,
  meta,
  onRemove,
  error = false,
  compact = false,
  removeDisabled = false,
}: UploadFileCardProps) {
  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 items-center gap-3 rounded-lg border border-neutral-200 bg-white shadow-sm",
        {
          "px-3 py-2.5": !compact,
          "px-2.5 py-2": compact,
        },
      )}
    >
      <button
        type="button"
        aria-label="Remove file"
        onClick={onRemove}
        disabled={removeDisabled}
        className={cn(
          "absolute inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm hover:bg-neutral-50 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          {
            "right-2 top-2 size-6": !compact,
            "right-1.5 top-1.5 size-5": compact,
          },
        )}
      >
        <Icon name="IconX" className={cn({ "size-4": !compact, "size-3": compact })} />
      </button>

      <div
        className={cn(
          "flex flex-none items-center justify-center rounded-md bg-neutral-50 text-neutral-500",
          {
            "size-10": !compact,
            "size-8": compact,
          },
        )}
      >
        <Icon
          name={error ? "ExclamationTriangle" : "Directory"}
          className={cn({ "size-6": !compact, "size-5": compact, "text-error-600": error })}
        />
      </div>

      <div className="min-w-0 flex-1 pr-7">
        <p
          className={cn("truncate font-medium text-neutral-900", {
            "text-sm": !compact,
            "text-xs": compact,
          })}
          title={name}
        >
          {name}
        </p>
        <p
          className={cn("truncate text-neutral-500", {
            "text-xs": !compact,
            "text-[11px]": compact,
          })}
          title={meta}
        >
          {meta}
        </p>
      </div>
    </div>
  );
}
