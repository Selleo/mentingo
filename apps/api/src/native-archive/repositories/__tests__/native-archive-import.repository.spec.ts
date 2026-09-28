import { NativeArchiveImportRepository } from "../native-archive-import.repository";

describe("NativeArchiveImportRepository", () => {
  const createRepository = () => {
    const values = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: "created-id" }]),
    });
    const db = { insert: jest.fn().mockReturnValue({ values }) };

    return { repository: new NativeArchiveImportRepository(db as never), values };
  };

  it("spreads course insert values and converts localized fields", () => {
    const { repository, values } = createRepository();

    repository.createCourse({
      id: "course-id",
      title: { en: "Course" },
      description: { en: "Description" },
      status: "draft",
      priceInCents: 0,
      currency: "usd",
      authorId: "actor-id",
      categoryId: "category-id",
      courseType: "default",
      settings: {},
      baseLanguage: "en",
      availableLocales: ["en"],
    } as never);

    const insertedValues = values.mock.calls[0][0];
    expect(insertedValues).toEqual(
      expect.objectContaining({ id: "course-id", authorId: "actor-id", categoryId: "category-id" }),
    );
    expect(insertedValues.title).not.toEqual({ en: "Course" });
    expect(insertedValues.description).not.toEqual({ en: "Description" });
  });

  it("spreads learning path insert values and converts localized fields", () => {
    const { repository, values } = createRepository();

    repository.createLearningPath({
      id: "path-id",
      title: { en: "Path" },
      description: { en: "Description" },
      thumbnailReference: null,
      status: "draft",
      includesCertificate: false,
      settings: {},
      sequenceEnabled: false,
      authorId: "actor-id",
      baseLanguage: "en",
      availableLocales: ["en"],
    } as never);

    const insertedValues = values.mock.calls[0][0];
    expect(insertedValues).toEqual(
      expect.objectContaining({ id: "path-id", authorId: "actor-id" }),
    );
    expect(insertedValues.title).not.toEqual({ en: "Path" });
    expect(insertedValues.description).not.toEqual({ en: "Description" });
  });

  it("spreads calendar event values and converts localized fields", async () => {
    const { repository, values } = createRepository();

    await repository.createCalendarEvent({
      uid: "generated-uid",
      title: { en: "Event" },
      startsAt: "2026-01-01T10:00:00.000Z",
      endsAt: "2026-01-01T11:00:00.000Z",
      allDay: false,
      timezone: "UTC",
      baseLanguage: "en",
      availableLocales: ["en"],
    } as never);

    const insertedValues = values.mock.calls[0][0];
    expect(insertedValues).toEqual(
      expect.objectContaining({
        uid: "generated-uid",
        startsAt: "2026-01-01T10:00:00.000Z",
      }),
    );
    expect(insertedValues.title).not.toEqual({ en: "Event" });
  });

  it("spreads resource insert values and converts localized fields", async () => {
    const { repository, values } = createRepository();

    await repository.createResource({
      title: { en: "Material" },
      description: { en: "Description" },
      reference: "tenant/import/material.pdf",
      contentType: "application/pdf",
      uploadedBy: "actor-id",
      visibility: "private",
    } as never);

    const insertedValues = values.mock.calls[0][0];
    expect(insertedValues).toEqual(
      expect.objectContaining({ uploadedBy: "actor-id", reference: "tenant/import/material.pdf" }),
    );
    expect(insertedValues.title).not.toEqual({ en: "Material" });
    expect(insertedValues.description).not.toEqual({ en: "Description" });
  });
});
