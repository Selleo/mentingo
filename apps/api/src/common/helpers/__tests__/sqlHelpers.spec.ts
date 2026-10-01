import { PgDialect, pgTable, text } from "drizzle-orm/pg-core";

import { buildJsonbField, deleteJsonbField, setJsonbField } from "../sqlHelpers";

describe("sqlHelpers", () => {
  describe("setJsonbField", () => {
    it("returns undefined when key is null", () => {
      expect(setJsonbField({}, null, "value")).toBeUndefined();
    });

    it("returns undefined when key is undefined", () => {
      expect(setJsonbField({}, undefined, "value")).toBeUndefined();
    });

    it("returns undefined when value is null", () => {
      expect(setJsonbField({}, "key", null)).toBeUndefined();
    });

    it("returns undefined when value is undefined", () => {
      expect(setJsonbField({}, "key", undefined)).toBeUndefined();
    });

    it("returns undefined when both key and value are null", () => {
      expect(setJsonbField({}, null, null)).toBeUndefined();
    });

    it("returns SQL template when key and value are provided", () => {
      const result = setJsonbField({}, "key", "value");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("queryChunks");
    });

    it("returns SQL template with createMissing true by default", () => {
      const result = setJsonbField({}, "key", "value");

      expect(result).toBeDefined();
    });

    it("returns SQL template with createMissing false when specified", () => {
      const result = setJsonbField({}, "key", "value", false);

      expect(result).toBeDefined();
    });

    it("returns SQL template for boolean false values", () => {
      const result = setJsonbField({}, "key", false);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("queryChunks");
    });
  });

  describe("buildJsonbField", () => {
    it("supports column expressions without treating them as string parameters", () => {
      const options = pgTable("options", { language: text("language"), label: text("label") });
      const query = new PgDialect().sqlToQuery(buildJsonbField(options.language, options.label));
      expect(query.sql).toBe(
        'json_build_object("options"."language"::text, "options"."label"::text)',
      );
      expect(query.params).toEqual([]);
    });

    it("keeps literal content parameterized", () => {
      const content = "answer'); DROP TABLE options; --";
      const query = new PgDialect().sqlToQuery(buildJsonbField("en", content));
      expect(query.sql).toBe("json_build_object($1::text, $2::text)");
      expect(query.params).toEqual(["en", content]);
    });

    it("returns undefined when key is null", () => {
      expect(buildJsonbField(null, "value")).toBeUndefined();
    });

    it("returns undefined when key is undefined", () => {
      expect(buildJsonbField(undefined, "value")).toBeUndefined();
    });

    it("returns undefined when value is null", () => {
      expect(buildJsonbField("key", null)).toBeUndefined();
    });

    it("returns undefined when value is undefined", () => {
      expect(buildJsonbField("key", undefined)).toBeUndefined();
    });

    it("returns SQL template when key and value are provided", () => {
      const result = buildJsonbField("key", "value");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("queryChunks");
    });
  });

  describe("deleteJsonbField", () => {
    it("returns SQL template for deletion", () => {
      const mockColumn = { name: "test" } as any;
      const result = deleteJsonbField(mockColumn, "keyToDelete");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("queryChunks");
    });
  });
});
