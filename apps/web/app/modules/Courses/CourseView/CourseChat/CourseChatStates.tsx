import { Skeleton } from "~/components/ui/skeleton";

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-background p-6 text-center">
      <p className="body-sm text-neutral-600">{text}</p>
    </div>
  );
}

export function MainFeedSkeleton() {
  return (
    <>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </>
  );
}

export function MessagesSkeleton() {
  return (
    <>
      <Skeleton className="h-16 w-3/4" />
      <Skeleton className="ml-auto h-16 w-2/3" />
    </>
  );
}
