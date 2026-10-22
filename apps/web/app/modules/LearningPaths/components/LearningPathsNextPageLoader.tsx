import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

const NEXT_PAGE_PREFETCH_MARGIN = "1500px";

type LearningPathsNextPageLoaderProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadNextPage: () => void;
};

export function LearningPathsNextPageLoader({
  hasNextPage,
  isFetchingNextPage,
  onLoadNextPage,
}: LearningPathsNextPageLoaderProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadNextPageRef = useRef(onLoadNextPage);
  onLoadNextPageRef.current = onLoadNextPage;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadNextPageRef.current();
      },
      { rootMargin: NEXT_PAGE_PREFETCH_MARGIN },
    );

    intersectionObserver.observe(sentinel);
    return () => intersectionObserver.disconnect();
  }, [hasNextPage, isFetchingNextPage]);

  if (!hasNextPage) return null;

  return (
    <div ref={sentinelRef} className="flex justify-center py-6" aria-live="polite">
      {isFetchingNextPage && (
        <LoaderCircle className="size-8 animate-spin text-primary-700" aria-hidden />
      )}
    </div>
  );
}
