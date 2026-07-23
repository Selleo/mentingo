import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  EMAIL_TEMPLATE_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

const mockRenderTemplateContent = jest.fn();
jest.mock("../utils/renderTemplateContent", () => ({
  renderTemplateContent: (...args: unknown[]) => mockRenderTemplateContent(...args),
}));

jest.mock("src/storage/db/db-als.store", () => ({
  dbAls: {
    getStore: () => ({
      tenantId: "22222222-2222-2222-2222-222222222222",
      trx: {},
    }),
  },
}));

import { EmailNotificationTemplatesService } from "../email-templates.service";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

const EN = SUPPORTED_LANGUAGES.EN;
const PL = SUPPORTED_LANGUAGES.PL;
const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";

const makeCurrentUser = (overrides?: Partial<CurrentUserType>): CurrentUserType => ({
  userId: "33333333-3333-3333-3333-333333333333",
  email: "admin@example.com",
  roleSlugs: ["admin"],
  permissions: [],
  tenantId: TENANT_ID,
  ...overrides,
});

const makeBlocks = (): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: [
    {
      type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
      attrs: { [EMAIL_TEMPLATE_NODE_UUID_ATTR]: uuid1 },
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "Hello" }],
    },
  ],
});

const makeTemplate = (overrides?: Record<string, unknown>) => ({
  id: TEMPLATE_ID,
  name: "My Template",
  status: EMAIL_TEMPLATE_STATUSES.DRAFT,
  baseLanguage: EN,
  availableLocales: [EN, PL],
  subject: { [EN]: "Subject", [PL]: "Temat" },
  blocks: makeBlocks(),
  strings: {} as EmailTemplateStrings,
  archivedAt: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  tenantId: TENANT_ID,
  ...overrides,
});

const fn = () => jest.fn() as jest.Mock;

const makeRepository = () => {
  const r = {
    listTemplates: fn(),
    createTemplate: fn(),
    findById: fn(),
    updateTemplate: fn(),
    setStatus: fn(),
    deleteTemplate: fn(),
    deleteManyTemplates: fn(),
    findByName: fn(),
    findExistingNames: fn(),
    findBlocksByIds: fn(),
    duplicateFrom: fn(),
    findReferencedImageSrcs: fn(),
    findMaxAutoTemplateNumber: fn(),
  };
  return r;
};

const makeImageService = () => ({ deleteByKey: fn() });
const makeEmailService = () => ({ sendEmailWithLogo: fn() });

const makeTenantRunner = () => ({
  runWithTenant: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
});

const createService = () => {
  const repository = makeRepository();
  const imageService = makeImageService();
  const emailService = makeEmailService();
  const tenantRunner = makeTenantRunner();
  const service = new EmailNotificationTemplatesService(
    repository as never,
    imageService as never,
    emailService as never,
    tenantRunner as never,
  );
  return { service, repository, imageService, emailService, tenantRunner };
};

describe("EmailNotificationTemplatesService — validateLocales", () => {
  it("throws BadRequestException for an unknown locale", async () => {
    const { service, repository } = createService();
    repository.findByName.mockResolvedValue(undefined);

    await expect(
      service.createTemplate({
        name: "T",
        baseLanguage: EN,
        availableLocales: ["xx" as never],
        subject: { [EN]: "S" },
        blocks: makeBlocks(),
        strings: {},
      }),
    ).rejects.toThrow(new BadRequestException("emailTemplates.toast.invalidLocale"));
  });

  it("throws BadRequestException for duplicate locales", async () => {
    const { service, repository } = createService();
    repository.findByName.mockResolvedValue(undefined);

    await expect(
      service.createTemplate({
        name: "T",
        baseLanguage: EN,
        availableLocales: [EN, EN],
        subject: { [EN]: "S" },
        blocks: makeBlocks(),
        strings: {},
      }),
    ).rejects.toThrow(new BadRequestException("emailTemplates.toast.duplicateLocales"));
  });

  it("throws BadRequestException when baseLanguage is not in availableLocales", async () => {
    const { service, repository } = createService();
    repository.findByName.mockResolvedValue(undefined);

    await expect(
      service.createTemplate({
        name: "T",
        baseLanguage: EN,
        availableLocales: [PL],
        subject: { [EN]: "S" },
        blocks: makeBlocks(),
        strings: {},
      }),
    ).rejects.toThrow(new BadRequestException("emailTemplates.toast.baseLanguageMissing"));
  });
});

describe("EmailNotificationTemplatesService — ensureNameAvailable", () => {
  it("throws ConflictException when name already exists", async () => {
    const { service, repository } = createService();
    repository.findByName.mockResolvedValue({ id: "existing-id" });

    await expect(
      service.createTemplate({
        name: "My Template",
        baseLanguage: EN,
        availableLocales: [EN],
        subject: { [EN]: "S" },
        blocks: makeBlocks(),
        strings: {},
      }),
    ).rejects.toThrow(new ConflictException("emailTemplates.toast.nameAlreadyExists"));
  });
});

describe("EmailNotificationTemplatesService — duplicateTemplate / buildDuplicateName", () => {
  it("builds 'Copy of X' when no collisions", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate({ name: "Alpha" }));
    repository.findExistingNames.mockResolvedValue([]);
    repository.duplicateFrom.mockResolvedValue(makeTemplate({ name: "Copy of Alpha" }));

    const result = await service.duplicateTemplate(TEMPLATE_ID);

    expect(repository.duplicateFrom).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Copy of Alpha" }),
    );
    expect(result.name).toBe("Copy of Alpha");
  });

  it("uses 'Copy of X (2)' when 'Copy of X' is taken", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate({ name: "Beta" }));
    repository.findExistingNames.mockResolvedValue(["Copy of Beta"]);
    repository.duplicateFrom.mockResolvedValue(makeTemplate({ name: "Copy of Beta (2)" }));

    await service.duplicateTemplate(TEMPLATE_ID);

    expect(repository.duplicateFrom).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Copy of Beta (2)" }),
    );
  });

  it("increments past (2) when (2) is also taken", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate({ name: "Gamma" }));
    repository.findExistingNames.mockResolvedValue(["Copy of Gamma", "Copy of Gamma (2)"]);
    repository.duplicateFrom.mockResolvedValue(makeTemplate({ name: "Copy of Gamma (3)" }));

    await service.duplicateTemplate(TEMPLATE_ID);

    expect(repository.duplicateFrom).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Copy of Gamma (3)" }),
    );
  });

  it("falls into while loop when all 20 candidates are taken", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate({ name: "Delta" }));
    const base = "Copy of Delta";
    const allCandidates = [base, ...Array.from({ length: 20 }, (_, i) => `${base} (${i + 2})`)];
    repository.findExistingNames.mockResolvedValue(allCandidates);
    repository.findByName.mockResolvedValueOnce({ id: "x" }).mockResolvedValueOnce(undefined);
    repository.duplicateFrom.mockResolvedValue(makeTemplate({ name: `${base} (23)` }));

    await service.duplicateTemplate(TEMPLATE_ID);

    expect(repository.duplicateFrom).toHaveBeenCalledWith(
      expect.objectContaining({ name: `${base} (23)` }),
    );
  });

  it("re-keys block uuids and remaps strings", async () => {
    const { service, repository } = createService();
    const fragment = [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "Hello" }];
    repository.findById.mockResolvedValue(
      makeTemplate({
        blocks: makeBlocks(),
        strings: { [EN]: { [uuid1]: fragment } } as EmailTemplateStrings,
      }),
    );
    repository.findExistingNames.mockResolvedValue([]);
    repository.duplicateFrom.mockResolvedValue(makeTemplate());

    await service.duplicateTemplate(TEMPLATE_ID);

    const callArgs = (repository.duplicateFrom.mock.calls[0] as unknown[])[0] as {
      blocks: EmailTemplateBlocks;
      strings: EmailTemplateStrings;
    };
    expect(callArgs).toBeDefined();

    const newUuid = callArgs.blocks.content?.[0]?.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR] as string;
    expect(newUuid).toBeDefined();
    expect(newUuid).not.toBe(uuid1);
    expect(callArgs.strings[EN]?.[newUuid]).toBeDefined();
    expect(callArgs.strings[EN]?.[uuid1]).toBeUndefined();
  });
});

describe("EmailNotificationTemplatesService — previewTemplate", () => {
  it("throws BadRequestException when requested language is not in availableLocales", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate({ availableLocales: [EN] }));

    await expect(service.previewTemplate(TEMPLATE_ID, PL)).rejects.toThrow(
      new BadRequestException("emailTemplates.toast.previewLanguageUnavailable"),
    );
  });

  it("defaults to baseLanguage when no language is passed", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate());
    mockRenderTemplateContent.mockResolvedValue({ language: EN, subject: "S", html: "<html/>" });

    await service.previewTemplate(TEMPLATE_ID);

    expect(mockRenderTemplateContent).toHaveBeenCalledWith(
      expect.objectContaining({ language: EN }),
    );
  });
});

describe("EmailNotificationTemplatesService — sendTestEmail", () => {
  it("throws BadRequestException when requested language is not in availableLocales", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate({ availableLocales: [EN] }));

    await expect(service.sendTestEmail(TEMPLATE_ID, makeCurrentUser(), PL)).rejects.toThrow(
      new BadRequestException("emailTemplates.toast.previewLanguageUnavailable"),
    );
  });

  it("defaults to baseLanguage when no language is passed", async () => {
    const { service, repository, emailService } = createService();
    repository.findById.mockResolvedValue(makeTemplate());
    mockRenderTemplateContent.mockResolvedValue({
      language: EN,
      subject: "Subject",
      html: "<html/>",
    });
    emailService.sendEmailWithLogo.mockResolvedValue(undefined);

    await service.sendTestEmail(TEMPLATE_ID, makeCurrentUser());

    expect(mockRenderTemplateContent).toHaveBeenCalledWith(
      expect.objectContaining({ language: EN }),
    );
  });

  it("calls emailService.sendEmailWithLogo with to, subject, html and tenantId", async () => {
    const { service, repository, emailService } = createService();
    const currentUser = makeCurrentUser({ email: "test@example.com", tenantId: TENANT_ID });
    repository.findById.mockResolvedValue(makeTemplate());
    mockRenderTemplateContent.mockResolvedValue({
      language: EN,
      subject: "My Subject",
      html: "<html>email</html>",
    });
    emailService.sendEmailWithLogo.mockResolvedValue(undefined);

    await service.sendTestEmail(TEMPLATE_ID, currentUser, EN);

    expect(emailService.sendEmailWithLogo).toHaveBeenCalledWith(
      { to: "test@example.com", subject: "My Subject", html: "<html>email</html>" },
      { tenantId: TENANT_ID },
    );
  });
});

describe("EmailNotificationTemplatesService — updateTemplate", () => {
  it("passes pruned strings to repository.updateTemplate", async () => {
    const { service, repository } = createService();
    const orphanUuid = "bbbbbbbb-0000-4000-8000-000000000001";
    repository.findById.mockResolvedValue(
      makeTemplate({
        strings: {
          [EN]: {
            [uuid1]: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "live" }],
            [orphanUuid]: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "orphan" }],
          },
        } as EmailTemplateStrings,
      }),
    );
    repository.findByName.mockResolvedValue(undefined);
    repository.updateTemplate.mockResolvedValue(makeTemplate());
    repository.findReferencedImageSrcs.mockResolvedValue(new Set());

    await service.updateTemplate(TEMPLATE_ID, {});

    const updatedArg = (repository.updateTemplate.mock.calls[0] as unknown[])[1] as {
      strings: EmailTemplateStrings;
    };
    expect(updatedArg.strings[EN]?.[uuid1]).toBeDefined();
    expect(updatedArg.strings[EN]?.[orphanUuid]).toBeUndefined();
  });

  it("triggers image cleanup for removed image srcs", async () => {
    const { service, repository, imageService } = createService();
    const removedSrc = "/api/public/email-template-image/old-key.webp";
    const keptSrc = "/api/public/email-template-image/kept-key.webp";
    const oldBlocks: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [
        { type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE, attrs: { src: removedSrc } },
        { type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE, attrs: { src: keptSrc } },
      ],
    };
    const newBlocks: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE, attrs: { src: keptSrc } }],
    };
    repository.findById.mockResolvedValue(makeTemplate({ blocks: oldBlocks }));
    repository.updateTemplate.mockResolvedValue(makeTemplate({ blocks: newBlocks }));
    repository.findReferencedImageSrcs.mockResolvedValue(new Set());
    imageService.deleteByKey.mockResolvedValue(undefined);

    await service.updateTemplate(TEMPLATE_ID, { blocks: newBlocks as never });

    await new Promise((r) => setTimeout(r, 10));
    expect(imageService.deleteByKey).toHaveBeenCalledWith(expect.stringContaining("old-key"));
    expect(imageService.deleteByKey).not.toHaveBeenCalledWith(expect.stringContaining("kept-key"));
  });
});

describe("EmailNotificationTemplatesService — deleteTemplate", () => {
  it("triggers image cleanup for all image srcs in the deleted template", async () => {
    const { service, repository, imageService } = createService();
    const imageSrc = "/api/public/email-template-image/some-key.webp";
    const blocksWithImage: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE, attrs: { src: imageSrc } }],
    };
    repository.findById.mockResolvedValue(makeTemplate({ blocks: blocksWithImage }));
    repository.deleteTemplate.mockResolvedValue({ id: TEMPLATE_ID });
    repository.findReferencedImageSrcs.mockResolvedValue(new Set());
    imageService.deleteByKey.mockResolvedValue(undefined);

    await service.deleteTemplate(TEMPLATE_ID);

    await new Promise((r) => setTimeout(r, 10));
    expect(imageService.deleteByKey).toHaveBeenCalledWith(expect.stringContaining("some-key"));
  });
});

describe("EmailNotificationTemplatesService — deleteManyTemplates", () => {
  it("throws BadRequestException when ids array is empty", async () => {
    const { service } = createService();

    await expect(service.deleteManyTemplates([])).rejects.toThrow(
      new BadRequestException("emailTemplates.toast.deleteFailed"),
    );
  });

  it("triggers image cleanup for all collected srcs", async () => {
    const { service, repository, imageService } = createService();
    const src1 = "/api/public/email-template-image/img1.webp";
    const blocksWithImage: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE, attrs: { src: src1 } }],
    };
    repository.findBlocksByIds.mockResolvedValue([blocksWithImage]);
    repository.deleteManyTemplates.mockResolvedValue([{ id: TEMPLATE_ID }]);
    repository.findReferencedImageSrcs.mockResolvedValue(new Set());
    imageService.deleteByKey.mockResolvedValue(undefined);

    await service.deleteManyTemplates([TEMPLATE_ID]);

    await new Promise((r) => setTimeout(r, 10));
    expect(imageService.deleteByKey).toHaveBeenCalledWith(expect.stringContaining("img1"));
  });
});

describe("EmailNotificationTemplatesService — status transitions", () => {
  const cases = [
    {
      method: "publishTemplate" as const,
      status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
      archivedAtIsDate: false,
      errorKey: "emailTemplates.toast.publishFailed",
    },
    {
      method: "makeDraftTemplate" as const,
      status: EMAIL_TEMPLATE_STATUSES.DRAFT,
      archivedAtIsDate: false,
      errorKey: "emailTemplates.toast.makeDraftFailed",
    },
    {
      method: "archiveTemplate" as const,
      status: EMAIL_TEMPLATE_STATUSES.ARCHIVED,
      archivedAtIsDate: true,
      errorKey: "emailTemplates.toast.archiveFailed",
    },
    {
      method: "unarchiveTemplate" as const,
      status: EMAIL_TEMPLATE_STATUSES.DRAFT,
      archivedAtIsDate: false,
      errorKey: "emailTemplates.toast.unarchiveFailed",
    },
  ] as const;

  for (const { method, status, archivedAtIsDate, errorKey } of cases) {
    it(`${method} calls setStatus with status=${status}`, async () => {
      const { service, repository } = createService();
      repository.findById.mockResolvedValue(makeTemplate());
      repository.setStatus.mockResolvedValue(makeTemplate({ status }));

      await service[method](TEMPLATE_ID);

      expect(repository.setStatus).toHaveBeenCalledWith(
        TEMPLATE_ID,
        status,
        archivedAtIsDate ? expect.any(String) : null,
      );
    });

    it(`${method} throws BadRequestException when repository returns null/undefined`, async () => {
      const { service, repository } = createService();
      repository.findById.mockResolvedValue(makeTemplate());
      repository.setStatus.mockResolvedValue(undefined);

      await expect(service[method](TEMPLATE_ID)).rejects.toThrow(new BadRequestException(errorKey));
    });
  }
});
