import { NotFoundException } from "@nestjs/common";

import { GamificationService } from "./gamification.service";

import type { GamificationRepository } from "./gamification.repository";
import type { WsGateway, GamificationEventPayload } from "src/websocket";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const SOURCE_ID = "33333333-3333-3333-3333-333333333333";

describe("GamificationService", () => {
  const createService = (progressRow: unknown | null = null) => {
    const gamificationRepository: jest.Mocked<
      Pick<
        GamificationRepository,
        | "getUserProgress"
        | "insertUserProgress"
        | "getUserAchievementProgress"
        | "insertUserAchievementLevel"
        | "addXpToUser"
        | "incrementUserLevel"
        | "getCurrentStreak"
        | "getActivityLogCount"
      >
    > = {
      getUserProgress: jest.fn().mockResolvedValue(progressRow),
      insertUserProgress: jest.fn().mockResolvedValue(undefined),
      getUserAchievementProgress: jest.fn().mockResolvedValue([]),
      insertUserAchievementLevel: jest.fn().mockResolvedValue({ id: "new-id" }),
      addXpToUser: jest.fn().mockResolvedValue(undefined),
      incrementUserLevel: jest.fn().mockResolvedValue(undefined),
      getCurrentStreak: jest.fn().mockResolvedValue(5),
      getActivityLogCount: jest.fn().mockResolvedValue(3),
    };

    const wsGateway = {
      emitToUser: jest.fn(),
      waitForConnection: jest.fn().mockResolvedValue(true),
    } as unknown as WsGateway;

    return {
      service: new GamificationService(
        gamificationRepository as unknown as GamificationRepository,
        wsGateway,
      ),
      gamificationRepository,
      wsGateway,
    };
  };

  const baseEvent: GamificationEventPayload = {
    userId: USER_ID,
    tenantId: TENANT_ID,
    sourceId: SOURCE_ID,
    actorRole: "student",
    actionType: "complete_lesson",
    resourceType: "lesson",
    canViewHidden: false,
  };

  const level = {
    id: "level-id",
    levelNumber: 1,
    threshold: 2,
    xpReward: 50,
    achievementName: "Hero",
  };

  // ─── getUserProgress ────────────────────────────────────────────────────────

  describe("getUserProgress", () => {
    it("returns the progress record when it exists", async () => {
      const progressRecord = { userId: USER_ID, lifetimeXp: 150, spendableXp: 50, currentLevel: 2 };
      const { service } = createService(progressRecord);

      const result = await service.getUserProgress(USER_ID);

      expect(result).toEqual(progressRecord);
    });

    it("throws NotFoundException when user has no progress record", async () => {
      const { service } = createService(null);

      await expect(service.getUserProgress(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it("throws with correct message key", async () => {
      const { service } = createService(null);

      await expect(service.getUserProgress(USER_ID)).rejects.toThrow(
        "gamification.errors.userProgressNotFound",
      );
    });
  });

  // ─── resolveThreshold ───────────────────────────────────────────────────────

  describe("resolveThreshold", () => {
    it("returns current streak for login event", async () => {
      const { service, gamificationRepository } = createService();
      gamificationRepository.getCurrentStreak.mockResolvedValue(7);

      const result = await service.resolveThreshold({
        ...baseEvent,
        resourceType: "user",
        actionType: "login",
      });

      expect(result).toBe(7);
      expect(gamificationRepository.getCurrentStreak).toHaveBeenCalledWith(USER_ID, undefined);
    });

    it("returns activity log count for complete_lesson", async () => {
      const { service, gamificationRepository } = createService();
      gamificationRepository.getActivityLogCount.mockResolvedValue(4);

      const result = await service.resolveThreshold(baseEvent);

      expect(result).toBe(4);
      expect(gamificationRepository.getActivityLogCount).toHaveBeenCalledWith(
        USER_ID,
        "complete_lesson",
        "lesson",
        undefined,
      );
    });

    it("returns activity log count for complete_chapter", async () => {
      const { service, gamificationRepository } = createService();
      gamificationRepository.getActivityLogCount.mockResolvedValue(2);

      const result = await service.resolveThreshold({
        ...baseEvent,
        resourceType: "chapter",
        actionType: "complete_chapter",
      });

      expect(result).toBe(2);
    });

    it("returns activity log count for complete_course", async () => {
      const { service, gamificationRepository } = createService();
      gamificationRepository.getActivityLogCount.mockResolvedValue(1);

      const result = await service.resolveThreshold({
        ...baseEvent,
        resourceType: "course",
        actionType: "complete_course",
      });

      expect(result).toBe(1);
    });

    it("returns null for unrecognised resourceType", async () => {
      const { service } = createService();

      const result = await service.resolveThreshold({
        ...baseEvent,
        resourceType: "quiz",
        actionType: "complete_quiz",
      });

      expect(result).toBeNull();
    });
  });

  // ─── processAchievements ────────────────────────────────────────────────────

  describe("processAchievements", () => {
    it("returns null when no level meets the threshold", async () => {
      const { service, gamificationRepository } = createService();

      const result = await service.processAchievements([{ ...level, threshold: 10 }], 3, baseEvent);

      expect(result).toBeNull();
      expect(gamificationRepository.insertUserAchievementLevel).not.toHaveBeenCalled();
    });

    it("inserts userAchievementLevel and awards XP when threshold is met", async () => {
      const { service, gamificationRepository } = createService();

      await service.processAchievements([level], 3, baseEvent);

      expect(gamificationRepository.insertUserAchievementLevel).toHaveBeenCalledWith(
        USER_ID,
        level.id,
        SOURCE_ID,
        undefined,
      );
      expect(gamificationRepository.addXpToUser).toHaveBeenCalledWith(
        USER_ID,
        level.xpReward,
        undefined,
      );
    });

    it("does not re-award a level already earned", async () => {
      const { service, gamificationRepository } = createService();
      gamificationRepository.getUserAchievementProgress.mockResolvedValue([
        { achievementLevelId: level.id } as any,
      ]);

      const result = await service.processAchievements([level], 5, baseEvent);

      expect(result).toBeNull();
      expect(gamificationRepository.insertUserAchievementLevel).not.toHaveBeenCalled();
    });

    it("returns the highest newly earned level", async () => {
      const level2 = { ...level, id: "level-2-id", levelNumber: 2, threshold: 1 };
      const { service } = createService();

      const result = await service.processAchievements([level, level2], 5, baseEvent);

      expect(result).toEqual(
        expect.objectContaining({ level: expect.objectContaining({ levelNumber: 2 }) }),
      );
    });

    it("creates userProgress row if none exists yet", async () => {
      const { service, gamificationRepository } = createService(null);

      await service.processAchievements([level], 5, baseEvent);

      expect(gamificationRepository.insertUserProgress).toHaveBeenCalledWith(USER_ID, undefined);
    });

    it("increments level when lifetimeXp crosses threshold", async () => {
      const { service, gamificationRepository } = createService({
        userId: USER_ID,
        currentLevel: 1,
        lifetimeXp: 0,
        spendableXp: 0,
      });
      gamificationRepository.getUserProgress
        .mockResolvedValueOnce({
          id: "p-id",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
          tenantId: TENANT_ID,
          userId: USER_ID,
          currentLevel: 1,
          lifetimeXp: 0,
          spendableXp: 0,
        })
        .mockResolvedValueOnce({
          id: "p-id",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
          tenantId: TENANT_ID,
          userId: USER_ID,
          currentLevel: 1,
          lifetimeXp: 150,
          spendableXp: 150,
        });

      await service.processAchievements([level], 5, baseEvent);

      expect(gamificationRepository.incrementUserLevel).toHaveBeenCalledWith(USER_ID, undefined);
    });
  });

  // ─── emitAchievementNotification ────────────────────────────────────────────

  describe("emitAchievementNotification", () => {
    it("waits for connection then emits to user", async () => {
      const { service, wsGateway } = createService();

      await service.emitAchievementNotification(USER_ID, {
        userAchievementId: "award-id",
        level: { ...level, levelNumber: 2 },
      });

      expect(wsGateway.waitForConnection).toHaveBeenCalledWith(USER_ID);
      expect(wsGateway.emitToUser).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.objectContaining({
          userAchievementId: "award-id",
          level: 2,
        }),
      );
    });
  });
});
