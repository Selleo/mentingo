import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRewardGroups } from "~/api/queries/rewards/useRewardGroups";
import { useRewardsLeaderboard } from "~/api/queries/rewards/useRewardsLeaderboard";
import { useRewardsProfile } from "~/api/queries/rewards/useRewardsProfile";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { LocalizedText } from "~/api/queries/rewards/types";

type RewardsPanelProps = {
  userId: string;
};

const resolveText = (value: LocalizedText, language: string) =>
  value[language] ?? value.en ?? Object.values(value)[0] ?? "";

export function RewardsPanel({ userId }: RewardsPanelProps) {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const [groupId, setGroupId] = useState<string | undefined>();

  const { data: profile } = useRewardsProfile(userId);
  const { data: leaderboard } = useRewardsLeaderboard(groupId);
  const { data: groups } = useRewardGroups();

  const earned = useMemo(
    () => profile?.achievements.filter((achievement) => achievement.earnedAt) ?? [],
    [profile],
  );
  const inProgress = useMemo(
    () => profile?.achievements.filter((achievement) => !achievement.earnedAt) ?? [],
    [profile],
  );

  return (
    <section className="flex w-full max-w-[720px] flex-col gap-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="h6 md:h4 text-neutral-950">{t("rewards.title", "Rewards")}</h2>
          <p className="body-sm text-neutral-700">
            {t("rewards.totalPoints", "Total points")}:{" "}
            <span className="font-semibold text-neutral-950">{profile?.totalPoints ?? 0}</span>
          </p>
        </div>
        <Icon name="Ribbon" className="size-10 text-primary-600" />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="body-base-md text-neutral-950">
          {t("rewards.achievements", "Achievements")}
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {[...earned, ...inProgress].map((achievement) => {
            const progress =
              profile?.totalPoints && achievement.pointThreshold
                ? Math.min(
                    100,
                    Math.round((profile.totalPoints / achievement.pointThreshold) * 100),
                  )
                : 0;

            return (
              <div
                key={achievement.id}
                className="flex min-h-[116px] gap-3 rounded-lg border border-neutral-200 p-3"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary-50">
                  {achievement.iconUrl ? (
                    <img
                      src={achievement.iconUrl}
                      alt=""
                      className="size-10 rounded-md object-cover"
                    />
                  ) : (
                    <Icon name="CertificateTrophy" className="size-7 text-primary-700" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <p className="body-sm-md truncate text-neutral-950">
                      {resolveText(achievement.title, language)}
                    </p>
                    <p className="body-xs line-clamp-2 text-neutral-700">
                      {resolveText(achievement.description, language)}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: `${achievement.earnedAt ? 100 : progress}%` }}
                    />
                  </div>
                  <p className="body-xs text-neutral-700">
                    {achievement.earnedAt
                      ? t("rewards.earned", "Earned")
                      : t("rewards.pointsRequired", "{{count}} points left", {
                          count: achievement.pointsRequired,
                        })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h3 className="body-base-md text-neutral-950">
            {t("rewards.leaderboard", "Leaderboard")}
          </h3>
          <select
            className="body-sm h-10 rounded-lg border border-neutral-300 bg-white px-3 text-neutral-950"
            value={groupId ?? ""}
            onChange={(event) => setGroupId(event.target.value || undefined)}
          >
            <option value="">{t("rewards.allCompany", "All Company")}</option>
            {groups?.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col divide-y divide-neutral-100">
          {leaderboard?.entries.map((entry) => (
            <div key={entry.userId} className="flex items-center gap-3 py-3">
              <span className="body-sm-md w-8 text-neutral-700">{entry.rank}</span>
              <UserAvatar
                className="size-9"
                userName={`${entry.firstName} ${entry.lastName}`}
                profilePictureUrl={entry.profilePictureUrl}
              />
              <span className="body-sm-md flex-1 text-neutral-950">
                {entry.firstName} {entry.lastName}
              </span>
              <span className="body-sm text-neutral-700">{entry.totalPoints}</span>
            </div>
          ))}
          {leaderboard?.currentUserRank && (
            <div className="flex items-center gap-3 py-3">
              <span className="body-sm-md w-8 text-neutral-700">
                {leaderboard.currentUserRank.rank}
              </span>
              <UserAvatar
                className="size-9"
                userName={`${leaderboard.currentUserRank.firstName} ${leaderboard.currentUserRank.lastName}`}
                profilePictureUrl={leaderboard.currentUserRank.profilePictureUrl}
              />
              <span className="body-sm-md flex-1 text-neutral-950">
                {leaderboard.currentUserRank.firstName} {leaderboard.currentUserRank.lastName}
              </span>
              <span className="body-sm text-neutral-700">
                {leaderboard.currentUserRank.totalPoints}
              </span>
            </div>
          )}
          {!leaderboard?.entries.length && (
            <div className="py-4">
              <Button variant="outline" disabled className="w-full">
                {t("rewards.noLeaderboard", "No ranked users yet")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
