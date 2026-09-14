import { EMAIL_TEMPLATE_DOCUMENT_VERSION, type EmailTemplateDocument } from "@repo/email-templates";
import sharp from "sharp";

import { EmailTemplateAssetService } from "./email-template-asset.service";

import type { EmailTemplateAssetRepository } from "../repositories/email-template-asset.repository";
import type { FileService } from "src/file/file.service";

describe("EmailTemplateAssetService", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const id = "00000000-0000-4000-8000-000000000002";
  const findEmailTemplateAsset = jest.fn();
  const getRawFileBuffer = jest.fn();
  const service = new EmailTemplateAssetService(
    { getRawFileBuffer } as unknown as FileService,
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
      reference: `${tenantId}/email-templates/asset.png`,
      contentType: "image/png",
    });
    getRawFileBuffer.mockResolvedValue(
      await sharp({ create: { width: 1, height: 1, channels: 3, background: "#fff" } })
        .png()
        .toBuffer(),
    );
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
    expect(getRawFileBuffer).toHaveBeenCalledTimes(1);
    expect(document.content[0]).toMatchObject({ attrs: { src: `asset:${id}` } });
    expect(result.document.content[1]).toEqual(document.content[1]);
  });

  it("returns inline preview data without storing signed URLs in the document", async () => {
    const result = await service.resolveEmailTemplateAssets(document, tenantId, true);
    expect(result.document.content[0]).toMatchObject({
      attrs: { src: expect.stringMatching(/^data:image\/png;base64,/) },
    });
  });
});
