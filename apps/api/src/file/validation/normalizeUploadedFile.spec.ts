import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

import { normalizeUploadedFile } from "./normalizeUploadedFile";

const makeFile = (buffer: Buffer, originalname: string, mimetype = "image/png") =>
  ({
    buffer,
    originalname,
    mimetype,
    size: buffer.length,
  }) as Express.Multer.File;

describe("normalizeUploadedFile", () => {
  it.each(["gif", "tiff"])("accepts a genuine %s lesson image", async (format) => {
    const image = sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } });
    const buffer = await image.toFormat(format as "gif" | "tiff").toBuffer();
    const result = await normalizeUploadedFile(makeFile(buffer, `image.${format}`));
    expect(result.sourceMime).toBe(`image/${format}`);
    expect(result.buffer).toEqual(buffer);
  });
  it("rejects HTML disguised as an image and empty input", async () => {
    await expect(
      normalizeUploadedFile(makeFile(Buffer.from("<script>alert(1)</script>"), "photo.png")),
    ).rejects.toThrow("files.toast.invalidFileType");
    await expect(normalizeUploadedFile(makeFile(Buffer.alloc(0), "photo.png"))).rejects.toThrow();
  });

  it("rasterizes an uploaded SVG, strips path, and preserves source type on repeat", async () => {
    const file = makeFile(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script><rect width="100" height="100" fill="red"/></svg>',
      ),
      "..\\dir\\logo.svg",
      "image/svg+xml",
    );
    const result = await normalizeUploadedFile(file);
    expect(result.sourceMime).toBe("image/svg+xml");
    expect(file.mimetype).toBe("image/webp");
    expect(file.originalname).toBe("logo.webp");
    expect(file.buffer.subarray(0, 4).toString()).toBe("RIFF");
    expect(await normalizeUploadedFile(file)).toBe(result);
  });

  it("detects genuine PPTX independent of client-declared MIME", async () => {
    const bytes = readFileSync(
      resolve(
        __dirname,
        "../../../../web/e2e/data/curriculum/files/content-presentation-preview.pptx",
      ),
    );
    const upload = makeFile(bytes, "slides.pdf", "application/pdf");
    const normalized = await normalizeUploadedFile(upload);
    expect(normalized.sourceMime).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(upload.originalname).toBe("slides.pptx");
  });

  it("accepts BOM-marked UTF-16 and Windows-1250 CSV, rejects invalid controls", async () => {
    const utf16 = makeFile(
      Buffer.from([0xff, 0xfe, 0x41, 0, 0x2c, 0, 0x42, 0]),
      "table.csv",
      "text/csv",
    );
    expect((await normalizeUploadedFile(utf16)).buffer.toString()).toBe("A,B");
    const polish = makeFile(
      Buffer.from([0x5a, 0x61, 0xbf, 0xf3, 0xb3, 0xe6]),
      "table.csv",
      "text/csv",
    );
    expect((await normalizeUploadedFile(polish)).buffer.toString()).toBe("Zażółć");
    await expect(
      normalizeUploadedFile(makeFile(Buffer.from("a\u0001b"), "table.txt", "text/plain")),
    ).rejects.toThrow();
  });
});
