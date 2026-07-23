import { RESOURCE_CATEGORIES } from "src/file/file.constants";

import { PublicEmailTemplateImageService } from "../public-email-template-image.service";

import type { FileService } from "src/file/file.service";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_TENANT_ID = "99999999-9999-9999-9999-999999999999";

const createService = () => {
  const getImageUrlByQuality = jest.fn();
  const fileService = { getImageUrlByQuality } as unknown as FileService;
  const service = new PublicEmailTemplateImageService(fileService);
  return { service, getImageUrlByQuality };
};

describe("PublicEmailTemplateImageService", () => {
  describe("resolveSignedUrl", () => {
    it("returns null when reference does not start with the tenant prefix", async () => {
      const { service } = createService();
      const alienRef = `${OTHER_TENANT_ID}/${RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE}/variants/uuid.webp`;

      const result = await service.resolveSignedUrl(alienRef, TENANT_ID);

      expect(result).toBeNull();
    });

    it("returns null when reference has no tenant prefix at all", async () => {
      const { service } = createService();

      const result = await service.resolveSignedUrl(
        "email_template_image/variants/uuid.webp",
        TENANT_ID,
      );

      expect(result).toBeNull();
    });

    it("resolves a valid variant reference through getImageUrlByQuality", async () => {
      const { service, getImageUrlByQuality } = createService();
      const reference = `${TENANT_ID}/${RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE}/variants/uuid.webp`;
      const signedUrl = "https://s3.example.com/signed-url";
      getImageUrlByQuality.mockResolvedValue(signedUrl);

      const result = await service.resolveSignedUrl(reference, TENANT_ID);

      expect(getImageUrlByQuality).toHaveBeenCalledWith(reference);
      expect(result).toBe(signedUrl);
    });

    it("decodes a percent-encoded reference before checking the prefix", async () => {
      const { service, getImageUrlByQuality } = createService();
      const rawRef = `${TENANT_ID}/${RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE}/variants/uuid.webp`;
      const encoded = encodeURIComponent(rawRef);
      const signedUrl = "https://s3.example.com/signed-url";
      getImageUrlByQuality.mockResolvedValue(signedUrl);

      const result = await service.resolveSignedUrl(encoded, TENANT_ID);

      expect(getImageUrlByQuality).toHaveBeenCalledWith(rawRef);
      expect(result).toBe(signedUrl);
    });
  });
});
