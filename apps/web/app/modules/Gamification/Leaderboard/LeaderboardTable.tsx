import { LEADERBOARD_METRICS, type LeaderboardMetric } from "@repo/shared";
import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import { LEADERBOARD_HANDLES } from "../../../../e2e/data/gamification/handles";

import { shouldShowNearby, type Leaderboard } from "./leaderboard.utils";

type LeaderboardTableProps = {
  leaderboard: Leaderboard;
  metric: LeaderboardMetric;
};

export function LeaderboardTable({ leaderboard, metric }: LeaderboardTableProps) {
  const { t } = useTranslation();
  const currentUserId = leaderboard.currentUser?.userId;

  const scoreLabel =
    metric === LEADERBOARD_METRICS.XP
      ? t("gamification.leaderboard.metric.xp")
      : t("gamification.leaderboard.metric.achievements");

  const renderRows = (entries: Leaderboard["entries"], testId: string) =>
    entries.map((entry) => (
      <TableRow
        key={entry.userId}
        data-testid={testId}
        aria-current={entry.userId === currentUserId || undefined}
        className={cn({ "bg-primary-50 font-semibold": entry.userId === currentUserId })}
      >
        <TableCell className="w-20">{entry.rank}</TableCell>
        <TableCell>{`${entry.firstName} ${entry.lastName}`}</TableCell>
        <TableCell className="text-right">{entry.score}</TableCell>
      </TableRow>
    ));

  if (leaderboard.entries.length === 0) {
    return (
      <p data-testid={LEADERBOARD_HANDLES.EMPTY} className="body-sm text-neutral-600">
        {t("gamification.leaderboard.empty")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">{t("gamification.leaderboard.rank")}</TableHead>
          <TableHead>{t("gamification.leaderboard.user")}</TableHead>
          <TableHead className="text-right">{scoreLabel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {renderRows(leaderboard.entries, LEADERBOARD_HANDLES.ENTRY)}
        {shouldShowNearby(leaderboard) && (
          <>
            <TableRow>
              <TableCell colSpan={3} className="body-sm-md text-neutral-600">
                {t("gamification.leaderboard.yourPosition")}
              </TableCell>
            </TableRow>
            {renderRows(leaderboard.nearby, LEADERBOARD_HANDLES.NEARBY)}
          </>
        )}
      </TableBody>
    </Table>
  );
}
