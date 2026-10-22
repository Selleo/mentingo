import { Document } from "@langchain/core/documents";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { BufferLoader } from "langchain/document_loaders/fs/buffer";
import readXlsxFile, { readSheetNames } from "read-excel-file/node";

const MAX_EXPANDED_OFFICE_BYTES = 50 * 1024 * 1024;
const MAX_OFFICE_ENTRIES = 10_000;

/** Bound decompression before Office parsers expand uploaded ZIP containers. */
export function validateOfficeArchive(buffer: Buffer): void {
  const entries = new AdmZip(buffer).getEntries();
  const expandedBytes = entries.reduce((total, entry) => total + entry.header.size, 0);
  if (entries.length > MAX_OFFICE_ENTRIES || expandedBytes > MAX_EXPANDED_OFFICE_BYTES) {
    throw new Error("Search attachment exceeds the expanded archive limit");
  }
}

/** Preserve sheet names and row boundaries so spreadsheet text retains useful context. */
export class SpreadsheetLoader extends BufferLoader {
  async parse(raw: Buffer, metadata: Document["metadata"]): Promise<Document[]> {
    const documents: Document[] = [];
    for (const sheet of await readSheetNames(raw)) {
      const rows = await readXlsxFile(raw, { sheet });
      const content = rows
        .map((row) =>
          row
            .map((cell) => (cell instanceof Date ? cell.toISOString() : String(cell ?? "")))
            .join("\t"),
        )
        .join("\n");
      if (content.trim()) {
        documents.push(
          new Document({ pageContent: `${sheet}\n${content}`, metadata: { ...metadata, sheet } }),
        );
      }
    }
    return documents;
  }
}

/** Parse quoted CSV fields before exposing the records as searchable text. */
export class CsvSearchLoader extends BufferLoader {
  async parse(raw: Buffer, metadata: Document["metadata"]): Promise<Document[]> {
    const rows: string[][] = parse(raw, { bom: true, skip_empty_lines: true });
    const pageContent = rows.map((row) => row.join("\t")).join("\n");
    return pageContent.trim() ? [new Document({ pageContent, metadata })] : [];
  }
}
