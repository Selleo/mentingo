import { Link } from "@remix-run/react";
import { Award, BookOpen, ListOrdered } from "lucide-react";
import { useTranslation } from "react-i18next";

import DefaultPhotoCourse from "~/assets/svgs/default-photo-course.svg";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import { LearningPathStatusBadge } from "./LearningPathStatusBadge";

import type { GetLearningPathsResponse } from "~/api/generated-api";

type LearningPathListItem = GetLearningPathsResponse["data"][number];

type LearningPathCardProps = {
  learningPath: LearningPathListItem;
  title: string;
  description: string;
};

export function LearningPathCard({ learningPath, title, description }: LearningPathCardProps) {
  const { t } = useTranslation();

  return (
    <Link
      to={`/learning-paths/${learningPath.id}`}
      className="group flex h-full min-h-[380px] w-full flex-col overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-primary-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
    >
      <div className="relative overflow-hidden">
        <img
          src={learningPath.thumbnailReference || DefaultPhotoCourse}
          alt={title}
          loading="lazy"
          decoding="async"
          className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = DefaultPhotoCourse;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/60 via-neutral-950/0 to-transparent" />
        <div className="absolute left-4 top-4">
          <LearningPathStatusBadge status={learningPath.status} />
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
          <Badge
            variant="default"
            className="border-white/20 bg-white/95 text-neutral-900 shadow-sm"
          >
            <ListOrdered className="size-4" />
            {learningPath.sequenceEnabled
              ? t("learningPathsView.badges.sequenceEnabled")
              : t("learningPathsView.badges.freeOrder")}
          </Badge>
          {learningPath.includesCertificate && (
            <Badge
              variant="success"
              className="border-success-100 bg-white/95 text-success-800 shadow-sm"
            >
              <Award className="size-4" />
              {t("learningPathsView.badges.certificate")}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
            <span className="h-px w-8 bg-neutral-300" />
            {learningPath.baseLanguage.toUpperCase()}
          </div>
          <h2 className="text-2xl font-semibold leading-tight text-neutral-950 line-clamp-2">
            {title}
          </h2>
          <p
            className={cn("body-sm line-clamp-3 text-neutral-600", {
              "text-neutral-500": !description,
            })}
          >
            {description || t("learningPathsView.emptyDescription")}
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-neutral-100 pt-4 text-neutral-800 transition group-hover:text-neutral-950">
          <BookOpen className="size-4" />
          <span className="details-md font-medium">{t("learningPathsView.card.openPath")}</span>
        </div>
      </div>
    </Link>
  );
}
