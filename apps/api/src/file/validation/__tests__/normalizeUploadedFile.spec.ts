import sharp from "sharp";

import { getDeclaredUpload, normalizeUploadedFile } from "../normalizeUploadedFile";

const toFile = (originalname: string, buffer: Buffer, mimetype = "application/octet-stream") =>
  ({ originalname, mimetype, buffer, size: buffer.length }) as Express.Multer.File;

const scriptedSvg = (size: number, prolog = "") =>
  Buffer.from(
    `${prolog}<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<script>alert(document.domain)</script><rect width="${size}" height="${size}" fill="red"/></svg>`,
  );

describe("normalizeUploadedFile", () => {
  let pngBytes: Buffer;

  beforeAll(async () => {
    pngBytes = await sharp({
      create: { width: 2, height: 2, channels: 4, background: "#ff0000" },
    })
      .png()
      .toBuffer();
  });

  it("stores binary uploads with the detected type instead of the declared one", async () => {
    const file = toFile("photo.png", pngBytes, "text/html");

    await expect(normalizeUploadedFile(file)).resolves.toMatchObject({
      source: "binary",
      sourceMime: "image/png",
      mime: "image/png",
    });
    expect(file).toMatchObject({ mimetype: "image/png", originalname: "photo.png" });
    expect(getDeclaredUpload(file)).toMatchObject({ mimetype: "text/html", size: pngBytes.length });
  });

  it("rasterizes scripted SVG to WebP and upscales small icons", async () => {
    const svg = scriptedSvg(24);
    const file = toFile("logo.svg", svg, "image/svg+xml");

    await expect(normalizeUploadedFile(file)).resolves.toMatchObject({
      source: "svg",
      sourceMime: "image/svg+xml",
      mime: "image/webp",
    });
    expect(file).toMatchObject({ mimetype: "image/webp", originalname: "logo.webp" });
    expect(file.buffer.includes("script")).toBe(false);
    expect(await sharp(file.buffer).metadata()).toMatchObject({
      format: "webp",
      width: 800,
      height: 800,
    });
    expect(getDeclaredUpload(file)).toEqual({
      originalname: "logo.svg",
      mimetype: "image/svg+xml",
      size: svg.length,
    });
  });

  it("rasterizes SVG detected as XML even when it is named like another type", async () => {
    const file = toFile("signature.png", scriptedSvg(2000, '<?xml version="1.0"?>'), "image/png");

    await expect(normalizeUploadedFile(file)).resolves.toMatchObject({
      sourceMime: "image/svg+xml",
      mime: "image/webp",
    });
  });

  it("rasterizes extensionless SVG without a prolog when it is declared as SVG", async () => {
    const file = toFile("asset-id", scriptedSvg(24), "image/svg+xml");

    await expect(normalizeUploadedFile(file)).resolves.toMatchObject({
      sourceMime: "image/svg+xml",
      mime: "image/webp",
    });
  });

  it("does not trust a declared SVG type for content that is not SVG", async () => {
    const file = toFile(
      "asset-id",
      Buffer.from("<html><script>alert(1)</script></html>"),
      "image/svg+xml",
    );

    await expect(normalizeUploadedFile(file)).rejects.toThrow();
  });

  it("keeps binary content named .svg as the detected binary type", async () => {
    const file = toFile("variant.svg", pngBytes, "image/svg+xml");

    await expect(normalizeUploadedFile(file)).resolves.toMatchObject({ mime: "image/png" });
  });

  it.each([
    ["page.svg", '<?xml version="1.0"?><html><script>alert(1)</script></html>'],
    ["page.svg", "<html><script>alert(1)</script></html>"],
    ["page.html", "<html><script>alert(1)</script></html>"],
    ["notes.txt", "line\u0000with NUL"],
    ["notes.txt", "   "],
  ])("rejects %s with unsafe or unrecognized content", async (name, content) => {
    await expect(normalizeUploadedFile(toFile(name, Buffer.from(content)))).rejects.toThrow();
  });

  it("rejects text that is not valid UTF-8", async () => {
    const file = toFile("users.csv", Buffer.from([0x61, 0x2c, 0xff, 0xfe, 0x0a, 0x62]));

    await expect(normalizeUploadedFile(file)).rejects.toThrow();
  });

  it("accepts CSV text by extension and re-encodes UTF-16 to UTF-8", async () => {
    const text = "email,name\nzażółć@example.com,Gęś\n";
    const file = toFile(
      "users.CSV",
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]),
      "application/vnd.ms-excel",
    );

    await expect(normalizeUploadedFile(file)).resolves.toMatchObject({
      source: "text",
      sourceMime: "text/csv",
      mime: "text/csv",
    });
    expect(file.buffer.toString("utf-8")).toBe(text);
    expect(file.mimetype).toBe("text/csv");
  });

  it("verifies each upload once when several validators inspect it", async () => {
    const file = toFile("logo.svg", scriptedSvg(24), "image/svg+xml");

    const first = await normalizeUploadedFile(file);
    const second = await normalizeUploadedFile(file);

    expect(second).toBe(first);
    expect(getDeclaredUpload(file).originalname).toBe("logo.svg");
  });
});
