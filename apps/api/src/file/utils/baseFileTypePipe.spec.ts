import { getBaseFileTypePipe } from "./baseFileTypePipe";
import { buildFileTypeRegex } from "./fileTypeRegex";

const file = (buffer: Buffer, name: string, mimetype: string) =>
  ({ buffer, originalname: name, mimetype, size: buffer.length }) as Express.Multer.File;

describe("upload validation boundary", () => {
  it("accepts SVG by source type but passes only raster bytes to storage", async () => {
    const pipe = getBaseFileTypePipe(buildFileTypeRegex(["image/svg+xml", "image/webp"])).build();
    const uploaded = file(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
      "test.svg",
      "image/svg+xml",
    );
    expect(await pipe.transform(uploaded)).toBe(uploaded);
    expect(uploaded.mimetype).toBe("image/webp");
  });

  it("rejects disguised HTML and checks inclusive size before and after normalization", async () => {
    const pipe = getBaseFileTypePipe(/image\//, 100).build();
    await expect(
      pipe.transform(file(Buffer.from("<script>x</script>"), "fake.png", "image/png")),
    ).rejects.toThrow();
    await expect(
      pipe.transform(file(Buffer.alloc(101), "large.png", "image/png")),
    ).rejects.toThrow();
    const atLimit = getBaseFileTypePipe("text/plain", 5).build();
    expect(
      await atLimit.transform(file(Buffer.from("hello"), "ok.txt", "text/plain")),
    ).toBeDefined();
  });
});
