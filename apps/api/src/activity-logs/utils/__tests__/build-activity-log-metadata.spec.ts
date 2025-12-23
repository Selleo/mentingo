import { buildActivityLogMetadata } from "../build-activity-log-metadata";

describe("buildActivityLogMetadata", () => {
  describe("update schema (default)", () => {
    it("detects changed string field", () => {
      const result = buildActivityLogMetadata({
        previous: { name: "old" },
        updated: { name: "new" },
      });

      expect(result.changedFields).toEqual(["name"]);
      expect(result.before).toEqual({ name: "old" });
      expect(result.after).toEqual({ name: "new" });
    });

    it("ignores unchanged fields", () => {
      const result = buildActivityLogMetadata({
        previous: { name: "same", age: 25 },
        updated: { name: "same", age: 25 },
      });

      expect(result.changedFields).toEqual([]);
      expect(result.before).toEqual({});
      expect(result.after).toEqual({});
    });

    it("handles multiple changed fields", () => {
      const result = buildActivityLogMetadata({
        previous: { name: "old", email: "old@test.com" },
        updated: { name: "new", email: "new@test.com" },
      });

      expect(result.changedFields).toContain("name");
      expect(result.changedFields).toContain("email");
      expect(result.changedFields).toHaveLength(2);
    });

    it("excludes updatedAt from comparison", () => {
      const result = buildActivityLogMetadata({
        previous: { name: "same", updatedAt: new Date("2024-01-01") },
        updated: { name: "same", updatedAt: new Date("2024-01-02") },
      });

      expect(result.changedFields).toEqual([]);
    });

    it("excludes createdAt from comparison", () => {
      const result = buildActivityLogMetadata({
        previous: { name: "same", createdAt: new Date("2024-01-01") },
        updated: { name: "same", createdAt: new Date("2024-01-02") },
      });

      expect(result.changedFields).toEqual([]);
    });

    it("includes context when provided", () => {
      const result = buildActivityLogMetadata({
        previous: { name: "old" },
        updated: { name: "new" },
        context: { userId: "123" },
      });

      expect(result.context).toEqual({ userId: "123" });
    });

    it("handles null context", () => {
      const result = buildActivityLogMetadata({
        previous: { name: "old" },
        updated: { name: "new" },
        context: null,
      });

      expect(result.context).toBeNull();
    });

    it("handles null previous record", () => {
      const result = buildActivityLogMetadata({
        previous: null,
        updated: { name: "new" },
      });

      expect(result.changedFields).toEqual([]);
    });

    it("handles undefined previous record", () => {
      const result = buildActivityLogMetadata({
        previous: undefined,
        updated: { name: "new" },
      });

      expect(result.changedFields).toEqual([]);
    });

    it("compares Date objects by value", () => {
      const date1 = new Date("2024-01-01T12:00:00Z");
      const date2 = new Date("2024-01-01T12:00:00Z");

      const result = buildActivityLogMetadata({
        previous: { date: date1 },
        updated: { date: date2 },
      });

      expect(result.changedFields).toEqual([]);
    });

    it("detects changed Date objects", () => {
      const result = buildActivityLogMetadata({
        previous: { date: new Date("2024-01-01") },
        updated: { date: new Date("2024-01-02") },
      });

      expect(result.changedFields).toEqual(["date"]);
    });

    it("compares arrays by JSON value", () => {
      const result = buildActivityLogMetadata({
        previous: { tags: ["a", "b"] },
        updated: { tags: ["a", "b"] },
      });

      expect(result.changedFields).toEqual([]);
    });

    it("detects changed arrays", () => {
      const result = buildActivityLogMetadata({
        previous: { tags: ["a", "b"] },
        updated: { tags: ["a", "c"] },
      });

      expect(result.changedFields).toEqual(["tags"]);
    });

    it("compares nested objects by JSON value", () => {
      const result = buildActivityLogMetadata({
        previous: { config: { a: 1, b: 2 } },
        updated: { config: { a: 1, b: 2 } },
      });

      expect(result.changedFields).toEqual([]);
    });

    it("detects changed nested objects", () => {
      const result = buildActivityLogMetadata({
        previous: { config: { a: 1 } },
        updated: { config: { a: 2 } },
      });

      expect(result.changedFields).toEqual(["config"]);
    });

    it("stringifies Date to ISO format", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");

      const result = buildActivityLogMetadata({
        previous: { date: new Date("2024-01-01") },
        updated: { date },
      });

      expect(result.after?.date).toBe("2024-01-15T10:30:00.000Z");
    });

    it("stringifies objects to JSON", () => {
      const result = buildActivityLogMetadata({
        previous: { config: { a: 1 } },
        updated: { config: { b: 2 } },
      });

      expect(result.after?.config).toBe('{"b":2}');
    });

    it("stringifies null/undefined to empty string", () => {
      const result = buildActivityLogMetadata({
        previous: { value: "old" },
        updated: { value: null as any },
      });

      expect(result.after?.value).toBe("");
    });
  });

  describe("create schema", () => {
    it("returns only after snapshot for create", () => {
      const result = buildActivityLogMetadata({
        previous: null,
        updated: { name: "new", email: "test@test.com" },
        schema: "create",
      });

      expect(result.after).toBeDefined();
      expect(result.after?.name).toBe("new");
      expect(result.after?.email).toBe("test@test.com");
      expect((result as any).changedFields).toBeUndefined();
      expect((result as any).before).toBeUndefined();
    });

    it("excludes updatedAt from create snapshot", () => {
      const result = buildActivityLogMetadata({
        previous: null,
        updated: { name: "new", updatedAt: new Date() },
        schema: "create",
      });

      expect(result.after?.name).toBe("new");
      expect(result.after?.updatedAt).toBeUndefined();
    });

    it("excludes createdAt from create snapshot", () => {
      const result = buildActivityLogMetadata({
        previous: null,
        updated: { name: "new", createdAt: new Date() },
        schema: "create",
      });

      expect(result.after?.createdAt).toBeUndefined();
    });

    it("includes context in create schema", () => {
      const result = buildActivityLogMetadata({
        previous: null,
        updated: { name: "new" },
        schema: "create",
        context: { createdBy: "admin" },
      });

      expect(result.context).toEqual({ createdBy: "admin" });
    });
  });
});
