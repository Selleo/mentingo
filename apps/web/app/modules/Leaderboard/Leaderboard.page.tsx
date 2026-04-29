import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLeaderboard } from "~/api/queries/useLeaderboard";
import { PageWrapper } from "~/components/PageWrapper";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import Loader from "~/modules/common/Loader/Loader";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";
import type { LeaderboardRow } from "~/api/queries/useLeaderboard";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.leaderboard");

type LeaderboardListRowProps = {
  row: LeaderboardRow;
  rankLabel: string;
  isViewer?: boolean;
};

const getInitials = (fullName: string) =>
  fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

function LeaderboardListRow({ row, rankLabel, isViewer = false }: LeaderboardListRowProps) {
  const { t } = useTranslation();

  return (
    <li
      className={cn(
        "flex items-center gap-x-4 rounded-xl border border-neutral-100 bg-white p-4 shadow-sm",
        isViewer && "border-primary-300 bg-primary-50 ring-1 ring-primary-200",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-semibold text-neutral-700">
        {rankLabel}
      </div>
      <Avatar className="h-11 w-11">
        {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt={row.fullName} />}
        <AvatarFallback>{getInitials(row.fullName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="body-2 truncate font-semibold text-neutral-950">{row.fullName}</p>
        {isViewer && <p className="caption text-primary-700">{t("leaderboardView.you")}</p>}
      </div>
      <div className="text-right">
        <p className="body-2 font-semibold text-neutral-950">{row.points}</p>
        <p className="caption text-neutral-500">{t("leaderboardView.points")}</p>
      </div>
    </li>
  );
}

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const { data: leaderboard, isLoading } = useLeaderboard("all-time");

  if (isLoading) return <Loader />;

  const top10 = leaderboard?.top10 ?? [];
  const ownRow = leaderboard?.ownRow ?? null;
  const ownRank = leaderboard?.ownRank ?? null;
  const isViewerInTop10 = Boolean(ownRow && top10.some((row) => row.userId === ownRow.userId));
  const showStickyOwnRow = Boolean(ownRow && ownRank && !isViewerInTop10);

  return (
    <PageWrapper>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-y-6">
        <header className="flex flex-col gap-y-3">
          <div className="flex items-center gap-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="heading-4 text-neutral-950">{t("leaderboardView.title")}</h1>
              <p className="body-2 text-neutral-500">{t("leaderboardView.subtitle")}</p>
            </div>
          </div>
          <div className="w-fit rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white">
            {t("leaderboardView.tabs.allTime")}
          </div>
        </header>

        {top10.length === 0 ? (
          <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center">
            <Trophy className="mb-4 h-12 w-12 text-neutral-300" aria-hidden="true" />
            <h2 className="heading-5 text-neutral-950">{t("leaderboardView.emptyTitle")}</h2>
            <p className="body-2 mt-2 max-w-md text-neutral-500">
              {t("leaderboardView.emptyDescription")}
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-y-3">
            <ol className="flex flex-col gap-y-3">
              {top10.map((row, index) => (
                <LeaderboardListRow
                  key={row.userId}
                  row={row}
                  rankLabel={`#${index + 1}`}
                  isViewer={ownRow?.userId === row.userId}
                />
              ))}
            </ol>

            {showStickyOwnRow && ownRow && ownRank && (
              <div className="sticky bottom-4 z-10 rounded-2xl bg-white/90 p-2 shadow-xl backdrop-blur">
                <LeaderboardListRow row={ownRow} rankLabel={`#${ownRank}`} isViewer />
              </div>
            )}
          </section>
        )}
      </div>
    </PageWrapper>
  );
}
