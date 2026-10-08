import { randomBytes, randomUUID } from "node:crypto";

import { NOTIFICATION_ACCOUNT_ACTION_KINDS } from "../automation-execution.constants";

import { NotificationAccountActionService } from "./notification-account-action.service";

import type { NotificationAccountActionIntentRecord } from "../automation-execution.types";
import type { NotificationAccountActionRepository } from "../repositories/notification-account-action.repository";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("NotificationAccountActionService", () => {
  const originalMasterKey = process.env.MASTER_KEY;
  const recipientEmail = "current@example.test";
  const userId = randomUUID();
  const transaction = {} as never;
  const listNotificationAccountActionIntentsForUpdate = jest.fn();
  const listCurrentUserEmail = jest.fn();
  const listUserPasswordCredentials = jest.fn();
  const insertAccountActionVerification = jest.fn();
  const updatePreparedNotificationAccountActionIntent = jest.fn();
  let service: NotificationAccountActionService;

  const intent = (createdAt: string): NotificationAccountActionIntentRecord =>
    ({
      id: randomUUID(),
      userId,
      recipientEmail,
      kind: NOTIFICATION_ACCOUNT_ACTION_KINDS.SIGN_IN,
      applicationOrigin: "https://tenant1.lms.localhost",
      tokenTtlMs: 15 * 60 * 1000,
      usesCalendarYearExpiry: false,
      createdAt,
      tokenCreatedAt: null,
    }) as NotificationAccountActionIntentRecord;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MASTER_KEY = randomBytes(32).toString("base64");
    listCurrentUserEmail.mockResolvedValue([{ email: recipientEmail }]);
    listUserPasswordCredentials.mockResolvedValue([]);
    insertAccountActionVerification.mockResolvedValue([{ id: randomUUID() }]);
    service = new NotificationAccountActionService(
      {
        listNotificationAccountActionIntentsForUpdate,
        listCurrentUserEmail,
        listUserPasswordCredentials,
        insertAccountActionVerification,
        updatePreparedNotificationAccountActionIntent,
      } as unknown as NotificationAccountActionRepository,
      { transactionWithHandle: async (callback) => callback(transaction) } as TenantDbRunnerService,
    );
  });

  afterAll(() => {
    if (originalMasterKey === undefined) {
      delete process.env.MASTER_KEY;
    } else {
      process.env.MASTER_KEY = originalMasterKey;
    }
  });

  it("rejects a magic-link request after its original lifetime", async () => {
    const record = intent(new Date(Date.now() - 16 * 60 * 1000).toISOString());
    listNotificationAccountActionIntentsForUpdate.mockResolvedValue([record]);

    await expect(
      service.prepareNotificationAccountActionFields(record.id, recipientEmail),
    ).resolves.toBeNull();

    expect(insertAccountActionVerification).not.toHaveBeenCalled();
    expect(updatePreparedNotificationAccountActionIntent).not.toHaveBeenCalled();
  });

  it("rejects a delivery when the account email changed after the request", async () => {
    const record = intent(new Date().toISOString());
    listNotificationAccountActionIntentsForUpdate.mockResolvedValue([record]);
    listCurrentUserEmail.mockResolvedValue([{ email: "new@example.test" }]);

    await expect(
      service.prepareNotificationAccountActionFields(record.id, recipientEmail),
    ).resolves.toBeNull();

    expect(insertAccountActionVerification).not.toHaveBeenCalled();
    expect(updatePreparedNotificationAccountActionIntent).not.toHaveBeenCalled();
  });

  it("rejects a delivery sent to a different address than the request", async () => {
    const record = intent(new Date().toISOString());
    listNotificationAccountActionIntentsForUpdate.mockResolvedValue([record]);

    await expect(
      service.prepareNotificationAccountActionFields(record.id, "other@example.test"),
    ).resolves.toBeNull();

    expect(insertAccountActionVerification).not.toHaveBeenCalled();
  });

  it("issues a token only for the current recipient and expires it from request time", async () => {
    const createdAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const record = intent(createdAt);
    listNotificationAccountActionIntentsForUpdate.mockResolvedValue([record]);

    const fields = await service.prepareNotificationAccountActionFields(record.id, recipientEmail);

    expect(fields?.magic_link).toContain("/auth/login?token=");
    expect(listCurrentUserEmail).toHaveBeenCalledWith(userId, transaction);
    expect(insertAccountActionVerification.mock.calls[0][1].expiryDate).toEqual(
      new Date(new Date(createdAt).getTime() + record.tokenTtlMs),
    );
    expect(updatePreparedNotificationAccountActionIntent).toHaveBeenCalledTimes(1);
  });

  it("keeps calendar-year setup links anchored to the request date", async () => {
    const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const record = {
      ...intent(createdAt),
      kind: "create_password",
      usesCalendarYearExpiry: true,
    } as NotificationAccountActionIntentRecord;
    listNotificationAccountActionIntentsForUpdate.mockResolvedValue([record]);

    const fields = await service.prepareNotificationAccountActionFields(record.id, recipientEmail);

    const expectedExpiry = new Date(createdAt);
    expectedExpiry.setFullYear(expectedExpiry.getFullYear() + 1);
    expect(fields?.create_password_link).toBeDefined();
    expect(insertAccountActionVerification.mock.calls[0][1].expiryDate).toEqual(expectedExpiry);
  });
});
