import { REWARD_ACTION_TYPES } from "@repo/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useArchiveRewardAchievement,
  useBackfillRewards,
  useUpdateRewardRule,
  useUpsertRewardAchievement,
} from "~/api/mutations/rewards/useRewardMutations";
import { useRewardAchievements } from "~/api/queries/rewards/useRewardAchievements";
import { useRewardRules } from "~/api/queries/rewards/useRewardRules";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import type { RewardActionType } from "@repo/shared";
import type { RewardAchievement, RewardRule } from "~/api/queries/rewards/types";

const actionLabels: Record<string, string> = {
  [REWARD_ACTION_TYPES.CHAPTER_COMPLETED]: "Chapter completion",
  [REWARD_ACTION_TYPES.AI_CONVERSATION_PASSED]: "Passed AI conversation",
  [REWARD_ACTION_TYPES.COURSE_COMPLETED]: "Course completion",
};

const emptyAchievement = {
  title: { en: "" },
  description: { en: "" },
  pointThreshold: 0,
  sortOrder: 0,
  iconResourceId: "",
};

type RewardRuleFormProps = {
  rule: RewardRule;
  updateRule: {
    isPending: boolean;
    mutate: (input: { actionType: RewardActionType; points: number; enabled: boolean }) => void;
  };
};

function RewardRuleForm({ rule, updateRule }: RewardRuleFormProps) {
  const { t } = useTranslation();
  const [points, setPoints] = useState(rule.points);
  const [enabled, setEnabled] = useState(rule.enabled);

  useEffect(() => {
    setPoints(rule.points);
    setEnabled(rule.enabled);
  }, [rule.enabled, rule.points]);

  const hasChanges = points !== rule.points || enabled !== rule.enabled;

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!hasChanges) return;

        updateRule.mutate({
          actionType: rule.actionType,
          points,
          enabled,
        });
      }}
    >
      <h2 className="body-base-md text-neutral-950">{actionLabels[rule.actionType]}</h2>
      <label className="body-sm flex flex-col gap-1 text-neutral-700">
        {t("rewards.admin.points", "Points")}
        <Input
          name="points"
          type="number"
          min={0}
          value={points}
          onChange={(event) => setPoints(Number(event.target.value))}
        />
      </label>
      <label className="body-sm flex items-center gap-2 text-neutral-700">
        <input
          name="enabled"
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        {t("rewards.admin.enabled", "Enabled")}
      </label>
      <Button type="submit" disabled={!hasChanges || updateRule.isPending}>
        {t("common.save", "Save")}
      </Button>
    </form>
  );
}

export default function AdminRewardsPage() {
  const { t } = useTranslation();
  const { data: rules } = useRewardRules();
  const { data: achievements } = useRewardAchievements();
  const updateRule = useUpdateRewardRule();
  const upsertAchievement = useUpsertRewardAchievement();
  const archiveAchievement = useArchiveRewardAchievement();
  const backfillRewards = useBackfillRewards();
  const [draftAchievement, setDraftAchievement] = useState(emptyAchievement);

  const submitAchievement = (achievement?: RewardAchievement) => {
    const source = achievement ?? draftAchievement;

    upsertAchievement.mutate({
      id: achievement?.id,
      title: source.title,
      description: source.description,
      pointThreshold: Number(source.pointThreshold),
      sortOrder: Number(source.sortOrder),
      iconResourceId: source.iconResourceId || null,
    });

    if (!achievement) setDraftAchievement(emptyAchievement);
  };

  return (
    <PageWrapper role="main" breadcrumbs={[{ href: "/admin/rewards", title: "Rewards" }]}>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="h5 text-neutral-950">{t("rewards.admin.title", "Rewards")}</h1>
            <Button variant="outline" onClick={() => backfillRewards.mutate()}>
              {t("rewards.admin.backfill", "Backfill points")}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {rules?.map((rule) => (
              <RewardRuleForm key={rule.actionType} rule={rule} updateRule={updateRule} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
          <h2 className="h6 text-neutral-950">{t("rewards.admin.achievements", "Achievements")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
              <Input
                placeholder="Title"
                value={draftAchievement.title.en}
                onChange={(event) =>
                  setDraftAchievement((draft) => ({
                    ...draft,
                    title: { en: event.target.value },
                  }))
                }
              />
              <Input
                placeholder="Description"
                value={draftAchievement.description.en}
                onChange={(event) =>
                  setDraftAchievement((draft) => ({
                    ...draft,
                    description: { en: event.target.value },
                  }))
                }
              />
              <Input
                placeholder="Point threshold"
                type="number"
                min={0}
                value={draftAchievement.pointThreshold}
                onChange={(event) =>
                  setDraftAchievement((draft) => ({
                    ...draft,
                    pointThreshold: Number(event.target.value),
                  }))
                }
              />
              <Input
                placeholder="Icon resource ID"
                value={draftAchievement.iconResourceId}
                onChange={(event) =>
                  setDraftAchievement((draft) => ({
                    ...draft,
                    iconResourceId: event.target.value,
                  }))
                }
              />
              <Button onClick={() => submitAchievement()}>
                {t("rewards.admin.addAchievement", "Add achievement")}
              </Button>
            </div>

            {achievements?.map((achievement) => (
              <form
                key={achievement.id}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  upsertAchievement.mutate({
                    id: achievement.id,
                    title: { en: String(form.get("title") ?? achievement.title.en ?? "") },
                    description: {
                      en: String(form.get("description") ?? achievement.description.en ?? ""),
                    },
                    pointThreshold: Number(
                      form.get("pointThreshold") ?? achievement.pointThreshold,
                    ),
                    sortOrder: Number(form.get("sortOrder") ?? achievement.sortOrder),
                    iconResourceId: String(form.get("iconResourceId") ?? "") || null,
                  });
                }}
              >
                <div className="flex items-center gap-3">
                  {achievement.iconUrl && (
                    <img
                      src={achievement.iconUrl}
                      alt=""
                      className="size-10 rounded object-cover"
                    />
                  )}
                  <div>
                    <p className="body-base-md text-neutral-950">{achievement.title.en}</p>
                    <p className="body-sm text-neutral-700">{achievement.description.en}</p>
                  </div>
                </div>
                <Input name="title" defaultValue={achievement.title.en} />
                <Input name="description" defaultValue={achievement.description.en} />
                <Input
                  name="pointThreshold"
                  type="number"
                  min={0}
                  defaultValue={achievement.pointThreshold}
                />
                <Input name="sortOrder" type="number" defaultValue={achievement.sortOrder} />
                <Input name="iconResourceId" defaultValue={achievement.iconResourceId ?? ""} />
                <div className="flex gap-2">
                  <Button type="submit">{t("common.save", "Save")}</Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={achievement.archived}
                    onClick={() => archiveAchievement.mutate(achievement.id)}
                  >
                    {achievement.archived
                      ? t("rewards.admin.archived", "Archived")
                      : t("rewards.admin.archive", "Archive")}
                  </Button>
                </div>
              </form>
            ))}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
