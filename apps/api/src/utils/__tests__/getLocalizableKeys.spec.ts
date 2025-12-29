import { courses } from "src/storage/schema";

import { hasLocalizableUpdates } from "../getLocalizableKeys";

describe("hasLocalizableUpdates", () => {
  it("returns true when title is provided as a string update", () => {
    const result = hasLocalizableUpdates(courses, { title: "New Course Title" });

    expect(result).toBe(true);
  });

  it("returns true when description is provided as a string update", () => {
    const result = hasLocalizableUpdates(courses, { description: "New Description" });

    expect(result).toBe(true);
  });

  it("returns false when update only touches non-localizable fields from controller payload", () => {
    const result = hasLocalizableUpdates(courses, { priceInCents: 1999, categoryId: "uuid" });

    expect(result).toBe(false);
  });

  it("returns false when localizable keys are present but undefined", () => {
    const result = hasLocalizableUpdates(courses, { title: undefined });

    expect(result).toBe(false);
  });

  it("returns true when localizable keys are explicitly set to null", () => {
    const result = hasLocalizableUpdates(courses, { description: null });

    expect(result).toBe(true);
  });

  it("ignores default excluded json columns like settings even when provided by the controller", () => {
    const result = hasLocalizableUpdates(courses, { settings: { lessonSequenceEnabled: false } });

    expect(result).toBe(false);
  });

  it("returns false when include option does not list the provided localizable key", () => {
    const result = hasLocalizableUpdates(
      courses,
      { title: "New Course Title" },
      { include: ["description"] },
    );

    expect(result).toBe(false);
  });

  it("returns true when include option matches the provided localizable key", () => {
    const result = hasLocalizableUpdates(
      courses,
      { description: "New Description" },
      { include: ["description"] },
    );

    expect(result).toBe(true);
  });

  it("returns false when exclude option removes the provided localizable key", () => {
    const result = hasLocalizableUpdates(
      courses,
      { title: "New Course Title" },
      { exclude: ["title"] },
    );

    expect(result).toBe(false);
  });

  it("returns true when at least one localizable key is updated alongside non-localizable fields", () => {
    const result = hasLocalizableUpdates(courses, {
      title: "Updated Title",
      priceInCents: 999,
    });

    expect(result).toBe(true);
  });

  it("returns false when no update data is provided", () => {
    const result = hasLocalizableUpdates(courses, {});

    expect(result).toBe(false);
  });
});
