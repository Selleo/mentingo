import { AchievementsRepository } from "./achievements.repository";

import type { DatabasePg } from "src/common";
import type { LocalizationService } from "src/localization/localization.service";

const ACHIEVEMENT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("AchievementsRepository", () => {
  const createRepo = (queryResult: unknown[] = []) => {
    // Drizzle chains: select().from().where() → returns array
    // Also: select().from().where().orderBy() → returns array
    // Also: select().from().where().orderBy().limit() → returns array
    // Also: select().from().innerJoin().innerJoin().where() → returns array
    // where() needs to be both awaitable (returns array) and chainable (.orderBy())
    const whereResult = Object.assign(Promise.resolve(queryResult), {
      orderBy: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(queryResult) }),
    });
    const where = jest.fn().mockReturnValue(whereResult);
    const innerJoin = jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({ where }),
      where,
    });
    const from = jest.fn().mockReturnValue({ where, orderBy: jest.fn(), innerJoin });
    const select = jest.fn().mockReturnValue({ from });

    const returning = jest.fn().mockResolvedValue(queryResult);
    const deleteWhere = jest.fn().mockReturnValue({ returning });

    const db = {
      select,
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({ returning }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ returning }) }),
      }),
      delete: jest.fn().mockReturnValue({ where: deleteWhere }),
    };

    const localizationService = {
      getLocalizedSqlField: jest.fn().mockReturnValue("Localized Title"),
    } as unknown as LocalizationService;

    return {
      repo: new AchievementsRepository(db as unknown as DatabasePg, localizationService),
      db,
      localizationService,
    };
  };

  describe("getAchievementById", () => {
    it("returns achievement when found", async () => {
      const achievement = { id: ACHIEVEMENT_ID, title: { en: "Test" } };
      const { repo } = createRepo([achievement]);

      const result = await repo.getAchievementById(ACHIEVEMENT_ID);

      expect(result).toEqual(achievement);
    });

    it("returns null when not found", async () => {
      const { repo } = createRepo([]);

      const result = await repo.getAchievementById(ACHIEVEMENT_ID);

      expect(result).toBeNull();
    });
  });

  describe("getHighestLevelNumber", () => {
    it("returns the highest level number", async () => {
      const { repo } = createRepo([{ levelNumber: 3 }]);

      const result = await repo.getHighestLevelNumber(ACHIEVEMENT_ID);

      expect(result).toBe(3);
    });

    it("returns 0 when no levels exist", async () => {
      const { repo } = createRepo([]);

      const result = await repo.getHighestLevelNumber(ACHIEVEMENT_ID);

      expect(result).toBe(0);
    });
  });

  describe("getAchievementLevelByNumber", () => {
    it("returns level when found", async () => {
      const level = { id: "level-id", levelNumber: 2, threshold: 10, xpReward: 50 };
      const { repo } = createRepo([level]);

      const result = await repo.getAchievementLevelByNumber(ACHIEVEMENT_ID, 2);

      expect(result).toEqual(level);
    });

    it("returns null when not found", async () => {
      const { repo } = createRepo([]);

      const result = await repo.getAchievementLevelByNumber(ACHIEVEMENT_ID, 99);

      expect(result).toBeNull();
    });
  });

  describe("deleteAchievementById", () => {
    it("returns deleted row when achievement exists", async () => {
      const { repo } = createRepo([{ id: ACHIEVEMENT_ID }]);

      const result = await repo.deleteAchievementById(ACHIEVEMENT_ID);

      expect(result).toEqual({ id: ACHIEVEMENT_ID });
    });

    it("returns null when achievement does not exist", async () => {
      const { repo } = createRepo([]);

      const result = await repo.deleteAchievementById(ACHIEVEMENT_ID);

      expect(result).toBeNull();
    });
  });

  describe("getUserAchievements", () => {
    it("calls localizationService.getLocalizedSqlField with correct language", async () => {
      const { repo, localizationService } = createRepo([]);

      await repo.getUserAchievements("user-id", "pl");

      expect(localizationService.getLocalizedSqlField).toHaveBeenCalledWith(
        expect.anything(),
        "pl",
        expect.anything(),
      );
    });

    it("defaults to 'en' when language is not provided", async () => {
      const { repo, localizationService } = createRepo([]);

      await repo.getUserAchievements("user-id");

      expect(localizationService.getLocalizedSqlField).toHaveBeenCalledWith(
        expect.anything(),
        "en",
        expect.anything(),
      );
    });
  });
});
