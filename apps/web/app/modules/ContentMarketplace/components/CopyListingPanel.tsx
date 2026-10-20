import { Link } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { ArrowRight, Copy, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Button } from "~/components/ui/button";

import { useContentMarketplaceCopyJob } from "../hooks/useContentMarketplaceCopyJob";

import type { ListContentMarketplaceListingsResponse } from "~/api/generated-api";

type CopyListingPanelProps = {
  listing: Pick<ListContentMarketplaceListingsResponse["data"][number], "id" | "copiedCourse">;
};

/**
 * Copies the listing into the tenant and follows the import job until the course is ready.
 * Once copied, it opens the course and offers a sync while a newer version is available.
 */
export function CopyListingPanel({ listing }: CopyListingPanelProps) {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const { startCopy, isCopying, lastCopiedCourseId } = useContentMarketplaceCopyJob(listing.id);
  const copiedCourseId = listing.copiedCourse?.id ?? lastCopiedCourseId;
  const canSync = Boolean(listing.copiedCourse?.isOutdated);
  const canCopy = hasPermission(user?.permissions ?? [], PERMISSIONS.COURSE_CREATE);

  if (!canCopy) return null;

  if (!copiedCourseId)
    return (
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => void startCopy()}
        disabled={isCopying}
        title={t("contentMarketplace.copyNotice")}
        aria-live="polite"
      >
        {isCopying ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Copy className="mr-2 size-4" aria-hidden />
        )}
        {isCopying ? t("contentMarketplace.copying") : t("contentMarketplace.addToCourses")}
      </Button>
    );

  return (
    <div className="flex w-full min-w-0 items-center gap-2" aria-live="polite">
      {canSync && (
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => void startCopy()}
          disabled={isCopying}
          title={t("contentMarketplace.syncNotice")}
        >
          {isCopying ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 size-4" aria-hidden />
          )}
          {isCopying ? t("contentMarketplace.syncing") : t("contentMarketplace.sync")}
        </Button>
      )}
      <Button variant="outline" size="sm" className="flex-1" asChild>
        <Link to={`/course/${copiedCourseId}`}>
          {t("contentMarketplace.openCourse")}
          <ArrowRight className="ml-2 size-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
