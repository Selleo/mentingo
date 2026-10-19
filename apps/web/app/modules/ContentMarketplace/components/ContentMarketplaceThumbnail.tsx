import { Store } from "lucide-react";
import { useEffect, useState } from "react";

import { useContentMarketplaceThumbnail } from "~/api/queries/useContentMarketplaceThumbnail";
import { cn } from "~/lib/utils";

type ContentMarketplaceThumbnailProps = {
  listingId: string;
  hasThumbnail: boolean;
  title: string;
  className?: string;
};

export function ContentMarketplaceThumbnail({
  listingId,
  hasThumbnail,
  title,
  className,
}: ContentMarketplaceThumbnailProps) {
  const { data: thumbnail } = useContentMarketplaceThumbnail(listingId, hasThumbnail);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnail) return;

    const objectUrl = URL.createObjectURL(thumbnail);
    setThumbnailUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [thumbnail]);

  return (
    <div
      className={cn(
        "flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-neutral-100",
        className,
      )}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={title} className="size-full object-cover" />
      ) : (
        <Store className="size-10 text-neutral-400" aria-hidden />
      )}
    </div>
  );
}
