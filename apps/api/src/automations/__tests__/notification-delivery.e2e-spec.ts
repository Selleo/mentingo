import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { setupEmailTemplateTest } from "src/email-templates/__tests__/email-template-test.helpers";
import { OutboxDispatcherService } from "src/outbox/outbox-dispatcher.service";
import { OutboxListenerService } from "src/outbox/outbox-listener.service";
import * as outboxConstants from "src/outbox/outbox.constants";
import { automationEmailDeliveries } from "src/storage/schema";
import { TenantsService } from "src/super-admin/tenants.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

describe("Tenant administrator invitation delivery (e2e)", () => {
  it("delivers a new tenant invitation through the outbox listener and email worker", async () => {
    const t = await setupEmailTemplateTest();
    const processing = jest
      .spyOn(outboxConstants, "isOutboxProcessingEnabled")
      .mockReturnValue(true);
    const listener = new OutboxListenerService(
      new ConfigService({ database: { urlApp: process.env.DATABASE_URL } }),
      t.app.get(OutboxDispatcherService),
    );
    const email = `tenant-invitation-${randomUUID()}@example.com`;
    const host = `https://${randomUUID()}.example.com`;
    const actor: CurrentUserType = {
      userId: t.admin.id,
      tenantId: t.defaultTenantId,
      email: t.admin.email,
      roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: [],
    };

    try {
      await listener.onModuleInit();
      const tenant = await t.runAsTenant(t.defaultTenantId, () =>
        t.app.get(TenantsService).createTenant(
          {
            name: "Invitation tenant",
            host,
            adminEmail: email,
            adminFirstName: "Invitation",
            adminLastName: "Test",
            adminLanguage: "en",
          },
          actor,
        ),
      );

      for (let attempt = 0; attempt < 100 && !t.adapter.getAllEmails().length; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(t.adapter.getAllEmails()).toHaveLength(1);
      expect(t.adapter.getLastEmail()).toMatchObject({
        to: email,
        subject: "You're invited to the platform!",
        html: expect.stringContaining(`${host}/auth/create-new-password`),
      });
      const deliveries = await t.runAsTenant(tenant.id, () =>
        t.db
          .select({ recipient: automationEmailDeliveries.recipientEmail })
          .from(automationEmailDeliveries),
      );
      expect(deliveries).toEqual([{ recipient: email }]);
    } finally {
      processing.mockRestore();
      await listener.onModuleDestroy();
      await t.app.close();
    }
  });
});
