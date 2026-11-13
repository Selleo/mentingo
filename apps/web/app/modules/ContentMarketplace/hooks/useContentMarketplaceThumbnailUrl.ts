import { useEffect, useState } from "react";

import { useContentMarketplaceThumbnail } from "~/api/queries/useContentMarketplaceThumbnail";

/** An object URL for the listing's thumbnail, revoked when the thumbnail changes or the component unmounts. */
export function useContentMarketplaceThumbnailUrl(
  listingId: string,
  versionId: string,
  hasThumbnail: boolean,
) {
  const { data: thumbnail } = useContentMarketplaceThumbnail(listingId, versionId, hasThumbnail);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnail) return;

    const objectUrl = URL.createObjectURL(thumbnail);
    setThumbnailUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [thumbnail]);

  return thumbnailUrl;
}
