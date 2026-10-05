import { FileGuard } from "./file.guard";

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>');

describe("FileGuard validation", () => {
  it("validates by original SVG type and returns normalized WebP bytes", async () => {
    const file = {
      originalname: "image.svg",
      buffer: svg,
      size: svg.length,
      mimetype: "image/svg+xml",
    } as Express.Multer.File;
    await FileGuard.validateFile(file, {
      allowedTypes: ["image/svg+xml", "image/webp"],
      maxSize: 10000,
    });
    expect(file.mimetype).toBe("image/webp");
    expect(file.buffer.subarray(0, 4).toString()).toBe("RIFF");
  });
});
