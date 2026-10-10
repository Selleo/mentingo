import { courseAuthoringExportHash } from "./course-authoring-export-hash";

describe("course authoring frozen export hash", () => {
  const payload = {
    schemaVersion: 1,
    description: "Zażółć gęślą jaźń 🧠",
    operations: [
      { type: "lesson.create", displayOrder: 0, payload: { maximumPoints: "1.00", enabled: true } },
    ],
    assets: [],
  };
  it("matches producer Python compact sorted UTF8 JSON without injecting omitted fields", () => {
    expect(courseAuthoringExportHash(payload)).toBe(
      "1c4c36f10192d517cdebcf3c79c8dcdf849361a7ccb61bd35ebfc35f9694e526",
    );
    expect(courseAuthoringExportHash({ ...payload, exportHash: "ignored" })).toBe(
      courseAuthoringExportHash(payload),
    );
  });
  it("detects changed content but ignores object key insertion order", () => {
    expect(courseAuthoringExportHash(Object.fromEntries(Object.entries(payload).reverse()))).toBe(
      courseAuthoringExportHash(payload),
    );
    expect(courseAuthoringExportHash({ ...payload, description: "Changed" })).not.toBe(
      courseAuthoringExportHash(payload),
    );
  });
});
