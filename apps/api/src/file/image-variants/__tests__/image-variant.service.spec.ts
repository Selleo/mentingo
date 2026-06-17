import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import sharp from "sharp";

import { S3Service } from "src/s3/s3.service";

import {
  IMAGE_QUALITY,
  IMAGE_VARIANT_DEFINITIONS,
  IMAGE_VARIANT_CONTENT_TYPE,
} from "../image-variant.constants";
import { ImageVariantService } from "../image-variant.service";

type S3ServiceMock = {
  uploadFile: jest.MockedFunction<S3Service["uploadFile"]>;
};

describe("ImageVariantService", () => {
  let service: ImageVariantService;
  let s3Service: S3ServiceMock;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImageVariantService,
        {
          provide: S3Service,
          useValue: {
            uploadFile: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ImageVariantService);
    s3Service = moduleRef.get(S3Service);
  });

  it("creates the logical reference key and all fixed WebP variants", async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 100,
        height: 50,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();

    const tenantId = "00000000-0000-0000-0000-000000000001";
    const result = await service.createVariants({
      buffer: sourceBuffer,
      resource: "course",
      mimeType: "image/png",
      tenantId,
    });

    expect(result).not.toBeNull();
    expect(result?.referenceKey).toMatch(
      /^00000000-0000-0000-0000-000000000001\/course\/variants\/.+\.webp$/,
    );
    expect(result?.contentType).toBe(IMAGE_VARIANT_CONTENT_TYPE);
    expect(result?.metadata.originalWidth).toBe(100);
    expect(result?.metadata.originalHeight).toBe(50);
    expect(Object.keys(result?.metadata.variants ?? {}).sort()).toEqual(
      Object.values(IMAGE_QUALITY).sort(),
    );

    expect(s3Service.uploadFile).toHaveBeenCalledTimes(4);

    const uploadByKey = new Map<string, { buffer: Buffer; contentType: string }>();

    for (const [buffer, key, contentType] of s3Service.uploadFile.mock.calls) {
      if (Buffer.isBuffer(buffer)) {
        uploadByKey.set(key, { buffer, contentType });
      }
    }

    expect(uploadByKey.has(result?.referenceKey ?? "")).toBe(false);

    for (const { quality, width } of IMAGE_VARIANT_DEFINITIONS) {
      const variant = result?.metadata.variants[quality];
      expect(variant?.key).toBe(`${result?.referenceKey.replace(".webp", "")}-${quality}.webp`);
      expect(variant?.width).toBe(width);
      expect(variant?.height).toBe(width / 2);
      expect(variant?.contentType).toBe(IMAGE_VARIANT_CONTENT_TYPE);

      const upload = uploadByKey.get(variant?.key ?? "");
      expect(upload?.contentType).toBe(IMAGE_VARIANT_CONTENT_TYPE);

      const metadata = await sharp(upload?.buffer).metadata();
      expect(metadata.width).toBe(width);
      expect(metadata.height).toBe(width / 2);
      expect(metadata.format).toBe("webp");
    }
  });

  it("returns null for unsupported MIME types", async () => {
    const result = await service.createVariants({
      buffer: Buffer.from("svg"),
      resource: "course",
      mimeType: "image/svg+xml",
      tenantId: "00000000-0000-0000-0000-000000000001",
    });

    expect(result).toBeNull();
    expect(s3Service.uploadFile).not.toHaveBeenCalled();
  });

  it("throws a translation-key conflict when generation or upload fails", async () => {
    s3Service.uploadFile.mockRejectedValueOnce(new Error("S3 failed"));

    const sourceBuffer = await sharp({
      create: {
        width: 100,
        height: 50,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();

    await expect(
      service.createVariants({
        buffer: sourceBuffer,
        resource: "course",
        mimeType: "image/png",
        tenantId: "00000000-0000-0000-0000-000000000001",
      }),
    ).rejects.toThrow(new ConflictException("files.toast.imageVariantGenerationFailed"));
  });
});
