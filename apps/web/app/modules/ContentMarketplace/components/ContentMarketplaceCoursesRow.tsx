import { Link } from "@remix-run/react";
import { CONTENT_MARKETPLACE_SORT, PERMISSIONS } from "@repo/shared";
import { ArrowRight, Store } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useContentMarketplaceConfiguration } from "~/api/queries/useContentMarketplaceConfiguration";
import { useContentMarketplaceListings } from "~/api/queries/useContentMarketplaceListings";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import { usePermissions } from "~/hooks/usePermissions";

import { COURSES_INLINE_EDIT_HANDLES } from "../../../../e2e/data/courses/handles";
import { CONTENT_MARKETPLACE_PATH } from "../contentMarketplace.constants";

import { ContentMarketplaceListingCard } from "./ContentMarketplaceListingCard";

const COURSES_ROW_QUERY = { page: 1, perPage: 10, sortBy: CONTENT_MARKETPLACE_SORT.RECENT };
const CAROUSEL_OPTIONS = { align: "start" as const, slidesToScroll: 1 };

/** Recent marketplace listings as a catalogue row, for users who may browse an enabled marketplace. */
export function ContentMarketplaceCoursesRow() {
  const { t } = useTranslation();
  const { hasAccess: canBrowse } = usePermissions({
    required: PERMISSIONS.CONTENT_MARKETPLACE_BROWSE,
  });
  const { data: configuration } = useContentMarketplaceConfiguration(canBrowse);
  const isEnabled = canBrowse && Boolean(configuration?.enabled);
  const { data: catalog } = useContentMarketplaceListings(COURSES_ROW_QUERY, isEnabled);
  const listings = catalog?.data ?? [];

  if (!isEnabled || !listings.length) return null;

  return (
    <section className="space-y-4 pb-6" data-testid={COURSES_INLINE_EDIT_HANDLES.MARKETPLACE_ROW}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 md:px-8">
        <h2 className="h2 flex items-center gap-3 text-2xl leading-snug md:text-[32px] md:leading-relaxed">
          <Store className="size-6 text-primary-700 md:size-7" aria-hidden />
          {t("contentMarketplace.title")}
        </h2>
        <Link
          to={CONTENT_MARKETPLACE_PATH}
          className="body-base-md flex items-center gap-1.5 text-neutral-400 transition-colors hover:text-primary-700 focus-visible:text-primary-700 focus-visible:outline-none"
          data-testid={COURSES_INLINE_EDIT_HANDLES.MARKETPLACE_BROWSE_ALL}
        >
          {t("contentMarketplace.browseAll")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <p className="body-sm -mt-2 px-4 text-neutral-600 md:px-8">
        {t("contentMarketplace.description")}
      </p>

      <div className="group relative px-4 md:px-8">
        <Carousel opts={CAROUSEL_OPTIONS}>
          <CarouselContent className="gap-4">
            {listings.map((listing) => (
              <CarouselItem key={listing.id} className="w-[300px] !basis-auto md:w-[340px]">
                <ContentMarketplaceListingCard listing={listing} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 size-11 border-none bg-white shadow-lg md:opacity-0 md:group-hover:opacity-100" />
          <CarouselNext className="right-2 size-11 border-none bg-white shadow-lg md:opacity-0 md:group-hover:opacity-100" />
        </Carousel>
      </div>
    </section>
  );
}
