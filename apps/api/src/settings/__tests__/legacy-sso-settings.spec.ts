import { PATH_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { DEFAULT_GLOBAL_SETTINGS } from "../constants/settings.constants";
import { globalSettingsJSONSchema } from "../schemas/settings.schema";
import { SettingsController } from "../settings.controller";
import { SettingsService } from "../settings.service";

describe("removed legacy SSO setting", () => {
  it("returns 404 at the HTTP boundary without invoking the obsolete mutation", async () => {
    const updateGlobalEnforceSSO = jest.fn();
    const module = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: { updateGlobalEnforceSSO } }],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix("api");
    try {
      await app.init();
      await request(app.getHttpServer()).patch("/api/settings/admin/enforce-sso").expect(404);
      expect(updateGlobalEnforceSSO).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("does not expose the toggle route", () => {
    const routes = Object.getOwnPropertyNames(SettingsController.prototype).map((name) =>
      Reflect.getMetadata(PATH_METADATA, Reflect.get(SettingsController.prototype, name)),
    );
    expect(routes).not.toContain("admin/enforce-sso");
  });

  it("does not publish the legacy field in the settings contract", () => {
    expect(globalSettingsJSONSchema.properties).not.toHaveProperty("enforceSSO");
  });

  it("omits persisted legacy fields without mutating the stored settings", () => {
    const stored = { ...DEFAULT_GLOBAL_SETTINGS, enforceSSO: true };
    const service = Object.create(SettingsService.prototype);
    expect(service.parseGlobalSettings(stored)).not.toHaveProperty("enforceSSO");
    expect(stored.enforceSSO).toBe(true);
  });
});
