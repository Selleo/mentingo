import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import AdmZip from "adm-zip";
import writeXlsxFile from "write-excel-file/node";

import { ALLOWED_FILE_TYPES, SEARCH_FILE_TYPES_MAP } from "../ingestion.config";

import { ChunkService } from "./chunk.service";
import { validateOfficeArchive } from "./search-file.loaders";

const SYMLINK_ZIP_ATTRIBUTES = 0o120777 * 0x10000;

function attachment(buffer: Buffer, mimetype: string): Express.Multer.File {
  return { buffer, mimetype } as Express.Multer.File;
}

function slideXml(paragraphs: string[]) {
  const body = paragraphs.map((text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`).join("");
  return `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${body}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
}

function presentation(slides: Array<[path: string, paragraphs: string[]]>) {
  const archive = new AdmZip();
  archive.addFile("[Content_Types].xml", Buffer.from("<Types/>"));
  for (const [path, paragraphs] of slides) archive.addFile(path, Buffer.from(slideXml(paragraphs)));
  return archive;
}

function addSymlink(archive: AdmZip, path: string, target: string) {
  archive.addFile(path, Buffer.from(target));
  const entry = archive.getEntry(path);
  if (!entry) throw new Error(`Missing archive entry ${path}`);
  entry.attr = SYMLINK_ZIP_ATTRIBUTES;
}

async function inTemporaryWorkingDirectory<Result>(run: (directory: string) => Promise<Result>) {
  const originalDirectory = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "pptx-extraction-"));
  process.chdir(directory);
  try {
    return await run(directory);
  } finally {
    process.chdir(originalDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
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

  it("returns one document with every slide in numeric order", async () => {
    const archive = presentation([
      ["ppt/slides/slide10.xml", ["Ten"]],
      ["ppt/slides/slide2.xml", ["Two first", "Two second"]],
      ["ppt/slides/slide1.xml", ["One"]],
    ]);
    const documents = await inTemporaryWorkingDirectory(() =>
      service.extractSearchText(attachment(archive.toBuffer(), SEARCH_FILE_TYPES_MAP.PPTX)),
    );
    expect(documents.map((document) => document.pageContent)).toEqual([
      "One\nTwo first\nTwo second\nTen",
    ]);
  });

  it("places speaker notes right after their own slide", async () => {
    const archive = presentation([
      ["ppt/notesSlides/notesSlide1.xml", ["Note one"]],
      ["ppt/slides/slide2.xml", ["Slide two"]],
      ["ppt/slides/slide1.xml", ["Slide one"]],
    ]);
    const documents = await inTemporaryWorkingDirectory(() =>
      service.extractSearchText(attachment(archive.toBuffer(), SEARCH_FILE_TYPES_MAP.PPTX)),
    );
    expect(documents.map((document) => document.pageContent)).toEqual([
      "Slide one\nNote one\nSlide two",
    ]);
  });

  it("matches officeparser 4.2.0's own PPTX fixture output apart from spacing", async () => {
    const fixture = readFileSync(join(__dirname, "fixtures/officeparser-test.pptx"));
    const expectedText = readFileSync(
      join(__dirname, "fixtures/officeparser-test.pptx.txt"),
      "utf8",
    );
    const documents = await inTemporaryWorkingDirectory(() =>
      service.extractSearchText(attachment(fixture, SEARCH_FILE_TYPES_MAP.PPTX)),
    );
    const collapseSpaces = (text: string) => text.replace(/ +/g, " ");
    expect(documents.map((document) => collapseSpaces(document.pageContent))).toEqual([
      collapseSpaces(expectedText),
    ]);
  });

  it("keeps words apart across line breaks inside a paragraph", async () => {
    const archive = new AdmZip();
    archive.addFile(
      "ppt/slides/slide1.xml",
      Buffer.from(
        `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>Line one</a:t></a:r><a:br/><a:r><a:t>Line two</a:t></a:r></a:p></p:sld>`,
      ),
    );
    const documents = await inTemporaryWorkingDirectory(() =>
      service.extractSearchText(attachment(archive.toBuffer(), SEARCH_FILE_TYPES_MAP.PPTX)),
    );
    expect(documents.map((document) => document.pageContent)).toEqual(["Line one Line two"]);
  });

  it("returns no documents for a PPTX without text", async () => {
    const archive = presentation([["ppt/slides/slide1.xml", []]]);
    const documents = await inTemporaryWorkingDirectory(() =>
      service.extractSearchText(attachment(archive.toBuffer(), SEARCH_FILE_TYPES_MAP.PPTX)),
    );
    expect(documents).toEqual([]);
  });

  it("leaves nothing behind in the working directory after PPTX extraction", async () => {
    const archive = presentation([["ppt/slides/slide1.xml", ["Clean up"]]]);
    const leftovers = await inTemporaryWorkingDirectory(async (directory) => {
      await service.extractSearchText(attachment(archive.toBuffer(), SEARCH_FILE_TYPES_MAP.PPTX));
      return readdirSync(directory);
    });
    expect(leftovers).toEqual([]);
  });

  describe("archive entries that point outside the extraction directory", () => {
    let outsideDirectory: string;

    beforeEach(() => {
      outsideDirectory = mkdtempSync(join(tmpdir(), "pptx-outside-"));
    });

    afterEach(() => {
      rmSync(outsideDirectory, { recursive: true, force: true });
    });

    async function extractIgnoringRejection(archive: AdmZip) {
      return inTemporaryWorkingDirectory(() =>
        service
          .extractSearchText(attachment(archive.toBuffer(), SEARCH_FILE_TYPES_MAP.PPTX))
          .catch(() => []),
      );
    }

    it("does not index server files that a slide symlink points to", async () => {
      const secretFile = join(outsideDirectory, "secret.xml");
      writeFileSync(secretFile, slideXml(["SERVER SECRET"]));
      const archive = presentation([["ppt/slides/slide1.xml", ["Visible text"]]]);
      addSymlink(archive, "ppt/slides/slide2.xml", secretFile);

      const documents = await extractIgnoringRejection(archive);

      expect(documents.map((document) => document.pageContent).join("\n")).not.toContain(
        "SERVER SECRET",
      );
    });

    it("does not write files through a slide-named directory symlink", async () => {
      const archive = presentation([["ppt/slides/slide1.xml", ["Visible text"]]]);
      addSymlink(archive, "ppt/slides/slide7.xml", outsideDirectory);
      archive.addFile(
        "ppt/slides/slide7.xml/ppt/slides/slide8.xml",
        Buffer.from(slideXml(["Escaped"])),
      );

      await extractIgnoringRejection(archive);

      expect(readdirSync(outsideDirectory, { recursive: true })).toEqual([]);
    });
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
