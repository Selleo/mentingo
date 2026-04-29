import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

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

    return created;
  }

  async update(params: { id: string; tenantId: string; payload: UpdateAchievementBody }) {
    const achievement = this.achievements.find(
      (item) => item.id === params.id && item.tenantId === params.tenantId,
    );

    if (!achievement) return null;

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

    return achievement;
  }

  async softDelete(id: string, tenant: string) {
    return this.update({ id, tenantId: tenant, payload: { isActive: false } });
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
