import { Link } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { ArrowRight, Copy, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match, P } from "ts-pattern";

import { NATIVE_ARCHIVE_JOB_STATE } from "~/api/mutations/admin/nativeArchive.constants";
import { useNativeArchiveStatus } from "~/api/mutations/admin/useNativeArchiveStatus";
import { useCopyContentMarketplaceListing } from "~/api/mutations/useCopyContentMarketplaceListing";
import { CONTENT_MARKETPLACE_LISTINGS_QUERY_KEY } from "~/api/queries/useContentMarketplaceListings";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Button } from "~/components/ui/button";
import { useToast } from "~/components/ui/use-toast";

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
  const { toast } = useToast();
  const { data: user } = useCurrentUser();
  const [jobId, setJobId] = useState<string | null>(null);
  const reportedJobId = useRef<string | null>(null);
  const { mutateAsync: copyListing, isPending: isStartingCopy } =
    useCopyContentMarketplaceListing();
  const status = useNativeArchiveStatus(jobId);
  const jobState = status.data?.state;
  const justCopiedCourseId = match(status.data)
    .with(
      { state: NATIVE_ARCHIVE_JOB_STATE.COMPLETED, result: { rootId: P.string } },
      (data) => data.result.rootId,
    )
    .otherwise(() => null);
  const copiedCourseId = justCopiedCourseId ?? listing.copiedCourse?.id ?? null;
  const canSync = !justCopiedCourseId && Boolean(listing.copiedCourse?.isOutdated);
  const isCopying =
    isStartingCopy ||
    Boolean(
      jobId &&
        jobState !== NATIVE_ARCHIVE_JOB_STATE.COMPLETED &&
        jobState !== NATIVE_ARCHIVE_JOB_STATE.FAILED &&
        !status.isError,
    );
  const canCopy = hasPermission(user?.permissions ?? [], PERMISSIONS.COURSE_CREATE);

  useEffect(() => {
    if (!jobId || reportedJobId.current === jobId) return;

    if (jobState === NATIVE_ARCHIVE_JOB_STATE.COMPLETED) {
      reportedJobId.current = jobId;
      void queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: CONTENT_MARKETPLACE_LISTINGS_QUERY_KEY });
      toast({
        description: status.data?.result?.alreadyExists
          ? t("contentMarketplace.copyUpdated")
          : t("contentMarketplace.copyComplete"),
        variant: "success",
      });
      return;
    }

    if (jobState === NATIVE_ARCHIVE_JOB_STATE.FAILED || status.isError) {
      reportedJobId.current = jobId;
      toast({
        description: t(`nativeArchive.errors.${status.data?.failedReason?.split(".").at(-1)}`, {
          defaultValue: t("contentMarketplace.copyFailed"),
        }),
        variant: "destructive",
      });
    }
  }, [jobId, jobState, status.data, status.isError, t, toast]);

  async function startCopy() {
    const copy = await copyListing(listing.id).catch(() => null);

    if (copy) setJobId(copy.jobId);
  }

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
