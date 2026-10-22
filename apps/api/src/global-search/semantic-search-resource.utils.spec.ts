import {
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_EXCEL_FILE_TYPES,
} from "@repo/shared";
import { PgDialect } from "drizzle-orm/pg-core";

import { SEARCH_FILE_TYPES_MAP } from "src/ingestion/ingestion.config";

import { semanticSearchResourceSources } from "./semantic-search-resource.utils";

describe("attachment source discovery", () => {
  it("restricts extraction to uploadable document formats", () => {
    const uploadableTypes = new Set([
      ...ALLOWED_PDF_FILE_TYPES,
      ...ALLOWED_WORD_FILE_TYPES,
      ...ALLOWED_PRESENTATION_FILE_TYPES,
      ...ALLOWED_EXCEL_FILE_TYPES,
    ]);
    for (const mime of Object.values(SEARCH_FILE_TYPES_MAP)) {
      expect(uploadableTypes.has(mime)).toBe(true);
    }
    const query = new PgDialect().sqlToQuery(semanticSearchResourceSources("tenant-id"));
    for (const mime of ["text/html", "text/markdown", "text/x-markdown", "text/plain"]) {
      expect(query.params).not.toContain(mime);
    }
  });

  it("discovers new file formats during existing reconciliation with tenant and visibility scope", () => {
    const query = new PgDialect().sqlToQuery(semanticSearchResourceSources("tenant-id"));
    for (const mime of Object.values(SEARCH_FILE_TYPES_MAP)) {
      expect(query.params).toContain(mime);
    }
    expect(query.params).toContain("tenant-id");
    expect(query.sql).toContain("r.tenant_id = e.tenant_id");
    expect(query.sql).toContain("r.archived = false");
    expect(query.sql).toContain("r.visibility <>");
  });
});
