import { BookOpen, Check, CheckCircle2, Clock3, Eye, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useContentMarketplaceListingOutline } from "~/api/queries/useContentMarketplaceListingOutline";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import CourseHeroImage from "~/modules/Courses/CourseView/CourseOverview/CourseHeroImage";
import { formatDuration } from "~/modules/Courses/utils/formatDuration";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { useContentMarketplaceThumbnailUrl } from "../hooks/useContentMarketplaceThumbnailUrl";

import { ContentMarketplacePreviewChapter } from "./ContentMarketplacePreviewChapter";
import { CopyListingPanel } from "./CopyListingPanel";

import type {
  GetContentMarketplaceListingOutlineResponse,
  ListContentMarketplaceListingsResponse,
} from "~/api/generated-api";

type Listing = ListContentMarketplaceListingsResponse["data"][number];
type ListingOutline = GetContentMarketplaceListingOutlineResponse["data"];

type ContentMarketplaceListingPreviewProps = {
  listing: Listing;
};

/**
 * Shows a marketplace course the way the course overview does, before it is copied: hero with
 * learning outcomes, description and chapters with their lessons, without opening any lesson.
 */
export function ContentMarketplaceListingPreview({
  listing,
}: ContentMarketplaceListingPreviewProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [isOpen, setIsOpen] = useState(false);
  const {
    data: outline,
    error,
    isLoading,
    refetch,
  } = useContentMarketplaceListingOutline(listing.id, listing.versionId, language, isOpen);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Eye className="mr-2 size-4" aria-hidden />
          {t("contentMarketplace.preview.open")}
        </Button>
      </DialogTrigger>
      <DialogContent
        noCloseButton
        className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        <div className="flex-1 overflow-y-auto">
          <ListingPreviewHero
            listing={listing}
            learningOutcomes={outline?.learningOutcomes ?? []}
            isOpen={isOpen}
          />
          <div className="flex flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
            <DialogDescription asChild>
              <section className="flex flex-col gap-2">
                <h3 className="h6 text-neutral-950">
                  {t("studentCourseView.sideSection.other.about")}
                </h3>
                <Viewer content={listing.description} className="body-base text-neutral-800" />
              </section>
            </DialogDescription>
            {outline && outline.learningOutcomes.length > 0 && (
              <LearningOutcomesList
                learningOutcomes={outline.learningOutcomes}
                className="lg:hidden"
              />
            )}
            {isLoading && <ListingOutlineSkeleton />}
            {error && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-neutral-50 px-5 py-10 text-center text-sm text-neutral-600">
                <p>
                  {getTranslatedApiErrorMessage(error, t, t("contentMarketplace.serviceError"))}
                </p>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  {t("contentMarketplace.retry")}
                </Button>
              </div>
            )}
            {outline && <ListingChapters outline={outline} />}
          </div>
        </div>
        <div className="border-t border-neutral-100 bg-white px-4 py-4 empty:hidden md:px-8">
          <div className="ml-auto flex w-full sm:max-w-xs">
            <CopyListingPanel listing={listing} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListingPreviewHero({
  listing,
  learningOutcomes,
  isOpen,
}: {
  listing: Listing;
  learningOutcomes: string[];
  isOpen: boolean;
}) {
  const { t } = useTranslation();
  const thumbnailUrl = useContentMarketplaceThumbnailUrl(
    listing.id,
    listing.versionId,
    listing.hasThumbnail && isOpen,
  );
  const { category, durationMinutes, lessonCount } = listing.metadata;

  return (
    <CourseHeroImage
      alt={listing.title}
      imageUrl={thumbnailUrl ?? undefined}
      className="md:aspect-video"
    >
      <DialogClose className="absolute right-4 top-4 z-20 grid size-9 place-items-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <X className="size-4" aria-hidden />
        <span className="sr-only">{t("common.button.close")}</span>
      </DialogClose>
      <div className="relative z-10 flex flex-col justify-end gap-6 px-4 pb-6 pt-16 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:pb-8">
        <div className="min-w-0 max-w-full lg:max-w-[58%]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {category && (
              <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                {category}
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <BookOpen className="size-3.5" aria-hidden />
              {t("studentCoursesView.modernView.lessonsCount", { count: lessonCount })}
            </span>
            {durationMinutes && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Clock3 className="size-3.5" aria-hidden />
                {formatDuration(durationMinutes * 60, t)}
              </span>
            )}
          </div>
          <DialogTitle className="break-words text-xl font-bold leading-snug text-white md:text-3xl md:leading-tight">
            {listing.title}
          </DialogTitle>
        </div>
        {learningOutcomes.length > 0 && (
          <aside className="hidden w-[38%] shrink-0 rounded-2xl bg-black/15 p-4 backdrop-blur-[2px] lg:block">
            <h3 className="mb-4 flex items-center gap-3 font-gothic text-xl font-bold text-white">
              <CheckCircle2 className="size-8 shrink-0 text-success-500" aria-hidden />
              {t("modernCourseView.overview.whatYouWillMaster")}
            </h3>
            <ul className="space-y-1.5">
              {learningOutcomes.map((learningOutcome, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="break-words text-base font-medium leading-6 text-white">
                    {learningOutcome}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </CourseHeroImage>
  );
}

function LearningOutcomesList({
  learningOutcomes,
  className,
}: {
  learningOutcomes: string[];
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <section className={className}>
      <h3 className="h6 mb-3 flex items-center gap-2 text-neutral-950">
        <CheckCircle2 className="size-6 shrink-0 text-success-500" aria-hidden />
        {t("modernCourseView.overview.whatYouWillMaster")}
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {learningOutcomes.map((learningOutcome, index) => (
          <li key={index} className="flex items-start gap-3 text-sm text-neutral-800">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            <span className="break-words">{learningOutcome}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ListingChapters({ outline }: { outline: ListingOutline }) {
  const { t } = useTranslation();
  const lessonCount = outline.chapters.reduce(
    (total, chapter) => total + chapter.lessons.length,
    0,
  );

  return (
    <section className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-1">
        <h3 className="h6 text-neutral-950">{t("studentCourseView.header")}</h3>
        <p className="body-base-md text-neutral-800">
          {t("contentMarketplace.preview.chaptersCount", { count: outline.chapters.length })}
          {" · "}
          {t("studentCoursesView.modernView.lessonsCount", { count: lessonCount })}
        </p>
      </div>
      {outline.chapters.length === 0 && (
        <p className="text-sm text-neutral-500">{t("contentMarketplace.preview.noChapters")}</p>
      )}
      <div className="flex flex-col gap-y-4">
        {outline.chapters.map((chapter, chapterIndex) => (
          <ContentMarketplacePreviewChapter
            key={chapterIndex}
            chapter={chapter}
            displayOrder={chapterIndex + 1}
            isLastChapter={chapterIndex === outline.chapters.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function ListingOutlineSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{t("contentMarketplace.loading")}</span>
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <Skeleton className="hidden size-10 shrink-0 rounded-full md:block" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
