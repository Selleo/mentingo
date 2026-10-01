import { COURSE_STATUSES, LEARNING_PATH_STATUSES } from "@repo/shared";

import {
  buildNativeArchiveCourseInsert,
  buildNativeArchiveLearningPathInsert,
} from "../native-archive-import-inserts";

describe("native archive insert projections", () => {
  it("keeps course inserts to approved fields and forces actor-controlled values", () => {
    const source = {
      id: "course-id",
      title: { en: "Course" },
      description: { en: "Description" },
      courseType: "default",
      settings: {
        lessonSequenceEnabled: false,
        quizFeedbackEnabled: true,
        certificateSignature: null,
        certificateFontColor: null,
        certificateValidity: null,
      },
      baseLanguage: "en",
      availableLocales: ["en"],
      status: "published",
      authorId: "attacker-author",
      categoryId: "attacker-category",
      tenantId: "attacker-tenant",
      sourceCourseId: "attacker-source",
      thumbnailS3Key: "attacker-thumbnail",
    } as never;

    const insert = buildNativeArchiveCourseInsert(source, "actor-id", "category-id", "target-id");

    expect(insert).toMatchObject({
      id: "target-id",
      originalId: "course-id",
      status: COURSE_STATUSES.DRAFT,
      authorId: "actor-id",
      categoryId: "category-id",
      priceInCents: 0,
    });
    expect(insert).not.toHaveProperty("tenantId");
    expect(insert).not.toHaveProperty("sourceCourseId");
    expect(insert).not.toHaveProperty("thumbnailS3Key");
  });

  it("keeps learning path inserts to approved fields and forces actor-controlled values", () => {
    const source = {
      id: "path-id",
      originalId: "first-path-id",
      title: { en: "Path" },
      description: { en: "Description" },
      thumbnailReference: "source-thumbnail",
      includesCertificate: false,
      settings: { certificateSignature: null, certificateFontColor: null },
      sequenceEnabled: true,
      baseLanguage: "en",
      availableLocales: ["en"],
      courseLinks: [{ courseId: "attacker-course", displayOrder: 0 }],
      tenantId: "attacker-tenant",
      sourceTenantId: "attacker-source-tenant",
      authorId: "attacker-author",
      status: "published",
    } as never;

    const insert = buildNativeArchiveLearningPathInsert(
      source,
      "actor-id",
      "rewritten-thumbnail",
      { certificateSignature: null, certificateFontColor: null },
      "target-id",
    );

    expect(insert).toMatchObject({
      id: "target-id",
      originalId: "first-path-id",
      status: LEARNING_PATH_STATUSES.DRAFT,
      authorId: "actor-id",
      thumbnailReference: "rewritten-thumbnail",
    });
    expect(insert).not.toHaveProperty("tenantId");
    expect(insert).not.toHaveProperty("sourceTenantId");
    expect(insert).not.toHaveProperty("courseLinks");
  });
});
