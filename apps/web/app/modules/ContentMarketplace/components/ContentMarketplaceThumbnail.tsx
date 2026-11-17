import { Store } from "lucide-react";

import { cn } from "~/lib/utils";

import { useContentMarketplaceThumbnailUrl } from "../hooks/useContentMarketplaceThumbnailUrl";

type ContentMarketplaceThumbnailProps = {
  listingId: string;
  versionId: string;
  hasThumbnail: boolean;
  title: string;
  className?: string;
};

export function ContentMarketplaceThumbnail({
  listingId,
  versionId,
  hasThumbnail,
  title,
  className,
}: ContentMarketplaceThumbnailProps) {
  const thumbnailUrl = useContentMarketplaceThumbnailUrl(listingId, versionId, hasThumbnail);

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
