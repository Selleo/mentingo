import { PayloadTooLargeException } from "@nestjs/common";
import sharp from "sharp";

import {
  MULTER_FILE_TOO_LARGE_MESSAGE,
  UploadTooLargeFilter,
} from "src/file/filters/upload-too-large.filter";
import { FileGuard } from "src/file/guards/file.guard";
import { MaxUploadSizeValidator } from "src/file/validators/max-upload-size.validator";

import type { ArgumentsHost, BadRequestException } from "@nestjs/common";

const responseOf = (error: unknown) => (error as BadRequestException).getResponse();

const imageFile = async (width: number, height: number) => {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();

  return { originalname: "image.png", mimetype: "image/png", buffer, size: buffer.length };
};

describe("translated upload errors", () => {
  it("reports an oversized upload with a formatted limit instead of raw bytes", () => {
    const validator = new MaxUploadSizeValidator({ maxSize: 20 * 1024 * 1024 });

    expect.assertions(1);
    try {
      validator.isValid({ size: 20 * 1024 * 1024 + 1 } as Express.Multer.File);
    } catch (error) {
      expect(responseOf(error)).toEqual({
        message: "files.toast.fileTooLarge",
        translationParams: { maxSize: "20 MB" },
      });
    }
  });

  it("reports an empty file as empty rather than too large", () => {
    expect(() => FileGuard.validateSize({ size: 0 } as Express.Multer.File, 1024)).toThrow(
      "files.toast.fileEmpty",
    );
  });

  it("reports image resolution and aspect ratio limits with their values", async () => {
    const file = (await imageFile(40, 20)) as Express.Multer.File;

    await expect(
      FileGuard.validateImageConstraints(file, { maxResolution: { width: 30, height: 30 } }),
    ).rejects.toMatchObject({
      response: {
        message: "files.toast.imageResolutionTooLarge",
        translationParams: { width: 30, height: 30 },
      },
    });
    await expect(
      FileGuard.validateImageConstraints(file, { aspectRatio: 1 }),
    ).rejects.toMatchObject({
      response: {
        message: "files.toast.imageAspectRatioMismatch",
        translationParams: { aspectRatio: "1:1" },
      },
    });
  });
});

describe("UploadTooLargeFilter", () => {
  const catchWith = (exception: PayloadTooLargeException) => {
    const filter = new UploadTooLargeFilter();
    const handled = jest
      .spyOn(Object.getPrototypeOf(UploadTooLargeFilter.prototype), "catch")
      .mockImplementation(() => undefined);

    filter.catch(exception, {} as ArgumentsHost);

    const [forwarded] = handled.mock.calls[0] as [PayloadTooLargeException];
    handled.mockRestore();
    return forwarded.message;
  };

  it("replaces Multer's untranslated size-limit message with a translation key", () => {
    expect(catchWith(new PayloadTooLargeException(MULTER_FILE_TOO_LARGE_MESSAGE))).toBe(
      "files.toast.uploadTooLarge",
    );
  });

  it("keeps 413 responses that already carry their own message", () => {
    expect(catchWith(new PayloadTooLargeException("competencies.invalidRequest"))).toBe(
      "competencies.invalidRequest",
    );
  });
});
