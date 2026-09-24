import { EMAIL_TEMPLATE_DOCUMENT_VERSION, type EmailTemplateDocument } from "@repo/email-templates";
import sharp from "sharp";

import { FileGuard } from "src/file/guards/file.guard";

import { EmailTemplateAssetService } from "./email-template-asset.service";

import type { EmailTemplateAssetRepository } from "../repositories/email-template-asset.repository";
import type { FileService } from "src/file/file.service";

describe("EmailTemplateAssetService", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const id = "00000000-0000-4000-8000-000000000002";
  const findEmailTemplateAsset = jest.fn();
  const getRawFileBuffer = jest.fn();
  const getFileUrl = jest.fn();
  const uploadResource = jest.fn();
  let webpBuffer: Buffer;
  const service = new EmailTemplateAssetService(
    { getRawFileBuffer, getFileUrl, uploadResource } as unknown as FileService,
    { findEmailTemplateAsset } as unknown as EmailTemplateAssetRepository,
  );
  const document: EmailTemplateDocument = {
    type: "doc",
    version: EMAIL_TEMPLATE_DOCUMENT_VERSION,
    content: [
      { type: "image", attrs: { src: `asset:${id}`, alt: "Uploaded" } },
      { type: "image", attrs: { src: "https://cdn.example/image.png", alt: "External" } },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    findEmailTemplateAsset.mockResolvedValue({
      reference: `${tenantId}/email-templates/variants/asset.webp`,
      contentType: "image/webp",
    });
    webpBuffer = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#fff" } })
      .webp()
      .toBuffer();
    getRawFileBuffer.mockResolvedValue(webpBuffer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns an authorized storage URL without rendering or downloading the image", async () => {
    getFileUrl.mockResolvedValue("https://storage.example/signed-image");
    expect(await service.getEmailTemplateImage(id, tenantId)).toEqual({
      resourceId: id,
      src: `asset:${id}`,
      previewUrl: "https://storage.example/signed-image",
    });
    expect(findEmailTemplateAsset).toHaveBeenCalledWith(id, tenantId);
    expect(getFileUrl).toHaveBeenCalledWith(`${tenantId}/email-templates/variants/asset.webp`);
    expect(getRawFileBuffer).not.toHaveBeenCalled();
  });

  it("uses the detected MIME when uploading the resource", async () => {
    jest.spyOn(FileGuard, "getFileType").mockResolvedValue({ ext: "png", mime: "image/png" });
    const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } })
      .png()
      .toBuffer();
    uploadResource.mockResolvedValue({
      resourceId: id,
      fileKey: `${tenantId}/email-templates/image`,
    });

    await service.uploadEmailTemplateImage(
      { buffer, mimetype: "image/jpeg" } as Express.Multer.File,
      { tenantId } as Parameters<EmailTemplateAssetService["uploadEmailTemplateImage"]>[1],
    );

    expect(uploadResource).toHaveBeenCalledWith(
      expect.objectContaining({ file: expect.objectContaining({ mimetype: "image/png" }) }),
    );
  });

  it("does not sign images outside the tenant's email assets", async () => {
    findEmailTemplateAsset.mockResolvedValue(undefined);
    await expect(service.getEmailTemplateImage(id, tenantId)).rejects.toThrow(
      "files.toast.invalidData",
    );
    expect(getFileUrl).not.toHaveBeenCalled();
  });

  it("checks tenant ownership before reading storage", async () => {
    findEmailTemplateAsset.mockResolvedValue(undefined);
    await expect(service.resolveEmailTemplateAssets(document, tenantId)).rejects.toThrow(
      "files.toast.invalidData",
    );
    expect(findEmailTemplateAsset).toHaveBeenCalledWith(id, tenantId);
    expect(getRawFileBuffer).not.toHaveBeenCalled();
  });

  it("rejects URL-backed or foreign storage references without fetching them", async () => {
    for (const reference of [
      "https://internal.example/secret",
      "another-tenant/email-templates/asset.png",
    ]) {
      findEmailTemplateAsset.mockResolvedValue({ reference, contentType: "image/png" });
      await expect(service.resolveEmailTemplateAssets(document, tenantId)).rejects.toThrow(
        "files.toast.invalidData",
      );
    }
    expect(getRawFileBuffer).not.toHaveBeenCalled();
  });

  it("embeds owned images as durable CID attachments and never fetches external images", async () => {
    const result = await service.resolveEmailTemplateAssets(document, tenantId);
    expect(result.document.content[0]).toMatchObject({
      attrs: { src: `cid:email-template-${id}` },
    });
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].cid).toBe(`email-template-${id}`);
    expect(result.attachments[0]).toMatchObject({
      filename: `email-template-${id}.webp`,
      contentType: "image/webp",
    });
    expect(result.attachments[0].content).toBe(webpBuffer);
    expect(getRawFileBuffer).toHaveBeenCalledTimes(1);
    expect(getRawFileBuffer).toHaveBeenCalledWith(
      `${tenantId}/email-templates/variants/asset.webp`,
    );
    expect(document.content[0]).toMatchObject({ attrs: { src: `asset:${id}` } });
    expect(result.document.content[1]).toEqual(document.content[1]);
  });

  it("returns inline preview data without storing signed URLs in the document", async () => {
    const result = await service.resolveEmailTemplateAssets(document, tenantId, true);
    expect(result.document.content[0]).toMatchObject({
      attrs: { src: expect.stringMatching(/^data:image\/webp;base64,/) },
    });
  });

  it("rejects resources without WebP content before reading storage", async () => {
    findEmailTemplateAsset.mockResolvedValueOnce({
      reference: `${tenantId}/email-templates/asset.png`,
      contentType: "image/png",
    });
    await expect(service.resolveEmailTemplateAssets(document, tenantId)).rejects.toThrow(
      "files.toast.invalidData",
    );
    expect(getRawFileBuffer).not.toHaveBeenCalled();
  });
});
