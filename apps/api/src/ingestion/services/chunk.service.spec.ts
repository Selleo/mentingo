import AdmZip from "adm-zip";
import writeXlsxFile from "write-excel-file/node";

import { ALLOWED_FILE_TYPES, SEARCH_FILE_TYPES_MAP } from "../ingestion.config";

import { ChunkService } from "./chunk.service";
import { validateOfficeArchive } from "./search-file.loaders";

function attachment(buffer: Buffer, mimetype: string): Express.Multer.File {
  return { buffer, mimetype } as Express.Multer.File;
}

const service = new ChunkService();

describe("search attachment extraction with real parsers", () => {
  it("extracts text from a real PPTX ZIP without indexing XML markup", async () => {
    const archive = new AdmZip();
    archive.addFile(
      "[Content_Types].xml",
      Buffer.from(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>',
      ),
    );
    archive.addFile(
      "ppt/slides/slide1.xml",
      Buffer.from(
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Safety induction for crane operators</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
      ),
    );
    const documents = await service.extractSearchText(
      attachment(archive.toBuffer(), SEARCH_FILE_TYPES_MAP.PPTX),
    );
    expect(documents.map((document) => document.pageContent).join("\n")).toContain(
      "Safety induction for crane operators",
    );
    expect(documents[0].pageContent).not.toContain("<a:t>");
  });

  it("indexes every spreadsheet sheet with row and sheet context", async () => {
    const workbook = await writeXlsxFile(
      [
        [
          [{ value: "Equipment" }, { value: "Quantity" }],
          [{ value: "Crane" }, { value: 2 }],
        ],
        [[{ value: "Emergency contacts" }], [{ value: "Site manager" }]],
      ],
      { sheets: ["Inventory", "Contacts"], buffer: true },
    );
    const documents = await service.extractSearchText(
      attachment(workbook, SEARCH_FILE_TYPES_MAP.XLSX),
    );
    expect(documents.map((document) => document.pageContent)).toEqual([
      "Inventory\nEquipment\tQuantity\nCrane\t2",
      "Contacts\nEmergency contacts\nSite manager",
    ]);
  });

  it("parses quoted CSV records and UTF-8 text", async () => {
    const documents = await service.extractSearchText(
      attachment(
        Buffer.from('\uFEFFname,description\nŻuraw,"safe, inspected"\n'),
        SEARCH_FILE_TYPES_MAP.CSV,
      ),
    );
    expect(documents[0].pageContent).toBe("name\tdescription\nŻuraw\tsafe, inspected");
  });

  it.each(["text/html", "text/markdown", "text/x-markdown", "text/plain"])(
    "rejects %s because resource-library attachments cannot upload it",
    async (mimetype) => {
      await expect(
        service.extractSearchText(attachment(Buffer.from("Content"), mimetype)),
      ).rejects.toThrow("not supported for search extraction");
    },
  );

  it("preserves plain-text extraction for the separate ingestion flow", async () => {
    const documents = await service.extractText(attachment(Buffer.from("Content"), "text/plain"));
    expect(documents[0].pageContent).toBe("Content");
  });

  it("keeps ingestion upload types unchanged", async () => {
    expect(ALLOWED_FILE_TYPES).not.toContain(SEARCH_FILE_TYPES_MAP.PPTX);
    await expect(
      service.extractText(attachment(Buffer.from("invalid"), SEARCH_FILE_TYPES_MAP.PPTX)),
    ).rejects.toThrow("not allowed");
  });

  it("rejects oversized files before parsing", async () => {
    await expect(
      service.extractSearchText(
        attachment(Buffer.alloc(10 * 1024 * 1024 + 1), SEARCH_FILE_TYPES_MAP.CSV),
      ),
    ).rejects.toThrow("size limit");
  });

  it("rejects malformed archives and expansion bombs", async () => {
    await expect(
      service.extractSearchText(attachment(Buffer.from("not a zip"), SEARCH_FILE_TYPES_MAP.PPTX)),
    ).rejects.toThrow();
    const archive = new AdmZip();
    archive.addFile("oversized.xml", Buffer.alloc(50 * 1024 * 1024 + 1));
    expect(() => validateOfficeArchive(archive.toBuffer())).toThrow("expanded archive limit");
  });
});
