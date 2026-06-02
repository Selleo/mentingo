import { Skeleton } from "~/components/ui/skeleton";

export function CalendarEventDetailsSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );
}
