import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { PERMISSIONS } from "@repo/shared";
import request from "supertest";

import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { SettingsController } from "src/settings/settings.controller";
import { SettingsService } from "src/settings/settings.service";

import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

describe("Settings support-mode boundaries", () => {
  let app: INestApplication;
  let permissions: string[];
  const actor = { userId: "support-user", isSupportMode: true };
  const updateGlobalPublicCoursePreviewEnabled = jest.fn();
  const updateUserSettings = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: { updateGlobalPublicCoursePreviewEnabled, updateUserSettings },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { ...actor, permissions };
      next();
    });
    app.useGlobalGuards(new PermissionsGuard(new Reflector()));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    permissions = [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.SETTINGS_UPDATE_SELF];
    updateGlobalPublicCoursePreviewEnabled.mockResolvedValue({
      ...DEFAULT_GLOBAL_SETTINGS,
      ageLimit: null,
      publicCoursePreviewEnabled: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows an authorized support user to toggle the global public course preview", async () => {
    const response = await request(app.getHttpServer())
      .patch("/settings/admin/public-course-preview")
      .expect(200);

    expect(response.body.data.publicCoursePreviewEnabled).toBe(true);
    expect(updateGlobalPublicCoursePreviewEnabled).toHaveBeenCalledWith({ ...actor, permissions });
  });

  it("still requires settings management permission in support mode", async () => {
    permissions = [PERMISSIONS.SETTINGS_UPDATE_SELF];
    await request(app.getHttpServer()).patch("/settings/admin/public-course-preview").expect(403);
    expect(updateGlobalPublicCoursePreviewEnabled).not.toHaveBeenCalled();
  });

  it("still blocks personal settings updates in support mode", async () => {
    const response = await request(app.getHttpServer()).put("/settings").send({}).expect(403);
    expect(response.body.message).toBe("supportMode.errors.personalSettingsBlocked");
    expect(updateUserSettings).not.toHaveBeenCalled();
  });
});
