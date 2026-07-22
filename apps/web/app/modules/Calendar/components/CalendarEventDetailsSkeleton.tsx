import { Skeleton } from "~/components/ui/skeleton";

export function CalendarEventDetailsSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <Skeleton className="h-12 w-full" />

      <div className="grid gap-3">
        {["time", "details", "people"].map((row) => (
          <div
            key={row}
            className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5"
          >
            <Skeleton className="size-8 shrink-0" />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-neutral-200 pt-4">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
