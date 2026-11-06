import { Test } from "@nestjs/testing";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { S3Service } from "src/s3/s3.service";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { RESOURCE_CATEGORIES } from "../file.constants";
import { FileService } from "../file.service";
import { HostedVideoStatusService } from "../hosted-video-status.service";
import { IMAGE_QUALITY, PWA_ICON_IMAGE_QUALITY } from "../image-variants/image-variant.constants";
import { ImageVariantService } from "../image-variants/image-variant.service";
import { BunnyVideoProvider } from "../providers/bunny-video.provider";
import { S3VideoProvider } from "../providers/s3-video.provider";
import { ThumbnailService } from "../thumbnail.service";
import { VideoMetadataQueueService } from "../video-metadata.queue.service";
import { VideoProcessingStateService } from "../video-processing-state.service";
import { VideoUploadAuthorizationService } from "../video-upload-authorization.service";
import { VideoUploadNotificationGateway } from "../video-upload-notification.gateway";

type S3ServiceMock = {
  getSignedUrl: jest.MockedFunction<S3Service["getSignedUrl"]>;
  getFileStream: jest.MockedFunction<S3Service["getFileStream"]>;
  getFileBuffer: jest.MockedFunction<S3Service["getFileBuffer"]>;
  deleteFile: jest.MockedFunction<S3Service["deleteFile"]>;
  getFileContentType: jest.MockedFunction<S3Service["getFileContentType"]>;
};

describe("FileService image variant references", () => {
  let service: FileService;
  let s3Service: S3ServiceMock;
  let db: { transaction: jest.Mock };

  const variantReference = "tenant/course/variants/image.webp";

  beforeEach(async () => {
    db = { transaction: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: S3Service,
          useValue: {
            getSignedUrl: jest.fn(async (key: string) => `signed:${key}`),
            getFileStream: jest.fn(async (key: string) => ({
              stream: key,
              contentType: "image/webp",
              contentLength: 1,
            })),
            getFileBuffer: jest.fn(async () => Buffer.from("image")),
            deleteFile: jest.fn().mockResolvedValue(undefined),
            getFileContentType: jest.fn().mockResolvedValue("image/webp"),
          },
        },
        { provide: BunnyStreamService, useValue: {} },
        { provide: VideoProcessingStateService, useValue: {} },
        { provide: BunnyVideoProvider, useValue: {} },
        { provide: S3VideoProvider, useValue: {} },
        { provide: ThumbnailService, useValue: {} },
        { provide: ImageVariantService, useValue: {} },
        { provide: "DB", useValue: db },
        { provide: "CACHE_MANAGER", useValue: {} },
        { provide: VideoUploadNotificationGateway, useValue: {} },
        { provide: VideoMetadataQueueService, useValue: {} },
        { provide: TenantDbRunnerService, useValue: {} },
        { provide: VideoUploadAuthorizationService, useValue: {} },
        { provide: HostedVideoStatusService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(FileService);
    s3Service = moduleRef.get(S3Service);
  });

  it("signs the high quality concrete variant by default", async () => {
    await expect(service.getFileUrl(variantReference)).resolves.toBe(
      "signed:tenant/course/variants/image-1920w.webp",
    );

    expect(s3Service.getSignedUrl).toHaveBeenCalledWith("tenant/course/variants/image-1920w.webp");
  });

  it("signs the requested concrete image variant", async () => {
    await expect(
      service.getFileUrl(variantReference, { quality: IMAGE_QUALITY.XXS }),
    ).resolves.toBe("signed:tenant/course/variants/image-160w.webp");

    expect(s3Service.getSignedUrl).toHaveBeenCalledWith("tenant/course/variants/image-160w.webp");
  });

  it("returns remote URLs without signing them", async () => {
    await expect(service.getFileUrl("https://cdn.example.com/image.png")).resolves.toBe(
      "https://cdn.example.com/image.png",
    );
    await expect(service.getFileUrl("http://cdn.example.com/image.png")).resolves.toBe(
      "http://cdn.example.com/image.png",
    );

    expect(s3Service.getSignedUrl).not.toHaveBeenCalled();
  });

  it("streams the high quality concrete variant", async () => {
    await service.getFileDelivery(variantReference);

    expect(s3Service.getFileStream).toHaveBeenCalledWith(
      "tenant/course/variants/image-1920w.webp",
      undefined,
    );
  });

  it("streams a requested PWA concrete variant", async () => {
    await service.getFileDelivery(variantReference, undefined, {
      quality: PWA_ICON_IMAGE_QUALITY.ICON_192,
    });

    expect(s3Service.getFileStream).toHaveBeenCalledWith(
      "tenant/course/variants/image-192w.webp",
      undefined,
    );
  });

  it("reads the high quality concrete variant buffer", async () => {
    await service.getRawFileBuffer(variantReference);

    expect(s3Service.getFileBuffer).toHaveBeenCalledWith("tenant/course/variants/image-1920w.webp");
  });

  it("deletes all concrete variants for a logical variant reference", async () => {
    await service.deleteFile(variantReference);

    expect(s3Service.deleteFile).toHaveBeenCalledTimes(8);
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-160w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-192w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-320w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-512w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-640w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-960w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-1280w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-1920w.webp");
  });

  it("removes uploaded image variants when resource registration fails", async () => {
    db.transaction = jest.fn().mockRejectedValue(new Error("database unavailable"));
    jest.spyOn(service, "uploadFile").mockResolvedValue({
      fileKey: variantReference,
      fileUrl: "signed:image",
      contentType: "image/webp",
    });

    await expect(
      service.uploadResource({
        file: {
          buffer: Buffer.from("image"),
          originalname: "image.webp",
          mimetype: "image/webp",
          size: 5,
        } as Express.Multer.File,
        resource: RESOURCE_CATEGORIES.COURSE,
        folder: "native-archive",
      }),
    ).rejects.toThrow("database unavailable");

    expect(s3Service.deleteFile).toHaveBeenCalledTimes(8);
  });

  describe("assertImageReference", () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const tenantVariant = `${tenantId}/course/variants/image.webp`;

    it("accepts a stored raster image of the caller's tenant, checking the concrete variant", async () => {
      await expect(service.assertImageReference(tenantVariant, tenantId)).resolves.toBeUndefined();

      expect(s3Service.getFileContentType).toHaveBeenCalledWith(
        expect.stringContaining(`${tenantId}/course/variants/`),
      );
      expect(s3Service.getFileContentType).not.toHaveBeenCalledWith(tenantVariant);
    });

    it("ignores an empty reference", async () => {
      await expect(service.assertImageReference("", tenantId)).resolves.toBeUndefined();
      expect(s3Service.getFileContentType).not.toHaveBeenCalled();
    });

    it.each([
      "https://images.example.com/thumbnail.png",
      "//images.example.com/thumbnail.png",
      "course/thumbnail.png",
      "22222222-2222-4222-8222-222222222222/course/thumbnail.png",
    ])("rejects %s before touching storage", async (reference) => {
      await expect(service.assertImageReference(reference, tenantId)).rejects.toThrow(
        "files.toast.invalidImageReference",
      );
      expect(s3Service.getFileContentType).not.toHaveBeenCalled();
    });

    it.each(["image/svg+xml", "image/bmp", "image/tiff"])(
      "accepts an already uploaded %s image of the caller's tenant",
      async (contentType) => {
        s3Service.getFileContentType.mockResolvedValue(contentType);

        await expect(
          service.assertImageReference(`${tenantId}/course/legacy-image`, tenantId),
        ).resolves.toBeUndefined();
      },
    );

    it.each([["application/pdf"], ["text/html"], [null]])(
      "rejects a tenant object stored as %s",
      async (contentType) => {
        s3Service.getFileContentType.mockResolvedValue(contentType);

        await expect(
          service.assertImageReference(`${tenantId}/course/file.png`, tenantId),
        ).rejects.toThrow("files.toast.invalidImageReference");
      },
    );

    it("rejects a reference to an object that does not exist", async () => {
      s3Service.getFileContentType.mockRejectedValue(new Error("NotFound"));

      await expect(
        service.assertImageReference(`${tenantId}/course/missing.png`, tenantId),
      ).rejects.toThrow("files.toast.invalidImageReference");
    });
  });

  describe("tenant-scoped signing", () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const otherTenantId = "99999999-9999-4999-8999-999999999999";

    it.each([`${otherTenantId}/course/private.png`, `${otherTenantId}/course/variants/image.webp`])(
      "returns no URL for another tenant's reference %s",
      async (reference) => {
        await expect(dbAls.run({ tenantId }, () => service.getFileUrl(reference))).resolves.toBe(
          "",
        );
        expect(s3Service.getSignedUrl).not.toHaveBeenCalled();
      },
    );

    it.each([
      [`${tenantId}/course/image.png`, `${tenantId}/course/image.png`],
      ["user-avatars/legacy-avatar.png", "user-avatars/legacy-avatar.png"],
    ])("signs an own-tenant or legacy reference %s", async (reference, storageKey) => {
      await expect(dbAls.run({ tenantId }, () => service.getFileUrl(reference))).resolves.toBe(
        `signed:${storageKey}`,
      );
    });

    it("leaves external URLs untouched", async () => {
      const url = "https://placehold.co/600x400";

      await expect(dbAls.run({ tenantId }, () => service.getFileUrl(url))).resolves.toBe(url);
      expect(s3Service.getSignedUrl).not.toHaveBeenCalled();
    });
  });
});
