import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { ActivityLogsService } from "./activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "./types";

import type { DatabasePg } from "src/common";

describe("ActivityLogsService", () => {
  const createService = () => {
    const returning = jest.fn().mockResolvedValue([
      {
        id: "44444444-4444-4444-4444-444444444444",
        actorId: "33333333-3333-3333-3333-333333333333",
        actorEmail: "support-admin@example.com",
        actorRole: SYSTEM_ROLE_SLUGS.ADMIN,
        actionType: ACTIVITY_LOG_ACTION_TYPES.LOGIN,
        resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
        resourceId: "11111111-1111-1111-1111-111111111111",
        metadata: {},
        createdAt: new Date().toISOString(),
      },
    ]);
    const values = jest.fn().mockReturnValue({ returning });
    const db = {
      insert: jest.fn().mockReturnValue({ values }),
    };

    const queue = {
      enqueueActivityLog: jest.fn(),
    };

    return {
      service: new ActivityLogsService(
        db as unknown as DatabasePg,
        queue as unknown as ConstructorParameters<typeof ActivityLogsService>[1],
      ),
      values,
      returning,
    };
  };

  it("records the original impersonating user's email for support-mode activity", async () => {
    const { service, values } = createService();

    await service.recordActivity({
      actor: {
        userId: "11111111-1111-1111-1111-111111111111",
        email: "impersonated@example.com",
        roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
        permissions: [PERMISSIONS.ACCOUNT_READ_SELF],
        tenantId: "22222222-2222-2222-2222-222222222222",
        isSupportMode: true,
        originalUserId: "33333333-3333-3333-3333-333333333333",
        originalUserEmail: "support-admin@example.com",
      },
      operation: ACTIVITY_LOG_ACTION_TYPES.LOGIN,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: "11111111-1111-1111-1111-111111111111",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "33333333-3333-3333-3333-333333333333",
        actorEmail: "support-admin@example.com",
      }),
    );
  });
});
