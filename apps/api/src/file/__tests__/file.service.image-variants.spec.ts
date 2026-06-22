import { Test } from "@nestjs/testing";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { S3Service } from "src/s3/s3.service";

import { FileService } from "../file.service";
import { ImageVariantService } from "../image-variants/image-variant.service";
import { BunnyVideoProvider } from "../providers/bunny-video.provider";
import { S3VideoProvider } from "../providers/s3-video.provider";
import { ThumbnailService } from "../thumbnail.service";
import { VideoProcessingStateService } from "../video-processing-state.service";
import { VideoUploadNotificationGateway } from "../video-upload-notification.gateway";

type S3ServiceMock = {
  getSignedUrl: jest.MockedFunction<S3Service["getSignedUrl"]>;
  getFileStream: jest.MockedFunction<S3Service["getFileStream"]>;
  getFileBuffer: jest.MockedFunction<S3Service["getFileBuffer"]>;
  deleteFile: jest.MockedFunction<S3Service["deleteFile"]>;
};

describe("FileService image variant references", () => {
  let service: FileService;
  let s3Service: S3ServiceMock;

  const variantReference = "tenant/course/variants/image.webp";

  beforeEach(async () => {
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
          },
        },
        { provide: BunnyStreamService, useValue: {} },
        { provide: VideoProcessingStateService, useValue: {} },
        { provide: BunnyVideoProvider, useValue: {} },
        { provide: S3VideoProvider, useValue: {} },
        { provide: ThumbnailService, useValue: {} },
        { provide: ImageVariantService, useValue: {} },
        { provide: "DB", useValue: {} },
        { provide: "CACHE_MANAGER", useValue: {} },
        { provide: VideoUploadNotificationGateway, useValue: {} },
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

  it("reads the high quality concrete variant buffer", async () => {
    await service.getRawFileBuffer(variantReference);

    expect(s3Service.getFileBuffer).toHaveBeenCalledWith("tenant/course/variants/image-1920w.webp");
  });

  it("deletes all concrete variants for a logical variant reference", async () => {
    await service.deleteFile(variantReference);

    expect(s3Service.deleteFile).toHaveBeenCalledTimes(4);
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-640w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-960w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-1280w.webp");
    expect(s3Service.deleteFile).toHaveBeenCalledWith("tenant/course/variants/image-1920w.webp");
  });
});
