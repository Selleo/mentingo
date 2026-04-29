import { Trophy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useLeaderboard, useLeaderboardGroups } from "~/api/queries/useLeaderboard";
import { PageWrapper } from "~/components/PageWrapper";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import Loader from "~/modules/common/Loader/Loader";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";
import type { LeaderboardRow } from "~/api/queries/useLeaderboard";

type LeaderboardScope = "all-time" | "month";

const ALL_GROUPS_VALUE = "all";

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
  const [scope, setScope] = useState<LeaderboardScope>("all-time");
  const [groupId, setGroupId] = useState<string | null>(null);
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(scope, groupId);
  const { data: groups = [], isLoading: areGroupsLoading } = useLeaderboardGroups();

  if (isLeaderboardLoading || areGroupsLoading) return <Loader />;

  const top10 = leaderboard?.top10 ?? [];
  const ownRow = leaderboard?.ownRow ?? null;
  const ownRank = leaderboard?.ownRank ?? null;
  const isViewerInTop10 = Boolean(ownRow && top10.some((row) => row.userId === ownRow.userId));
  const showStickyOwnRow = Boolean(ownRow && ownRank && !isViewerInTop10);

  return (
    <PageWrapper>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-y-6">
        <header className="flex flex-col gap-y-5">
          <div className="flex items-center gap-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="heading-4 text-neutral-950">{t("leaderboardView.title")}</h1>
              <p className="body-2 text-neutral-500">{t("leaderboardView.subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-fit rounded-full bg-neutral-100 p-1">
              {(["all-time", "month"] satisfies LeaderboardScope[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setScope(tab)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    scope === tab
                      ? "bg-primary-600 text-white shadow-sm"
                      : "text-neutral-600 hover:text-neutral-950",
                  )}
                >
                  {tab === "all-time"
                    ? t("leaderboardView.tabs.allTime")
                    : t("leaderboardView.tabs.thisMonth")}
                </button>
              ))}
            </div>

            <div className="flex min-w-60 flex-col gap-y-1">
              <span className="caption text-neutral-500">{t("leaderboardView.filters.group")}</span>
              <Select
                value={groupId ?? ALL_GROUPS_VALUE}
                onValueChange={(value) => setGroupId(value === ALL_GROUPS_VALUE ? null : value)}
              >
                <SelectTrigger className="w-full border border-neutral-200 bg-white sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GROUPS_VALUE}>
                    {t("leaderboardView.filters.allGroups")}
                  </SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
