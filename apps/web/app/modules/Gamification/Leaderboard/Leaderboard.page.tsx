import {
  LEADERBOARD_METRICS,
  LEADERBOARD_PERIODS,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useLeaderboard } from "~/api/queries/useLeaderboard";
import { useLeaderboardScopes } from "~/api/queries/useLeaderboardScopes";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { DatePicker } from "~/components/DatePicker";
import { PageWrapper } from "~/components/PageWrapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { GamificationFeatureGuard } from "~/Guards/GamificationFeatureGuard";
import { GAMIFICATION_FEATURES } from "~/Guards/GamificationFeatureGuard.constants";

import { LEADERBOARD_HANDLES } from "../../../../e2e/data/gamification/handles";

import {
  buildLeaderboardQuery,
  isRangeReversed,
  resolveScope,
  TENANT_SCOPE,
} from "./leaderboard.utils";
import { LeaderboardTable } from "./LeaderboardTable";

const PERIOD_LABEL_KEYS = {
  [LEADERBOARD_PERIODS.WEEK]: "gamification.leaderboard.period.week",
  [LEADERBOARD_PERIODS.MONTH]: "gamification.leaderboard.period.month",
  [LEADERBOARD_PERIODS.ALL_TIME]: "gamification.leaderboard.period.allTime",
  [LEADERBOARD_PERIODS.CUSTOM]: "gamification.leaderboard.period.custom",
} as const satisfies Record<LeaderboardPeriod, string>;

const METRIC_LABEL_KEYS = {
  [LEADERBOARD_METRICS.XP]: "gamification.leaderboard.metric.xp",
  [LEADERBOARD_METRICS.ACHIEVEMENTS]: "gamification.leaderboard.metric.achievements",
} as const satisfies Record<LeaderboardMetric, string>;

export default function LeaderboardPage() {
  return (
    <GamificationFeatureGuard feature={GAMIFICATION_FEATURES.LEADERBOARDS}>
      <Leaderboard />
    </GamificationFeatureGuard>
  );
}

function Leaderboard() {
  const { t } = useTranslation();

  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [metric, setMetric] = useState<LeaderboardMetric>(LEADERBOARD_METRICS.XP);
  const [period, setPeriod] = useState<LeaderboardPeriod>(LEADERBOARD_PERIODS.WEEK);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: scopes, error: scopesError } = useLeaderboardScopes();
  const scope = scopes ? resolveScope(selectedScope, scopes) : null;
  const filters = scope ? { scope, metric, period, from, to } : null;
  const query = filters ? buildLeaderboardQuery(filters) : null;

  const { data: leaderboard, error: leaderboardError } = useLeaderboard(query ?? {}, {
    enabled: Boolean(query),
  });

  const loadError = scopesError ?? leaderboardError;

  const breadcrumbs = [
    { title: "Mentingo", href: "/dashboard" },
    { title: t("gamification.leaderboard.title"), href: "/leaderboards" },
  ];

  const renderContent = () => {
    if (loadError) {
      return (
        <p data-testid={LEADERBOARD_HANDLES.ERROR} className="body-sm text-neutral-600">
          {getTranslatedApiErrorMessage(loadError, t, t("gamification.leaderboard.loadError"))}
        </p>
      );
    }

    if (!scopes) return <Skeleton className="h-64 w-full" />;

    if (!filters) {
      return (
        <p data-testid={LEADERBOARD_HANDLES.EMPTY} className="body-sm text-neutral-600">
          {t("gamification.leaderboard.noGroups")}
        </p>
      );
    }

    if (!query) {
      return (
        <p data-testid={LEADERBOARD_HANDLES.RANGE_HINT} className="body-sm text-neutral-600">
          {isRangeReversed(filters)
            ? t("gamification.leaderboard.invalidRange")
            : t("gamification.leaderboard.chooseRange")}
        </p>
      );
    }

    if (!leaderboard) return <Skeleton className="h-64 w-full" />;

    return <LeaderboardTable leaderboard={leaderboard} metric={metric} />;
  };

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <section
        data-testid={LEADERBOARD_HANDLES.PAGE}
        className="flex w-full max-w-[960px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow"
      >
        <div className="flex flex-col gap-y-1">
          <h1 className="h4 text-neutral-950">{t("gamification.leaderboard.title")}</h1>
          <p className="body-sm text-neutral-600">{t("gamification.leaderboard.description")}</p>
        </div>

        {scope && scopes && (
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={scope} onValueChange={setSelectedScope}>
              <SelectTrigger
                data-testid={LEADERBOARD_HANDLES.SCOPE_SELECT}
                aria-label={t("gamification.leaderboard.scope")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopes.tenantWide && (
                  <SelectItem value={TENANT_SCOPE}>
                    {t("gamification.leaderboard.organization")}
                  </SelectItem>
                )}
                {scopes.groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={metric} onValueChange={(value) => setMetric(value as LeaderboardMetric)}>
              <SelectTrigger
                data-testid={LEADERBOARD_HANDLES.METRIC_SELECT}
                aria-label={t("gamification.leaderboard.metricLabel")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METRIC_LABEL_KEYS).map(([value, labelKey]) => (
                  <SelectItem key={value} value={value}>
                    {t(labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={(value) => setPeriod(value as LeaderboardPeriod)}>
              <SelectTrigger
                data-testid={LEADERBOARD_HANDLES.PERIOD_SELECT}
                aria-label={t("gamification.leaderboard.periodLabel")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIOD_LABEL_KEYS).map(([value, labelKey]) => (
                  <SelectItem
                    key={value}
                    value={value}
                    data-testid={LEADERBOARD_HANDLES.periodOption(value)}
                  >
                    {t(labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {period === LEADERBOARD_PERIODS.CUSTOM && (
              <>
                <DatePicker
                  label={t("gamification.leaderboard.from")}
                  placeholder={t("gamification.leaderboard.from")}
                  value={from || undefined}
                  maxDate={to || undefined}
                  onChange={(value) => setFrom(value ?? "")}
                  testId={LEADERBOARD_HANDLES.FROM_INPUT}
                  className="w-full"
                />
                <DatePicker
                  label={t("gamification.leaderboard.to")}
                  placeholder={t("gamification.leaderboard.to")}
                  value={to || undefined}
                  minDate={from || undefined}
                  onChange={(value) => setTo(value ?? "")}
                  testId={LEADERBOARD_HANDLES.TO_INPUT}
                  className="w-full"
                />
              </>
            )}
          </div>
        )}

        {renderContent()}
      </section>
    </PageWrapper>
  );
}
