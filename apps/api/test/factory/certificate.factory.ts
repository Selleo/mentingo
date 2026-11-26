import { faker } from "@faker-js/faker";
import { CERTIFICATE_STATUSES } from "@repo/shared";
import { Factory } from "fishery";

import { certificates } from "src/storage/schema";

import type { CertificateArchiveReason } from "@repo/shared";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type CertificateTest = Omit<InferInsertModel<typeof certificates>, "tenantId">;

class CertificateFactory extends Factory<
  CertificateTest,
  never,
  InferSelectModel<typeof certificates>
> {
  archived(archiveReason: CertificateArchiveReason, archivedAt = new Date().toISOString()) {
    return this.params({ status: CERTIFICATE_STATUSES.ARCHIVED, archivedAt, archiveReason });
  }
}

export const createCertificateFactory = (db: DatabasePg) =>
  CertificateFactory.define(({ onCreate }) => {
    onCreate(async (certificate) => {
      const [inserted] = await db.insert(certificates).values(certificate).returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      userId: "",
      courseId: "",
      status: CERTIFICATE_STATUSES.ACTIVE,
    };
  });
