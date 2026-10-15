import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { DefaultAutomationSetupService } from "src/automation-execution/services/default-automation-setup.service";
import { AutomationEmailWorker } from "src/automation-execution/workers/automation-email.worker";
import { DEFAULT_GLOBAL_SETTINGS } from "src/settings/constants/settings.constants";
import { SettingsService } from "src/settings/settings.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { automations, settings, tenants } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("legacy organization email switches migrate to automation state (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let admin: DatabasePg;
  let runner: TenantDbRunnerService;
  let provisioning: DefaultAutomationSetupService;
  beforeAll(async () => {
    ({ app } = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: AutomationEmailWorker, useValue: { onModuleDestroy: async () => {} } },
      ],
    }));
    db = app.get(DB);
    admin = app.get(DB_ADMIN);
    runner = app.get(TenantDbRunnerService);
    provisioning = app.get(DefaultAutomationSetupService);
  });
  afterAll(async () => {
    await app?.close();
  });
  const tenant = async () => {
    const [record] = await admin
      .insert(tenants)
      .values({ name: "Switch migration", host: `https://switch-${randomUUID()}.local` })
      .returning();
    return record.id;
  };
  it("uses saved legacy values once, keeps unconditional scenarios enabled, and hides switches from settings reads", async () => {
    const tenantId = await tenant();
    await runner.runWithTenant(tenantId, async () => {
      const legacySettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        userEmailTriggers: { userFirstLogin: true, userCourseAssignment: false },
      };
      await db.insert(settings).values({ settings: settingsToJSONBuildObject(legacySettings) });
      await provisioning.ensureTenantDefaultAutomations();
      const defaults = await db.select().from(automations);
      expect(defaults).toHaveLength(22);
      expect(defaults.find((item) => item.builtInKey === "user_first_login")?.status).toBe(
        "enabled",
      );
      expect(defaults.find((item) => item.builtInKey === "user_assigned_to_course")?.status).toBe(
        "disabled",
      );
      expect(defaults.find((item) => item.builtInKey === "user_short_inactivity")?.status).toBe(
        "disabled",
      );
      expect(defaults.find((item) => item.builtInKey === "welcome")?.status).toBe("enabled");
      const visible = await app.get(SettingsService).getPublicGlobalSettings();
      expect(visible).not.toHaveProperty("userEmailTriggers");
      const firstLogin = defaults.find((item) => item.builtInKey === "user_first_login")!;
      await db
        .update(automations)
        .set({ status: "archived" })
        .where(eq(automations.id, firstLogin.id));
      await provisioning.ensureTenantDefaultAutomations();
      const retained = await db.select().from(automations);
      expect(retained).toHaveLength(22);
      expect(retained.find((item) => item.id === firstLogin.id)?.status).toBe("archived");
    });
  });
  it("treats missing organization switches as false without changing unconditional defaults", async () => {
    const tenantId = await tenant();
    await runner.runWithTenant(tenantId, async () => {
      await db.insert(settings).values({ settings: DEFAULT_GLOBAL_SETTINGS });
      await provisioning.ensureTenantDefaultAutomations();
      const defaults = await db.select().from(automations);
      expect(
        defaults
          .filter((item) =>
            [
              "user_first_login",
              "user_assigned_to_course",
              "user_short_inactivity",
              "user_long_inactivity",
              "user_finished_chapter",
              "user_finished_course",
            ].includes(item.builtInKey ?? ""),
          )
          .every((item) => item.status === "disabled"),
      ).toBe(true);
      expect(defaults.find((item) => item.builtInKey === "password_recovery")?.status).toBe(
        "enabled",
      );
    });
  });
});
