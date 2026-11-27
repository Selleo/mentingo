import { isSupportedLanguage, stripHtmlTags } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, LoaderCircle } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuthoringAssetPreviewUrls } from "~/api/queries/useAuthoringAssetPreviewUrls";
import { categoriesQueryOptions } from "~/api/queries/useCategories";
import { languageOptions } from "~/components/LanguageSelector/languageOptions";
import { Button } from "~/components/ui/button";

import {
  PROPOSAL_APPLICATION_STATUS,
  PROPOSAL_DECISION,
} from "../review/curriculumReview.constants";

import type { ProposalApplicationStatus } from "./ProposalReview";
import type { AuthoringOperation, ProposalView } from "../courseAuthoring.types";

type Props = {
  courseId: string;
  sessionId: string;
  operation: AuthoringOperation;
  proposal: ProposalView;
  readyAssetIds: string[];
  applicationStatus?: ProposalApplicationStatus;
  waiting: boolean;
  busy: boolean;
  onCreate: () => Promise<void>;
  onDiscard: () => Promise<void>;
  onRetry?: () => void;
};

export const isCourseCreationApplied = (
  proposal: ProposalView,
  applicationStatus?: ProposalApplicationStatus,
) =>
  applicationStatus === PROPOSAL_APPLICATION_STATUS.APPLIED ||
  proposal.decision === PROPOSAL_DECISION.APPLIED;

export const CourseCreationProposal = (props: Props) => {
  const { t } = useTranslation();
  const { operation, proposal, applicationStatus } = props;
  if (!isCourseCreationApplied(proposal, applicationStatus)) {
    return <CourseCreationProposalPreview {...props} />;
  }

  const { title } = operation.payload;
  return (
    <section className="space-y-1 rounded-xl border border-neutral-200 bg-white p-5">
      <p role="status" className="text-sm font-medium text-neutral-700">
        {t("courseAuthoring.draft.courseCreated")}
      </p>
      <h3 className="h4 break-words text-neutral-950">
        {typeof title === "string" ? title : proposal.summary}
      </h3>
    </section>
  );
};

const CourseCreationProposalPreview = ({
  courseId,
  sessionId,
  operation,
  proposal,
  readyAssetIds,
  applicationStatus,
  waiting,
  busy,
  onCreate,
  onDiscard,
  onRetry,
}: Props) => {
  const { t } = useTranslation();
  const {
    title,
    description,
    language,
    categoryId,
    categoryTitle,
    learningOutcomes,
    thumbnailAssetId,
  } = operation.payload;
  const courseLanguage =
    typeof language === "string" && isSupportedLanguage(language) ? language : operation.language;
  const locale = languageOptions.find(({ key }) => key === courseLanguage);
  const { data: categories } = useQuery(
    categoriesQueryOptions(
      { language: courseLanguage },
      { enabled: typeof categoryId === "string" },
    ),
  );
  const existingCategory = categories?.find(({ id }) => id === categoryId);
  const assetIds = useMemo(
    () => (typeof thumbnailAssetId === "string" ? [thumbnailAssetId] : []),
    [thumbnailAssetId],
  );
  const preview = useAuthoringAssetPreviewUrls({ courseId, sessionId, assetIds, readyAssetIds });
  const coverId = assetIds[0];
  const cover = coverId ? preview.urls[coverId] : undefined;
  const coverPreviewLoading = coverId ? preview.loadingAssetIds.includes(coverId) : false;
  const coverAlt = proposal.assetRequests?.find(({ assetId }) => assetId === coverId)?.altText;
  const outcomes = Array.isArray(learningOutcomes)
    ? learningOutcomes.filter((outcome): outcome is string => typeof outcome === "string")
    : [];
  const isApplying =
    applicationStatus === PROPOSAL_APPLICATION_STATUS.APPLYING ||
    applicationStatus === PROPOSAL_APPLICATION_STATUS.SYNCHRONIZING;
  const canReview =
    !isApplying &&
    (proposal.decision === PROPOSAL_DECISION.PENDING ||
      proposal.decision === PROPOSAL_DECISION.ACCEPTED);

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {cover && (
        <img className="aspect-video w-full object-cover" src={cover} alt={coverAlt ?? ""} />
      )}
      {!cover && coverId && (
        <div className="flex aspect-video w-full items-center justify-center bg-neutral-50 text-neutral-600">
          {waiting || coverPreviewLoading ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {t("courseAuthoring.draft.coverPending")}
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2 text-sm">
              <ImageOff className="size-5" aria-hidden />
              {t("courseAuthoring.draft.coverUnavailable")}
              {preview.failedAssetIds.includes(coverId) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={preview.isRetrying}
                  onClick={() => void preview.retryFailedPreviews()}
                >
                  {t("courseAuthoring.conversation.retry")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary-800">
            {t("courseAuthoring.draft.proposalTitle")}
          </p>
          <h3 className="h4 text-neutral-950">
            {typeof title === "string" ? title : proposal.summary}
          </h3>
          {typeof description === "string" && (
            <p className="whitespace-pre-line text-sm leading-6 text-neutral-700">
              {stripHtmlTags(description)}
            </p>
          )}
        </div>
        {(locale || typeof categoryId === "string" || typeof categoryTitle === "string") && (
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {locale && (
              <div>
                <dt className="font-medium">{t("courseAuthoring.draft.language")}</dt>
                <dd className="text-neutral-700">{t(locale.translationKey)}</dd>
              </div>
            )}
            {typeof categoryId === "string" && (
              <div>
                <dt className="font-medium">{t("courseAuthoring.draft.category")}</dt>
                <dd className="text-neutral-700">
                  {existingCategory?.title ?? t("courseAuthoring.draft.existingCategory")}
                </dd>
              </div>
            )}
            {!categoryId && typeof categoryTitle === "string" && (
              <div>
                <dt className="font-medium">{t("courseAuthoring.draft.newCategory")}</dt>
                <dd className="text-neutral-700">{categoryTitle}</dd>
              </div>
            )}
          </dl>
        )}
        {outcomes.length > 0 && (
          <div className="space-y-1 text-sm">
            <h4 className="font-medium">{t("courseAuthoring.editors.learningOutcomes")}</h4>
            <ul className="list-disc space-y-1 pl-5 text-neutral-700">
              {outcomes.map((outcome, index) => (
                <li key={index}>{outcome}</li>
              ))}
            </ul>
          </div>
        )}
        {canReview && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              disabled={busy || waiting || coverPreviewLoading}
              onClick={onRetry ?? (() => void onCreate().catch(() => undefined))}
            >
              {t(
                applicationStatus === PROPOSAL_APPLICATION_STATUS.FAILED && onRetry
                  ? "courseAuthoring.conversation.retry"
                  : "courseAuthoring.draft.createCourse",
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void onDiscard().catch(() => undefined)}
            >
              {t("courseAuthoring.draft.discardProposal")}
            </Button>
          </div>
        )}
        {isApplying && (
          <p role="status" className="text-sm text-neutral-700">
            {t("courseAuthoring.draft.creatingCourse")}
          </p>
        )}
        {proposal.decision === PROPOSAL_DECISION.REJECTED && (
          <p className="text-sm text-neutral-700">{t("courseAuthoring.draft.proposalDiscarded")}</p>
        )}
      </div>
    </section>
  );
};
