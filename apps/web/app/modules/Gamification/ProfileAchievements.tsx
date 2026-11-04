import { PERMISSIONS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useUserGamificationProfile } from "~/api/queries/useUserGamificationProfile";
import { Button } from "~/components/ui/button";
import { usePermissions } from "~/hooks/usePermissions";

import { AchievementCard } from "./AchievementCard";
import { LevelProgress } from "./LevelProgress";

type ProfileAchievementsProps = {
  userId: string;
};

const SECTION_CLASS_NAME =
  "flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow";

/** Rendered on the viewer's own profile only; the API rejects other users' profiles for now. */
export function ProfileAchievements({ userId }: ProfileAchievementsProps) {
  const { t } = useTranslation();
  const { hasAccess } = usePermissions({ required: PERMISSIONS.GAMIFICATION_READ });
  const {
    data: profile,
    isError,
    refetch,
  } = useUserGamificationProfile(userId, { enabled: hasAccess });

  if (isError) {
    return (
      <section className={SECTION_CLASS_NAME}>
        <h2 className="h6 md:h4">{t("gamification.achievements")}</h2>
        <p className="body-sm text-neutral-600">{t("gamification.loadError")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => void refetch()}
        >
          {t("gamification.retry")}
        </Button>
      </section>
    );
  }

  if (!profile) return null;

  return (
    <section className={SECTION_CLASS_NAME}>
      <h2 className="h6 md:h4">{t("gamification.achievements")}</h2>
      <LevelProgress profile={profile} />
      {profile.achievements.length === 0 ? (
        <p className="body-sm text-neutral-600">{t("gamification.achievementsEmpty")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {profile.achievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </ul>
      )}
    </section>
  );
}
