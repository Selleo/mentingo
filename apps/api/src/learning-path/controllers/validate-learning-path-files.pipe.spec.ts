import { ValidateLearningPathFilesPipe } from "./validate-learning-path-files.pipe";

const file = (buffer: Buffer, originalname: string, mimetype: string) =>
  ({ buffer, size: buffer.length, originalname, mimetype }) as Express.Multer.File;

describe("learning-path multipart files", () => {
  it("normalizes each field before persistence", async () => {
    const files = {
      thumbnail: [
        file(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'),
          "picture.svg",
          "image/svg+xml",
        ),
      ],
      certificateSignature: [
        file(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'),
          "sign.svg",
          "image/svg+xml",
        ),
      ],
    };
    await new ValidateLearningPathFilesPipe().transform(files);
    expect(files.thumbnail[0].mimetype).toBe("image/webp");
    expect(files.certificateSignature[0].mimetype).toBe("image/webp");
  });
});
