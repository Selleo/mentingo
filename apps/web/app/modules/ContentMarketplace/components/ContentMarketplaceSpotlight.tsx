import { Clock3, History } from "lucide-react";
import { useTranslation } from "react-i18next";

import Viewer from "~/components/RichText/Viever";
import { Card } from "~/components/ui/card";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";

import { ContentMarketplaceThumbnail } from "./ContentMarketplaceThumbnail";
import { CopyListingPanel } from "./CopyListingPanel";

import type { ListContentMarketplaceListingsResponse } from "~/api/generated-api";

type ContentMarketplaceSpotlightProps = {
  listing: ListContentMarketplaceListingsResponse["data"][number];
};

export function ContentMarketplaceSpotlight({ listing }: ContentMarketplaceSpotlightProps) {
  const { t } = useTranslation();
  const { category, durationMinutes } = listing.metadata;

  return (
    <Card className="group relative isolate h-full min-h-64 overflow-hidden rounded-2xl border-neutral-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg">
      <ContentMarketplaceThumbnail
        listingId={listing.id}
        hasThumbnail={listing.hasThumbnail}
        title=""
        className="absolute inset-y-0 right-0 -z-10 h-full w-3/5 rounded-none bg-primary-50 [mask-image:linear-gradient(to_right,transparent,black_40%)] transition-transform duration-500 ease-out group-hover:scale-105 [&>svg]:text-primary-200"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white from-35% via-white/70 to-white/10" />
      <div className="flex h-full min-h-64 max-w-[60%] flex-col justify-between gap-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-800">
            <History className="size-3.5" aria-hidden />
            {t("contentMarketplace.recentBadge")}
          </span>
          {category && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-800">
              {category}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {durationMinutes && (
            <span className="flex items-center gap-1.5 text-xs font-medium leading-none text-neutral-600">
              <Clock3 className="size-3.5" aria-hidden />
              {formatDuration(durationMinutes * 60, t)}
            </span>
          )}
          <h3 className="line-clamp-2 break-words text-xl font-semibold leading-tight text-neutral-950">
            {listing.title}
          </h3>
          <Viewer
            content={listing.description}
            className="max-h-10 overflow-hidden text-sm text-neutral-700"
          />
          <div className="mt-2 flex w-fit empty:hidden">
            <CopyListingPanel listing={listing} />
          </div>
        </div>
      </div>
    </Card>
  );
}
