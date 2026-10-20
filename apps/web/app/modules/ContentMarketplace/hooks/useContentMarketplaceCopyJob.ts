import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { match, P } from "ts-pattern";

import { NATIVE_ARCHIVE_JOB_STATE } from "~/api/mutations/admin/nativeArchive.constants";
import { useNativeArchiveStatus } from "~/api/mutations/admin/useNativeArchiveStatus";
import { useCopyContentMarketplaceListing } from "~/api/mutations/useCopyContentMarketplaceListing";
import { CONTENT_MARKETPLACE_LISTINGS_QUERY_KEY } from "~/api/queries/useContentMarketplaceListings";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

/**
 * Starts a listing copy (or sync) and follows its import job until it finishes. A finished job
 * is released, so the refreshed listing decides again whether a sync is available.
 */
export function useContentMarketplaceCopyJob(listingId: string) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);
  const [lastCopiedCourseId, setLastCopiedCourseId] = useState<string | null>(null);
  const { mutateAsync: copyListing, isPending: isStartingCopy } =
    useCopyContentMarketplaceListing();
  const { data: job, isError: isJobStatusError } = useNativeArchiveStatus(jobId);

  useEffect(() => {
    if (!jobId) return;

    match({ job, isJobStatusError })
      .with(
        { job: { state: NATIVE_ARCHIVE_JOB_STATE.COMPLETED, result: P.select() } },
        (result) => {
          setJobId(null);
          setLastCopiedCourseId(result?.rootId ?? null);
          void queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: CONTENT_MARKETPLACE_LISTINGS_QUERY_KEY });
          toast({
            description: result?.alreadyExists
              ? t("contentMarketplace.copyUpdated")
              : t("contentMarketplace.copyComplete"),
            variant: "success",
          });
        },
      )
      .with(
        P.union({ job: { state: NATIVE_ARCHIVE_JOB_STATE.FAILED } }, { isJobStatusError: true }),
        () => {
          setJobId(null);
          toast({
            description: t(`nativeArchive.errors.${job?.failedReason?.split(".").at(-1)}`, {
              defaultValue: t("contentMarketplace.copyFailed"),
            }),
            variant: "destructive",
          });
        },
      )
      .otherwise(() => undefined);
  }, [jobId, job, isJobStatusError, t, toast]);

  async function startCopy() {
    const copy = await copyListing(listingId).catch(() => null);

    if (copy) setJobId(copy.jobId);
  }

  return {
    startCopy,
    isCopying: isStartingCopy || Boolean(jobId),
    lastCopiedCourseId,
  };
}
