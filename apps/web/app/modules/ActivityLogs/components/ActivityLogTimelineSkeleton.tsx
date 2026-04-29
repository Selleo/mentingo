import { Skeleton } from "~/components/ui/skeleton";

export const ActivityLogTimelineSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex gap-4 rounded-[1.75rem] border border-neutral-200 bg-white px-5 py-5"
        >
          <div className="w-24 shrink-0 pt-2 text-right lg:w-28">
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
          <div className="flex justify-center">
            <Skeleton className="mt-3 size-12 rounded-full" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-[1.75rem]" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
