import { Skeleton } from "~/components/ui/skeleton";

const HeroBannerSkeleton = () => (
  <div className="relative w-full bg-primary-50 md:h-[70vh] md:min-h-[500px] md:overflow-hidden">
    <div className="relative aspect-video w-full overflow-hidden bg-neutral-950 md:absolute md:inset-0 md:aspect-auto">
      <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-neutral-800" />
    </div>
    <div className="relative z-10 space-y-4 px-4 py-5 md:absolute md:inset-x-0 md:bottom-0 md:px-8 md:pb-16 md:pt-0">
      <Skeleton className="h-10 w-3/4 max-w-2xl bg-neutral-700" />
      <Skeleton className="h-5 w-1/2 max-w-xl bg-neutral-700" />
      <Skeleton className="h-11 w-36 rounded-full bg-neutral-700" />
    </div>
  </div>
);

export default HeroBannerSkeleton;
