import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

import { evaluateAchievementUnlocks } from "src/gamification/achievement.evaluator";
import { AchievementsService } from "src/gamification/achievements.service";

import type { UUIDType } from "src/common";
import type {
  Achievement,
  CreateAchievementBody,
  UpdateAchievementBody,
} from "src/gamification/schemas/achievement.schema";

type AchievementRecord = Omit<
  Achievement,
  "localizedName" | "localizedDescription" | "translations"
> & {
  translations: Achievement["translations"];
};

const tenantId = "00000000-0000-0000-0000-000000000001" as UUIDType;
const otherTenantId = "00000000-0000-0000-0000-000000000002" as UUIDType;

const fullTranslations = (suffix = "") => ({
  en: { name: `First${suffix}`, description: `First description${suffix}` },
  pl: { name: `Pierwsze${suffix}`, description: `Pierwszy opis${suffix}` },
  de: { name: `Erste${suffix}`, description: `Erste Beschreibung${suffix}` },
  lt: { name: `Pirmas${suffix}`, description: `Pirmas aprašymas${suffix}` },
  cs: { name: `První${suffix}`, description: `První popis${suffix}` },
});

class FakeAchievementsRepository {
  achievements: AchievementRecord[] = [];
  userStatistics: Array<{ userId: UUIDType; tenantId: UUIDType; totalPoints: number }> = [];
  userAchievements: Array<{
    userId: UUIDType;
    tenantId: UUIDType;
    achievementId: UUIDType;
    unlockedAt: string;
  }> = [];

  async findAll(params: {
    tenantId: string;
    includeInactive: boolean;
    language: SupportedLanguages;
  }) {
    return this.achievements
      .filter((achievement) => achievement.tenantId === params.tenantId)
      .filter((achievement) => params.includeInactive || achievement.isActive)
      .map((achievement) => this.localize(achievement, params.language));
  }

  async findById(params: { id: string; tenantId: string; language: SupportedLanguages }) {
    const achievement = this.achievements.find(
      (item) => item.id === params.id && item.tenantId === params.tenantId,
    );

    return achievement ? this.localize(achievement, params.language) : null;
  }

  async findProfileAchievements(params: {
    userId: UUIDType;
    tenantId: UUIDType;
    language: SupportedLanguages;
  }) {
    const totalPoints =
      this.userStatistics.find(
        (statistics) =>
          statistics.userId === params.userId && statistics.tenantId === params.tenantId,
      )?.totalPoints ?? 0;

    const profileAchievements = this.achievements
      .filter((achievement) => achievement.tenantId === params.tenantId)
      .filter((achievement) =>
        achievement.isActive
          ? true
          : this.userAchievements.some(
              (userAchievement) =>
                userAchievement.userId === params.userId &&
                userAchievement.tenantId === params.tenantId &&
                userAchievement.achievementId === achievement.id,
            ),
      )
      .map((achievement) => {
        const unlockedAt =
          this.userAchievements.find(
            (userAchievement) =>
              userAchievement.userId === params.userId &&
              userAchievement.tenantId === params.tenantId &&
              userAchievement.achievementId === achievement.id,
          )?.unlockedAt ?? null;
        const pointsRemaining = Math.max(achievement.pointThreshold - totalPoints, 0);

        return {
          ...this.localize(achievement, params.language),
          unlockedAt,
          progress: {
            currentTotal: totalPoints,
            threshold: achievement.pointThreshold,
            pointsRemaining,
            percentage: Math.min(100, Math.floor((totalPoints / achievement.pointThreshold) * 100)),
          },
        };
      });

    return { totalPoints, achievements: profileAchievements };
  }

  async create(tenant: string, payload: CreateAchievementBody) {
    const id =
      `00000000-0000-0000-0000-${String(this.achievements.length + 10).padStart(12, "0")}` as UUIDType;
    const created: AchievementRecord = {
      id,
      tenantId: tenant,
      imageReference: payload.imageReference,
      pointThreshold: payload.pointThreshold,
      isActive: payload.isActive ?? true,
      createdAt: "2026-04-29T00:00:00.000Z",
      updatedAt: "2026-04-29T00:00:00.000Z",
      translations: Object.entries(payload.translations).map(([locale, value]) => ({
        locale: locale as SupportedLanguages,
        ...value,
      })),
    };

    this.achievements.push(created);

    if (created.isActive) this.retroactivelyUnlockAchievement(created);

    return created;
  }

  async update(params: { id: string; tenantId: string; payload: UpdateAchievementBody }) {
    const achievement = this.achievements.find(
      (item) => item.id === params.id && item.tenantId === params.tenantId,
    );

    if (!achievement) return null;

    const previousThreshold = achievement.pointThreshold;

    Object.assign(achievement, {
      ...(params.payload.imageReference !== undefined && {
        imageReference: params.payload.imageReference,
      }),
      ...(params.payload.pointThreshold !== undefined && {
        pointThreshold: params.payload.pointThreshold,
      }),
      ...(params.payload.isActive !== undefined && { isActive: params.payload.isActive }),
      updatedAt: "2026-04-29T01:00:00.000Z",
    });

    if (params.payload.translations) {
      achievement.translations = Object.entries(params.payload.translations).map(
        ([locale, value]) => ({ locale: locale as SupportedLanguages, ...value }),
      );
    }

    if (
      achievement.isActive &&
      params.payload.pointThreshold !== undefined &&
      params.payload.pointThreshold < previousThreshold
    ) {
      this.retroactivelyUnlockAchievement(achievement);
    }

    return achievement;
  }

  async softDelete(id: string, tenant: string) {
    return this.update({ id, tenantId: tenant, payload: { isActive: false } });
  }

  private retroactivelyUnlockAchievement(achievement: AchievementRecord) {
    for (const statistics of this.userStatistics) {
      const alreadyHeld = this.userAchievements.some(
        (userAchievement) =>
          userAchievement.userId === statistics.userId &&
          userAchievement.tenantId === achievement.tenantId &&
          userAchievement.achievementId === achievement.id,
      );
      const shouldUnlock = evaluateAchievementUnlocks(
        statistics.totalPoints,
        [],
        [achievement],
      ).includes(achievement.id);

      if (statistics.tenantId === achievement.tenantId && !alreadyHeld && shouldUnlock) {
        this.userAchievements.push({
          userId: statistics.userId,
          tenantId: achievement.tenantId,
          achievementId: achievement.id,
          unlockedAt: "2026-04-29T02:00:00.000Z",
        });
      }
    }
  }

  private localize(achievement: AchievementRecord, language: SupportedLanguages): Achievement {
    const localized =
      achievement.translations.find((translation) => translation.locale === language) ??
      achievement.translations.find((translation) => translation.locale === SUPPORTED_LANGUAGES.EN);

    return {
      ...achievement,
      localizedName: localized?.name ?? "",
      localizedDescription: localized?.description ?? "",
    };
  }
}

describe("AchievementsService", () => {
  const createService = () => {
    const repository = new FakeAchievementsRepository();
    const fileService = {
      uploadFile: jest.fn(),
      getFileUrl: jest.fn(async (key) => `signed://${key}`),
    };

    return {
      repository,
      fileService,
      service: new AchievementsService(repository as never, fileService as never),
    };
  };

  it("creates an achievement with a full translation set", async () => {
    const { service } = createService();

    const achievement = await service.create(tenantId, {
      imageReference: "achievements/badge.png",
      pointThreshold: 100,
      translations: fullTranslations(),
    });

    expect(achievement.pointThreshold).toBe(100);
    expect(achievement.isActive).toBe(true);
    expect(achievement.translations).toHaveLength(5);
    expect(achievement.localizedName).toBe("First");
  });

  it("edits image, translations, threshold, and active state", async () => {
    const { service } = createService();
    const created = await service.create(tenantId, {
      imageReference: "achievements/original.png",
      pointThreshold: 100,
      translations: fullTranslations(),
    });

    const updated = await service.update({
      id: created.id,
      tenantId,
      payload: {
        imageReference: "achievements/updated.png",
        pointThreshold: 150,
        isActive: false,
        translations: fullTranslations(" Updated"),
      },
    });

    expect(updated.imageReference).toBe("achievements/updated.png");
    expect(updated.pointThreshold).toBe(150);
    expect(updated.isActive).toBe(false);
    expect(updated.localizedName).toBe("First Updated");
  });

  it("soft-deletes achievements and hides them from the default list", async () => {
    const { service } = createService();
    const created = await service.create(tenantId, {
      imageReference: "achievements/badge.png",
      pointThreshold: 100,
      translations: fullTranslations(),
    });

    await service.softDelete(created.id, tenantId);

    await expect(service.findAll({ tenantId })).resolves.toEqual([]);
    await expect(service.findAll({ tenantId, includeInactive: true })).resolves.toHaveLength(1);
  });

  it("retroactively unlocks a newly created active achievement for existing qualifying users", async () => {
    const { repository, service } = createService();
    const qualifyingUserId = "00000000-0000-0000-0000-000000000101" as UUIDType;
    const nonQualifyingUserId = "00000000-0000-0000-0000-000000000102" as UUIDType;
    repository.userStatistics.push(
      { userId: qualifyingUserId, tenantId, totalPoints: 125 },
      { userId: nonQualifyingUserId, tenantId, totalPoints: 50 },
    );

    const created = await service.create(tenantId, {
      imageReference: "achievements/retro.png",
      pointThreshold: 100,
      translations: fullTranslations(),
    });

    expect(repository.userAchievements).toEqual([
      expect.objectContaining({ achievementId: created.id, userId: qualifyingUserId, tenantId }),
    ]);
  });

  it("retroactively unlocks all qualifying users when a threshold is lowered", async () => {
    const { repository, service } = createService();
    const firstUserId = "00000000-0000-0000-0000-000000000201" as UUIDType;
    const secondUserId = "00000000-0000-0000-0000-000000000202" as UUIDType;
    repository.userStatistics.push(
      { userId: firstUserId, tenantId, totalPoints: 125 },
      { userId: secondUserId, tenantId, totalPoints: 90 },
    );
    const created = await service.create(tenantId, {
      imageReference: "achievements/lower.png",
      pointThreshold: 150,
      translations: fullTranslations(),
    });

    await service.update({ id: created.id, tenantId, payload: { pointThreshold: 80 } });

    expect(repository.userAchievements).toEqual([
      expect.objectContaining({ achievementId: created.id, userId: firstUserId, tenantId }),
      expect.objectContaining({ achievementId: created.id, userId: secondUserId, tenantId }),
    ]);
  });

  it("does not revoke already-held achievements when a threshold is raised", async () => {
    const { repository, service } = createService();
    const userId = "00000000-0000-0000-0000-000000000301" as UUIDType;
    repository.userStatistics.push({ userId, tenantId, totalPoints: 125 });
    const created = await service.create(tenantId, {
      imageReference: "achievements/raise.png",
      pointThreshold: 100,
      translations: fullTranslations(),
    });

    await service.update({ id: created.id, tenantId, payload: { pointThreshold: 200 } });

    expect(repository.userAchievements).toEqual([
      expect.objectContaining({ achievementId: created.id, userId, tenantId }),
    ]);
  });

  it("keeps soft-deleted held achievements on profiles while hiding unheld inactive badges", async () => {
    const { repository, service } = createService();
    const holderId = "00000000-0000-0000-0000-000000000401" as UUIDType;
    const viewerId = "00000000-0000-0000-0000-000000000402" as UUIDType;
    repository.userStatistics.push({ userId: holderId, tenantId, totalPoints: 125 });
    const created = await service.create(tenantId, {
      imageReference: "achievements/held.png",
      pointThreshold: 100,
      translations: fullTranslations(),
    });

    repository.userStatistics.push({ userId: viewerId, tenantId, totalPoints: 125 });
    await service.softDelete(created.id, tenantId);

    await expect(service.findProfileAchievements({ userId: holderId, tenantId })).resolves.toEqual(
      expect.objectContaining({
        achievements: [expect.objectContaining({ id: created.id, unlockedAt: expect.any(String) })],
      }),
    );
    await expect(service.findProfileAchievements({ userId: viewerId, tenantId })).resolves.toEqual(
      expect.objectContaining({ achievements: [] }),
    );
  });

  it("accepts duplicate thresholds within the same tenant", async () => {
    const { service } = createService();

    await service.create(tenantId, {
      imageReference: "achievements/first.png",
      pointThreshold: 100,
      translations: fullTranslations(" 1"),
    });
    await service.create(tenantId, {
      imageReference: "achievements/second.png",
      pointThreshold: 100,
      translations: fullTranslations(" 2"),
    });

    const achievements = await service.findAll({ tenantId });

    expect(achievements).toHaveLength(2);
    expect(achievements.every((achievement) => achievement.pointThreshold === 100)).toBe(true);
  });

  it("does not expose achievements from another tenant", async () => {
    const { service } = createService();

    await service.create(tenantId, {
      imageReference: "achievements/first.png",
      pointThreshold: 100,
      translations: fullTranslations(" 1"),
    });
    await service.create(otherTenantId, {
      imageReference: "achievements/second.png",
      pointThreshold: 100,
      translations: fullTranslations(" 2"),
    });

    await expect(service.findAll({ tenantId })).resolves.toHaveLength(1);
  });
});
