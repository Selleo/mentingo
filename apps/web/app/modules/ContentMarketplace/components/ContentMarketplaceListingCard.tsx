import { BookOpen, CalendarDays, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import Viewer from "~/components/RichText/Viever";
import { Card } from "~/components/ui/card";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { ContentMarketplaceThumbnail } from "./ContentMarketplaceThumbnail";
import { CopyListingPanel } from "./CopyListingPanel";

import type { ListContentMarketplaceListingsResponse } from "~/api/generated-api";

type ContentMarketplaceListingCardProps = {
  listing: ListContentMarketplaceListingsResponse["data"][number];
};

export function ContentMarketplaceListingCard({ listing }: ContentMarketplaceListingCardProps) {
  const { t, i18n } = useTranslation();
  const { category, durationMinutes, lessonCount } = listing.metadata;

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border-neutral-200 bg-white transition-shadow duration-300 hover:shadow-lg">
      <div className="relative overflow-hidden">
        <ContentMarketplaceThumbnail
          listingId={listing.id}
          versionId={listing.versionId}
          hasThumbnail={listing.hasThumbnail}
          title=""
          className="rounded-none bg-primary-50 transition-transform duration-500 ease-out group-hover:scale-105 [&>svg]:text-primary-200"
        />
        {category && (
          <span className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-primary-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            {category}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="line-clamp-2 break-words text-lg font-semibold leading-snug text-neutral-950">
          {listing.title}
        </h3>
        <Viewer
          content={listing.description}
          className="max-h-[4.25rem] overflow-hidden text-sm leading-relaxed text-neutral-600"
        />
        <div className="mt-auto flex flex-col gap-4 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-semibold leading-none text-primary-800">
              <BookOpen className="size-3.5 shrink-0" aria-hidden />
              {t("studentCoursesView.modernView.lessonsCount", { count: lessonCount })}
            </span>
            {durationMinutes && (
              <span className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-semibold leading-none text-primary-800">
                <Clock3 className="size-3.5 shrink-0" aria-hidden />
                {formatDuration(durationMinutes * 60, t)}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs leading-none text-neutral-400">
            <CalendarDays className="-mt-px size-3.5 shrink-0" aria-hidden />
            {t("contentMarketplace.updated", {
              date: formatLocalizedDate(i18n.language, listing.updatedAt),
            })}
          </p>
        </div>
      </div>
      <div className="flex border-t border-neutral-100 px-5 py-4 empty:hidden">
        <CopyListingPanel listing={listing} />
      </div>
    </Card>
  );
}
