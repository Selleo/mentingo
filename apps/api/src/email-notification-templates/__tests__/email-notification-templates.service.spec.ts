import { BadRequestException, ConflictException, Logger } from "@nestjs/common";
import {
  DEFAULT_TENANT_PRIMARY_COLOR,
  EMAIL_TEMPLATE_NODE_TYPES,
  EMAIL_TEMPLATE_NODE_UUID_ATTR,
  EMAIL_TEMPLATE_STATUSES,
  SUPPORTED_LANGUAGES,
  TENANT_LOGO_CID_SRC,
} from "@repo/shared";

const mockRenderTemplateContent = jest.fn();
jest.mock("../utils/renderTemplateContent", () => ({
  renderTemplateContent: (...args: unknown[]) => mockRenderTemplateContent(...args),
}));

import { EmailNotificationTemplatesService } from "../email-templates.service";
import { buildDefaultEmailTemplateBlocks } from "../utils/buildDefaultEmailTemplateBlocks";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

const EN = SUPPORTED_LANGUAGES.EN;
const PL = SUPPORTED_LANGUAGES.PL;
const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";
const NAME_INDEX = "email_notification_templates_tenant_id_name_unique_idx";

const uniqueNameViolation = (overrides?: Record<string, unknown>) =>
  Object.assign(new Error(`duplicate key value violates unique constraint "${NAME_INDEX}"`), {
    code: "23505",
    constraint_name: NAME_INDEX,
    ...overrides,
  });

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

const linkedText = (href: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.TEXT,
  text: "linked",
  marks: [{ type: "link", attrs: { href } }],
});

const imageBlocks = (src: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: [
    {
      type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE,
      attrs: { src },
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
    findTemplateBlocks: fn(),
    findAutoTemplateNames: fn(),
  };
  return r;
};

const makeFileService = () => ({ deleteFile: fn() });
const makeEmailService = () => {
  const service = {
    sendEmailWithLogo: fn(),
    getDefaultEmailProperties: fn(),
  };
  service.getDefaultEmailProperties.mockResolvedValue({
    primaryColor: DEFAULT_TENANT_PRIMARY_COLOR,
    companyName: "Mentingo.com",
    language: EN,
  });
  return service;
};
const makeSettingsService = () => ({
  getPlatformLogoUrl: fn(),
});

const makeCleanupQueue = () => ({
  enqueueImageCleanup: fn(),
});

const createService = () => {
  const repository = makeRepository();
  const fileService = makeFileService();
  const emailService = makeEmailService();
  const settingsService = makeSettingsService();
  const cleanupQueue = makeCleanupQueue();
  cleanupQueue.enqueueImageCleanup.mockResolvedValue(undefined);
  const service = new EmailNotificationTemplatesService(
    repository as never,
    fileService as never,
    emailService as never,
    settingsService as never,
    cleanupQueue as never,
  );
  return { service, repository, fileService, emailService, settingsService, cleanupQueue };
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

  it("throws ConflictException when create hits a duplicate-name race", async () => {
    const { service, repository } = createService();
    repository.findByName.mockResolvedValue(undefined);
    repository.createTemplate.mockRejectedValue(uniqueNameViolation());

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

describe("EmailNotificationTemplatesService — rendered URL validation", () => {
  it("allows saving freshly created default draft blocks with an empty button url", async () => {
    const { service, repository } = createService();
    const blocks = buildDefaultEmailTemplateBlocks(EN);
    const existing = makeTemplate({ blocks, strings: {} });
    repository.findById.mockResolvedValue(existing);
    repository.updateTemplate.mockResolvedValue(existing);

    await expect(
      service.updateTemplate(
        TEMPLATE_ID,
        {
          blocks,
          strings: {},
        },
        TENANT_ID,
      ),
    ).resolves.toBe(existing);
    expect(repository.updateTemplate).toHaveBeenCalled();
  });

  it("rejects unsafe hrefs introduced by translated strings on create", async () => {
    const { service, repository } = createService();

    await expect(
      service.createTemplate({
        name: "Translated links",
        baseLanguage: EN,
        availableLocales: [EN, PL],
        subject: { [EN]: "Subject", [PL]: "Temat" },
        blocks: makeBlocks(),
        strings: {
          [PL]: { [uuid1]: [linkedText("javascript:alert(1)")] },
        },
      }),
    ).rejects.toThrow(new BadRequestException("emailTemplates.toast.invalidUrl"));
    expect(repository.createTemplate).not.toHaveBeenCalled();
  });

  it("rejects unsafe hrefs introduced by translated strings on update", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate());

    await expect(
      service.updateTemplate(
        TEMPLATE_ID,
        {
          strings: {
            [PL]: { [uuid1]: [linkedText("javascript:alert(1)")] },
          },
        },
        TENANT_ID,
      ),
    ).rejects.toThrow(new BadRequestException("emailTemplates.toast.invalidUrl"));
    expect(repository.updateTemplate).not.toHaveBeenCalled();
  });
});

describe("EmailNotificationTemplatesService — auto-name on create", () => {
  const uniqueViolation = () => uniqueNameViolation({ constraint_name: NAME_INDEX });

  const autoNameInput = {
    baseLanguage: EN,
    availableLocales: [EN],
  };

  it("assigns 'Email template #<max+1>' when name is omitted", async () => {
    const { service, repository } = createService();
    repository.findAutoTemplateNames.mockResolvedValue(["Email template #2", "Email template #4"]);
    repository.createTemplate.mockResolvedValue(makeTemplate({ name: "Email template #5" }));

    const result = await service.createTemplate(autoNameInput);

    expect(repository.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Email template #5" }),
    );
    expect(result.name).toBe("Email template #5");
  });

  it("ignores names that do not match the auto-name pattern", async () => {
    const { service, repository } = createService();
    repository.findAutoTemplateNames.mockResolvedValue([
      "Email template #2",
      "Email template #abc",
      "Custom Email template #12",
    ]);
    repository.createTemplate.mockResolvedValue(makeTemplate({ name: "Email template #3" }));

    const result = await service.createTemplate(autoNameInput);

    expect(repository.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Email template #3" }),
    );
    expect(result.name).toBe("Email template #3");
  });

  it("rethrows unique-violation errors when no constraint field is present", async () => {
    const { service, repository } = createService();
    repository.findAutoTemplateNames.mockResolvedValue(["Email template #4"]);
    const err = uniqueNameViolation({ constraint_name: undefined, constraint: undefined });
    repository.createTemplate.mockRejectedValueOnce(err);

    await expect(service.createTemplate(autoNameInput)).rejects.toBe(err);
    expect(repository.createTemplate).toHaveBeenCalledTimes(1);
  });

  it("throws ConflictException when the generated name conflicts", async () => {
    const { service, repository } = createService();
    repository.findAutoTemplateNames.mockResolvedValue(["Email template #4"]);
    repository.createTemplate.mockRejectedValue(uniqueViolation());

    await expect(service.createTemplate(autoNameInput)).rejects.toThrow(
      new ConflictException("emailTemplates.toast.nameAlreadyExists"),
    );
    expect(repository.createTemplate).toHaveBeenCalledTimes(1);
  });

  it("rethrows non-unique errors without retrying", async () => {
    const { service, repository } = createService();
    repository.findAutoTemplateNames.mockResolvedValue(["Email template #4"]);
    const other = Object.assign(new Error("boom"), { code: "42P01" });
    repository.createTemplate.mockRejectedValue(other);

    await expect(service.createTemplate(autoNameInput)).rejects.toBe(other);
    expect(repository.createTemplate).toHaveBeenCalledTimes(1);
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

    await expect(service.previewTemplate(TEMPLATE_ID, TENANT_ID, PL)).rejects.toThrow(
      new BadRequestException("emailTemplates.toast.previewLanguageUnavailable"),
    );
  });

  it("defaults to baseLanguage when no language is passed", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate());
    mockRenderTemplateContent.mockResolvedValue({ language: EN, subject: "S", html: "<html/>" });

    await service.previewTemplate(TEMPLATE_ID, TENANT_ID);

    expect(mockRenderTemplateContent).toHaveBeenCalledWith(
      expect.objectContaining({ language: EN }),
    );
  });

  it("passes the tenant primary color to renderTemplateContent", async () => {
    const { service, repository, emailService, settingsService } = createService();
    repository.findById.mockResolvedValue(makeTemplate());
    settingsService.getPlatformLogoUrl.mockResolvedValue(null);
    emailService.getDefaultEmailProperties.mockResolvedValue({
      primaryColor: "#ff00aa",
      companyName: "Acme",
      language: EN,
    });
    mockRenderTemplateContent.mockResolvedValue({ language: EN, subject: "S", html: "<html/>" });

    await service.previewTemplate(TEMPLATE_ID, TENANT_ID);

    expect(emailService.getDefaultEmailProperties).toHaveBeenCalledWith(TENANT_ID);
    expect(mockRenderTemplateContent).toHaveBeenCalledWith(
      expect.objectContaining({ primaryColor: "#ff00aa" }),
    );
  });

  it("passes a tenant logo URL to renderTemplateContent when one exists", async () => {
    const { service, repository, settingsService } = createService();
    repository.findById.mockResolvedValue(makeTemplate());
    settingsService.getPlatformLogoUrl.mockResolvedValue(
      "/api/settings/platform-logo/image?v=logo",
    );
    mockRenderTemplateContent.mockResolvedValue({ language: EN, subject: "S", html: "<html/>" });

    await service.previewTemplate(TEMPLATE_ID, TENANT_ID);

    expect(mockRenderTemplateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantLogoSrc: "/api/settings/platform-logo/image?v=logo",
      }),
    );
  });

  it("passes the default platform logo path to renderTemplateContent when the tenant has no logo", async () => {
    const { service, repository, settingsService } = createService();
    repository.findById.mockResolvedValue(makeTemplate());
    settingsService.getPlatformLogoUrl.mockResolvedValue(null);
    mockRenderTemplateContent.mockResolvedValue({ language: EN, subject: "S", html: "<html/>" });

    await service.previewTemplate(TEMPLATE_ID, TENANT_ID);

    expect(mockRenderTemplateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantLogoSrc: "/app/assets/svgs/app-logo.svg",
      }),
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

  it("passes the tenant primary color to renderTemplateContent", async () => {
    const { service, repository, emailService } = createService();
    repository.findById.mockResolvedValue(makeTemplate());
    emailService.getDefaultEmailProperties.mockResolvedValue({
      primaryColor: "#00aaff",
      companyName: "Acme",
      language: EN,
    });
    mockRenderTemplateContent.mockResolvedValue({
      language: EN,
      subject: "Subject",
      html: "<html/>",
    });
    emailService.sendEmailWithLogo.mockResolvedValue(undefined);

    await service.sendTestEmail(TEMPLATE_ID, makeCurrentUser());

    expect(emailService.getDefaultEmailProperties).toHaveBeenCalledWith(TENANT_ID);
    expect(mockRenderTemplateContent).toHaveBeenCalledWith(
      expect.objectContaining({ primaryColor: "#00aaff" }),
    );
  });

  it("renders test emails with the inline logo cid source", async () => {
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
      expect.objectContaining({ tenantLogoSrc: TENANT_LOGO_CID_SRC }),
    );
  });
});

describe("EmailNotificationTemplatesService — updateTemplate", () => {
  it("throws ConflictException when update hits a duplicate-name race", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate());
    repository.findByName.mockResolvedValue(undefined);
    repository.updateTemplate.mockRejectedValue(uniqueNameViolation());

    await expect(
      service.updateTemplate(TEMPLATE_ID, { name: "New name" }, TENANT_ID),
    ).rejects.toThrow(new ConflictException("emailTemplates.toast.nameAlreadyExists"));
  });

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

    await service.updateTemplate(TEMPLATE_ID, {}, TENANT_ID);

    const updatedArg = (repository.updateTemplate.mock.calls[0] as unknown[])[1] as {
      strings: EmailTemplateStrings;
    };
    expect(updatedArg.strings[EN]?.[uuid1]).toBeDefined();
    expect(updatedArg.strings[EN]?.[orphanUuid]).toBeUndefined();
  });

  it("updates blocks after an image is removed", async () => {
    const { service, repository } = createService();
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

    await service.updateTemplate(TEMPLATE_ID, { blocks: newBlocks as never }, TENANT_ID);

    expect(repository.updateTemplate).toHaveBeenCalledWith(
      TEMPLATE_ID,
      expect.objectContaining({ blocks: newBlocks }),
    );
  });

  it("does not fail the update when image cleanup enqueue fails after mutation", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { service, repository, cleanupQueue } = createService();
    const removedSrc = "/api/public/email-template-image/old-key.webp";
    const oldBlocks: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE, attrs: { src: removedSrc } }],
    };
    const newBlocks: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [],
    };
    const updated = makeTemplate({ blocks: newBlocks });
    repository.findById.mockResolvedValue(makeTemplate({ blocks: oldBlocks }));
    repository.updateTemplate.mockResolvedValue(updated);
    cleanupQueue.enqueueImageCleanup.mockRejectedValue(new Error("redis unavailable"));

    await expect(
      service.updateTemplate(TEMPLATE_ID, { blocks: newBlocks as never }, TENANT_ID),
    ).resolves.toBe(updated);

    expect(cleanupQueue.enqueueImageCleanup).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      srcs: [removedSrc],
      excludeTemplateId: TEMPLATE_ID,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to enqueue email template image cleanup: redis unavailable",
    );
    warnSpy.mockRestore();
  });
});

describe("EmailNotificationTemplatesService — deleteTemplate", () => {
  it("does not fail the delete when image cleanup enqueue fails after mutation", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { service, repository, cleanupQueue } = createService();
    const removedSrc = "/api/public/email-template-image/old-key.webp";
    const blocks: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE, attrs: { src: removedSrc } }],
    };
    repository.findById.mockResolvedValue(makeTemplate({ blocks }));
    repository.deleteTemplate.mockResolvedValue(makeTemplate({ blocks }));
    cleanupQueue.enqueueImageCleanup.mockRejectedValue(new Error("redis unavailable"));

    await expect(service.deleteTemplate(TEMPLATE_ID, TENANT_ID)).resolves.toBeUndefined();

    expect(cleanupQueue.enqueueImageCleanup).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      srcs: [removedSrc],
      excludeTemplateId: undefined,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to enqueue email template image cleanup: redis unavailable",
    );
    warnSpy.mockRestore();
  });
});

describe("EmailNotificationTemplatesService — deleteManyTemplates", () => {
  it("throws BadRequestException when ids array is empty", async () => {
    const { service } = createService();

    await expect(service.deleteManyTemplates([], TENANT_ID)).rejects.toThrow(
      new BadRequestException("emailTemplates.toast.deleteFailed"),
    );
  });

  it("does not fail the delete when image cleanup enqueue fails after mutation", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { service, repository, cleanupQueue } = createService();
    const removedSrc = "/api/public/email-template-image/old-key.webp";
    const blocks: EmailTemplateBlocks = {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.IMAGE, attrs: { src: removedSrc } }],
    };
    repository.findBlocksByIds.mockResolvedValue([blocks]);
    repository.deleteManyTemplates.mockResolvedValue([makeTemplate({ blocks })]);
    cleanupQueue.enqueueImageCleanup.mockRejectedValue(new Error("redis unavailable"));

    await expect(service.deleteManyTemplates([TEMPLATE_ID], TENANT_ID)).resolves.toBeUndefined();

    expect(cleanupQueue.enqueueImageCleanup).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      srcs: [removedSrc],
      excludeTemplateId: undefined,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to enqueue email template image cleanup: redis unavailable",
    );
    warnSpy.mockRestore();
  });
});

describe("EmailNotificationTemplatesService — purgeOrphanedImages", () => {
  it("deletes unreferenced image keys and keeps referenced images", async () => {
    const { service, repository, fileService } = createService();
    const removedSrc = `/api/public/email-template-image/${TENANT_ID}/email_template_image/old-key.webp`;
    const keptSrc = `/api/public/email-template-image/${TENANT_ID}/email_template_image/kept-key.webp`;
    const removedKey = `${TENANT_ID}/email_template_image/old-key.webp`;
    const keptKey = `${TENANT_ID}/email_template_image/kept-key.webp`;
    repository.findTemplateBlocks.mockResolvedValue([imageBlocks(keptSrc)]);
    fileService.deleteFile.mockResolvedValue(undefined);

    await service.purgeOrphanedImages({
      tenantId: TENANT_ID,
      srcs: [removedSrc, keptSrc, removedSrc],
      excludeTemplateId: TEMPLATE_ID,
    });

    expect(repository.findTemplateBlocks).toHaveBeenCalledWith(TEMPLATE_ID);
    expect(fileService.deleteFile).toHaveBeenCalledWith(removedKey);
    expect(fileService.deleteFile).not.toHaveBeenCalledWith(keptKey);
  });

  it("does not delete extracted keys outside the current tenant email template image category", async () => {
    const { service, repository, fileService } = createService();
    const safeSrc = `/api/public/email-template-image/${TENANT_ID}/email_template_image/current.webp`;
    const differentTenantSrc =
      "https://external.test/api/public/email-template-image/99999999-9999-9999-9999-999999999999/email_template_image/alien.webp";
    const differentCategorySrc = `https://external.test/api/public/email-template-image/${TENANT_ID}/course/course.webp`;
    repository.findTemplateBlocks.mockResolvedValue([]);
    fileService.deleteFile.mockResolvedValue(undefined);

    await service.purgeOrphanedImages({
      tenantId: TENANT_ID,
      srcs: [safeSrc, differentTenantSrc, differentCategorySrc],
      excludeTemplateId: TEMPLATE_ID,
    });

    expect(fileService.deleteFile).toHaveBeenCalledTimes(1);
    expect(fileService.deleteFile).toHaveBeenCalledWith(
      `${TENANT_ID}/email_template_image/current.webp`,
    );
  });

  it("keeps a same-tenant image when another template references its canonical key", async () => {
    const { service, repository, fileService } = createService();
    const key = `${TENANT_ID}/email_template_image/current.webp`;
    const craftedSrc = `https://external.test/api/public/email-template-image/${encodeURIComponent(
      key,
    )}`;
    repository.findTemplateBlocks.mockResolvedValue([imageBlocks(craftedSrc)]);
    fileService.deleteFile.mockResolvedValue(undefined);

    await service.purgeOrphanedImages({
      tenantId: TENANT_ID,
      srcs: [craftedSrc],
      excludeTemplateId: TEMPLATE_ID,
    });

    expect(repository.findTemplateBlocks).toHaveBeenCalledWith(TEMPLATE_ID);
    expect(fileService.deleteFile).not.toHaveBeenCalled();
  });
});

describe("EmailNotificationTemplatesService — status transitions", () => {
  it("publishTemplate rejects templates with blocking diagnostics", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(makeTemplate({ subject: { [EN]: "" } }));

    await expect(service.publishTemplate(TEMPLATE_ID)).rejects.toThrow(
      new BadRequestException("emailTemplates.toast.publishBlocked"),
    );
    expect(repository.setStatus).not.toHaveBeenCalled();
  });

  it("publishTemplate allows templates with a button missing its url warning", async () => {
    const { service, repository } = createService();
    const template = makeTemplate({
      blocks: buildDefaultEmailTemplateBlocks(EN),
      availableLocales: [EN],
      strings: {},
    });
    repository.findById.mockResolvedValue(template);
    repository.setStatus.mockResolvedValue({
      ...template,
      status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
    });

    await expect(service.publishTemplate(TEMPLATE_ID)).resolves.toMatchObject({
      status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
    });
    expect(repository.setStatus).toHaveBeenCalledWith(
      TEMPLATE_ID,
      EMAIL_TEMPLATE_STATUSES.PUBLISHED,
      null,
    );
  });

  it("publishTemplate rejects unsafe hrefs introduced by translated strings", async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue(
      makeTemplate({
        strings: {
          [PL]: { [uuid1]: [linkedText("javascript:alert(1)")] },
        },
      }),
    );

    await expect(service.publishTemplate(TEMPLATE_ID)).rejects.toThrow(
      new BadRequestException("emailTemplates.toast.invalidUrl"),
    );
    expect(repository.setStatus).not.toHaveBeenCalled();
  });

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
