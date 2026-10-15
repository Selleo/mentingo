import { LocalizationService } from "src/localization/localization.service";

import { EmailTemplateRepository } from "./email-template.repository";

import type { DatabasePg } from "src/common";

describe("EmailTemplateRepository.withLockedEmailTemplate", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const createRepository = (rows: unknown[]) => {
    const operations: string[] = [];
    const transaction = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: async () => {
              operations.push("lock template");
              return rows;
            },
          }),
        }),
      }),
      execute: async () => {
        operations.push("lock lifecycle");
      },
    };
    const db = {
      transaction: async (callback: (value: typeof transaction) => unknown) =>
        callback(transaction),
    };
    return {
      repository: new EmailTemplateRepository(
        db as unknown as DatabasePg,
        new LocalizationService(db as unknown as DatabasePg),
      ),
      operations,
      transaction,
    };
  };

  it("takes the shared lifecycle lock before the template lock and exposes the transaction", async () => {
    const template = { id, name: { en: "Current" } };
    const { repository, operations, transaction } = createRepository([template]);
    const result = await repository.withLockedEmailTemplate(id, async (row, tx) => {
      expect(row).toBe(template);
      expect(tx).toBe(transaction);
      operations.push("write");
      return "updated";
    });
    expect(result).toBe("updated");
    expect(operations).toEqual(["lock lifecycle", "lock template", "write"]);
  });
  it("does not invoke a mutation when the template disappeared", async () => {
    const { repository } = createRepository([]);
    const callback = jest.fn();
    await expect(repository.withLockedEmailTemplate(id, callback)).rejects.toThrow(
      "emailTemplates.errors.notFound",
    );
    expect(callback).not.toHaveBeenCalled();
  });
});
