import { S3Service } from "./s3.service";

import type {
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { ConfigService } from "@nestjs/config";

describe("S3 upload metadata", () => {
  const service = new S3Service({ get: () => "test" } as unknown as ConfigService);
  const send = jest.fn().mockResolvedValue({ UploadId: "upload" });
  (service as unknown as { s3Client: { send: typeof send } }).s3Client = { send };

  beforeEach(() => send.mockClear());

  it("sets attachment disposition on active SVG and inline on raster", async () => {
    await service.uploadFile(Buffer.from("x"), "svg", "image/svg+xml");
    const svg = send.mock.calls[0][0] as PutObjectCommand;
    expect(svg.input.ContentDisposition).toBe("attachment");
    await service.uploadFile(Buffer.from("x"), "png", "image/png");
    const png = send.mock.calls[1][0] as PutObjectCommand;
    expect(png.input.ContentDisposition).toBe("inline");
  });

  it("sets disposition on multipart initiation and content-type replacement copy", async () => {
    await service.createMultipartUpload("doc", "application/pdf");
    expect((send.mock.calls[0][0] as CreateMultipartUploadCommand).input.ContentDisposition).toBe(
      "attachment",
    );
    await service.copyFile("source", "copy", "text/html");
    expect((send.mock.calls[1][0] as CopyObjectCommand).input.ContentDisposition).toBe(
      "attachment",
    );
  });
});
