import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";

import { EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH } from "../email-template-image.constants";
import { EmailNotificationTemplatesRepository } from "../email-templates.repository";

import type { EmailTemplateBlocks } from "@repo/shared";

const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";

const imageBlocks = (src: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: [
    {
      type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
      attrs: { src },
    },
  ],
});

const createRepository = (rows: Array<{ blocks: EmailTemplateBlocks }>) => {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  const repository = new EmailNotificationTemplatesRepository({ select } as never);

  return { repository, select, from, where };
};

describe("EmailNotificationTemplatesRepository — findReferencedImageKeys", () => {
  it("returns requested keys found in stored block image URLs by canonical key", async () => {
    const key = `${TENANT_ID}/email_template_image/current.webp`;
    const storedSrc = `https://tenant.test${EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH}${encodeURIComponent(
      key,
    )}`;
    const { repository } = createRepository([{ blocks: imageBlocks(storedSrc) }]);

    const result = await repository.findReferencedImageKeys([key], TENANT_ID, TEMPLATE_ID);

    expect(result).toEqual(new Set([key]));
  });

  it("does not return keys from another tenant or category", async () => {
    const key = `${TENANT_ID}/email_template_image/current.webp`;
    const otherTenantSrc = `https://tenant.test${EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH}${encodeURIComponent(
      "99999999-9999-9999-9999-999999999999/email_template_image/current.webp",
    )}`;
    const otherCategorySrc = `https://tenant.test${EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH}${encodeURIComponent(
      `${TENANT_ID}/course/current.webp`,
    )}`;
    const { repository } = createRepository([
      { blocks: imageBlocks(otherTenantSrc) },
      { blocks: imageBlocks(otherCategorySrc) },
    ]);

    const result = await repository.findReferencedImageKeys([key], TENANT_ID, TEMPLATE_ID);

    expect(result).toEqual(new Set());
  });
});
