import { isEmptyObject, normalizeCellValue, normalizeHeader } from "../excel.utils";

describe("excel.utils", () => {
  describe("normalizeHeader", () => {
    it("returns empty string for null", () => {
      expect(normalizeHeader(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(normalizeHeader(undefined)).toBe("");
    });

    it("trims whitespace", () => {
      expect(normalizeHeader("  header  ")).toBe("header");
    });

    it("removes carriage return characters", () => {
      expect(normalizeHeader("header\r\nname")).toBe("header\nname");
    });

    it("handles multiple carriage returns", () => {
      expect(normalizeHeader("a\rb\rc")).toBe("abc");
    });

    it("converts number to string", () => {
      expect(normalizeHeader(123)).toBe("123");
    });

    it("converts boolean to string", () => {
      expect(normalizeHeader(true)).toBe("true");
    });
  });

  describe("normalizeCellValue", () => {
    it("returns undefined for null", () => {
      expect(normalizeCellValue("any", null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(normalizeCellValue("any", undefined)).toBeUndefined();
    });

    describe("groups header", () => {
      it("splits comma-separated values into array", () => {
        expect(normalizeCellValue("groups", "a,b,c")).toEqual(["a", "b", "c"]);
      });

      it("trims whitespace from each group", () => {
        expect(normalizeCellValue("groups", "  a  ,  b  ,  c  ")).toEqual(["a", "b", "c"]);
      });

      it("filters out empty groups", () => {
        expect(normalizeCellValue("groups", "a,,b,  ,c")).toEqual(["a", "b", "c"]);
      });

      it("returns empty array for only empty values", () => {
        expect(normalizeCellValue("groups", ",,  ,")).toEqual([]);
      });
    });

    describe("hyperlink objects", () => {
      it("extracts hyperlink property", () => {
        expect(normalizeCellValue("email", { hyperlink: "https://example.com" })).toBe(
          "https://example.com",
        );
      });

      it("extracts url property", () => {
        expect(normalizeCellValue("email", { url: "https://example.com" })).toBe(
          "https://example.com",
        );
      });

      it("extracts link property", () => {
        expect(normalizeCellValue("email", { link: "https://example.com" })).toBe(
          "https://example.com",
        );
      });

      it("strips mailto: prefix", () => {
        expect(normalizeCellValue("email", { hyperlink: "mailto:test@example.com" })).toBe(
          "test@example.com",
        );
      });

      it("trims whitespace from href", () => {
        expect(normalizeCellValue("email", { hyperlink: "  https://example.com  " })).toBe(
          "https://example.com",
        );
      });

      it("prefers hyperlink over url over link", () => {
        expect(
          normalizeCellValue("email", {
            hyperlink: "primary",
            url: "secondary",
            link: "tertiary",
          }),
        ).toBe("primary");
      });
    });

    describe("string values", () => {
      it("returns trimmed string", () => {
        expect(normalizeCellValue("name", "  John  ")).toBe("John");
      });

      it("returns undefined for empty string", () => {
        expect(normalizeCellValue("name", "")).toBeUndefined();
      });

      it("returns undefined for whitespace-only string", () => {
        expect(normalizeCellValue("name", "   ")).toBeUndefined();
      });

      it("converts number to string", () => {
        expect(normalizeCellValue("age", 25)).toBe("25");
      });
    });
  });

  describe("isEmptyObject", () => {
    it("returns true for empty object", () => {
      expect(isEmptyObject({})).toBe(true);
    });

    it("returns false for object with properties", () => {
      expect(isEmptyObject({ a: 1 })).toBe(false);
    });

    it("returns false for object with multiple properties", () => {
      expect(isEmptyObject({ a: 1, b: 2, c: 3 })).toBe(false);
    });

    it("returns false for object with undefined value", () => {
      expect(isEmptyObject({ a: undefined })).toBe(false);
    });

    it("returns false for object with null value", () => {
      expect(isEmptyObject({ a: null })).toBe(false);
    });
  });
});
