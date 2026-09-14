import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";

import { EmailTemplateRepository } from "./email-template.repository";

import type { DatabasePg } from "src/common";

describe("EmailTemplateRepository.withLockedEmailTemplate", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const event = EMAIL_TEMPLATE_EVENTS.WELCOME;

  const createRepository = (initialRows: unknown[], lockedRows: unknown[]) => {
    const operations: string[] = [];
    const transaction = {
      select: jest
        .fn()
        .mockImplementationOnce(() => ({
          from: () => ({
            where: async () => {
              operations.push("read event");
              return initialRows;
            },
          }),
        }))
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => ({
              for: async (mode: string) => {
                operations.push(`lock row for ${mode}`);
                return lockedRows;
              },
            }),
          }),
        })),
      execute: jest.fn(async () => {
        operations.push("lock event");
      }),
    };
    const db = {
      transaction: async (callback: (value: typeof transaction) => unknown) =>
        callback(transaction),
    };
    return {
      repository: new EmailTemplateRepository(db as unknown as DatabasePg),
      operations,
      transaction,
    };
  };

  it("locks the event before reading the current row for the callback", async () => {
    const template = { id, event, name: { en: "Current name" } };
    const { repository, operations } = createRepository([{ event }], [template]);
    const result = await repository.withLockedEmailTemplate(id, async (lockedTemplate) => {
      operations.push("callback");
      expect(lockedTemplate).toBe(template);
      return "updated";
    });
    expect(result).toBe("updated");
    expect(operations).toEqual(["read event", "lock event", "lock row for update", "callback"]);
  });

  it("does not acquire locks or mutate when the initial template is missing", async () => {
    const { repository, transaction } = createRepository([], []);
    const callback = jest.fn();
    await expect(repository.withLockedEmailTemplate(id, callback)).rejects.toThrow(
      "emailTemplates.errors.notFound",
    );
    expect(transaction.execute).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not mutate if the template disappeared while waiting for the event lock", async () => {
    const { repository } = createRepository([{ event }], []);
    const callback = jest.fn();
    await expect(repository.withLockedEmailTemplate(id, callback)).rejects.toThrow(
      "emailTemplates.errors.notFound",
    );
    expect(callback).not.toHaveBeenCalled();
  });
});
