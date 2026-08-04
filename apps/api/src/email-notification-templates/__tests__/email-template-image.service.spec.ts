import { RESOURCE_CATEGORIES } from "src/file/file.constants";

import { EmailTemplateImageService } from "../email-template-image.service";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type { FileService } from "src/file/file.service";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

const makeCurrentUser = (): CurrentUserType => ({
  userId: "22222222-2222-2222-2222-222222222222",
  email: "admin@example.com",
  roleSlugs: ["admin"],
  permissions: [],
  tenantId: TENANT_ID,
});

const makeFile = (): Express.Multer.File =>
  ({
    fieldname: "file",
    originalname: "photo.png",
    encoding: "7bit",
    mimetype: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    size: 4,
  }) as Express.Multer.File;

describe("EmailTemplateImageService", () => {
  const createService = () => {
    const uploadFile = jest.fn();
    const fileService = { uploadFile } as unknown as FileService;
    const service = new EmailTemplateImageService(fileService);
    return { service, uploadFile };
  };

  it("delegates to FileService.uploadFile with EMAIL_TEMPLATE_IMAGE category", async () => {
    const { service, uploadFile } = createService();
    const expectedFileKey = `${TENANT_ID}/email_template_image/variants/uuid.webp`;
    uploadFile.mockResolvedValue({ fileKey: expectedFileKey, fileUrl: "https://s3.example.com/…" });

    const result = await service.uploadForTenant(makeFile(), makeCurrentUser());

    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: "image/png" }),
      RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE,
      TENANT_ID,
      { skipVariants: true },
    );
    expect(result.reference).toBe(expectedFileKey);
  });

  it("returns the fileKey from FileService as reference", async () => {
    const { service, uploadFile } = createService();
    const fileKey = `${TENANT_ID}/email_template_image/variants/abc123.webp`;
    uploadFile.mockResolvedValue({ fileKey, fileUrl: "https://s3.example.com/abc123.webp" });

    const { reference } = await service.uploadForTenant(makeFile(), makeCurrentUser());

    expect(reference).toBe(fileKey);
  });

  it("returns a reference prefixed with the tenant id", async () => {
    const { service, uploadFile } = createService();
    uploadFile.mockImplementation((_file, _category, tenantId: string) =>
      Promise.resolve({
        fileKey: `${tenantId}/email_template_image/variants/uuid.webp`,
        fileUrl: "https://s3.example.com/uuid.webp",
      }),
    );

    const result = await service.uploadForTenant(makeFile(), makeCurrentUser());

    expect(result.reference.startsWith(`${TENANT_ID}/email_template_image/`)).toBe(true);
  });
});
