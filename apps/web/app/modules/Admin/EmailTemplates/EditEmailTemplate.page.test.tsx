import { createRemixStub } from "@remix-run/testing";
import { EMAIL_TEMPLATE_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { screen, waitFor } from "@testing-library/react";
import user from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import EditEmailTemplatePage from "./EditEmailTemplate.page";

import type { GetTemplateResponse } from "~/api/generated-api";

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  duplicate: vi.fn(),
  makeDraft: vi.fn(),
  publish: vi.fn(),
  sendTestEmail: vi.fn(),
  toast: vi.fn(),
  unarchive: vi.fn(),
  update: vi.fn(),
  useEmailTemplate: vi.fn(),
}));

vi.mock("~/api/queries/admin/useEmailTemplate", () => ({
  useEmailTemplate: mocks.useEmailTemplate,
}));

vi.mock("~/api/mutations/admin/useArchiveEmailTemplate", () => ({
  useArchiveEmailTemplate: () => ({ mutate: mocks.archive, isPending: false }),
}));

vi.mock("~/api/mutations/admin/useDuplicateEmailTemplate", () => ({
  useDuplicateEmailTemplate: () => ({ mutateAsync: mocks.duplicate, isPending: false }),
}));

vi.mock("~/api/mutations/admin/useMakeDraftEmailTemplate", () => ({
  useMakeDraftEmailTemplate: () => ({ mutate: mocks.makeDraft, isPending: false }),
}));

vi.mock("~/api/mutations/admin/usePublishEmailTemplate", () => ({
  usePublishEmailTemplate: () => ({ mutate: mocks.publish, isPending: false }),
}));

vi.mock("~/api/mutations/admin/useSendTestEmail", () => ({
  useSendTestEmail: () => ({ mutate: mocks.sendTestEmail, isPending: false }),
}));

vi.mock("~/api/mutations/admin/useUnarchiveEmailTemplate", () => ({
  useUnarchiveEmailTemplate: () => ({ mutate: mocks.unarchive, isPending: false }),
}));

vi.mock("~/api/mutations/admin/useUpdateEmailTemplate", () => ({
  useUpdateEmailTemplate: () => ({ mutateAsync: mocks.update, isPending: false }),
}));

vi.mock("~/components/ui/use-toast", () => ({
  toast: mocks.toast,
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("./components/BuilderCanvas/EmailTemplateEditor", () => ({
  EmailTemplateEditor: () => <div data-testid="mock-email-template-editor">Builder canvas</div>,
}));

vi.mock("./components/SubjectInput/SubjectInput", () => ({
  SubjectInput: ({
    ariaLabel,
    onChange,
    testId,
    value,
  }: {
    ariaLabel?: string;
    onChange: (value: string) => void;
    testId?: string;
    value: string;
  }) => (
    <input
      aria-label={ariaLabel}
      data-testid={testId}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  ),
}));

const RemixStub = createRemixStub([
  {
    path: "/admin/email-templates/:id",
    Component: EditEmailTemplatePage,
  },
]);

const makeTemplate = (overrides: Partial<GetTemplateResponse["data"]> = {}) => ({
  id: overrides.id ?? "template-1",
  createdAt: overrides.createdAt ?? "2026-07-28T10:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-07-28T10:00:00.000Z",
  name: overrides.name ?? "Welcome notification",
  subject: overrides.subject ?? { en: "Welcome" },
  blocks: overrides.blocks ?? {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { uuid: "node-1" },
        content: [{ type: "text", text: "Hello" }],
      },
    ],
  },
  strings: overrides.strings ?? {},
  baseLanguage: overrides.baseLanguage ?? "en",
  availableLocales: overrides.availableLocales ?? ["en"],
  status: overrides.status ?? EMAIL_TEMPLATE_STATUSES.DRAFT,
  archivedAt: overrides.archivedAt ?? null,
});

const renderPage = () =>
  renderWith().render(<RemixStub initialEntries={["/admin/email-templates/template-1"]} />);

describe("EditEmailTemplatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const template = makeTemplate();
    mocks.useEmailTemplate.mockReturnValue({
      data: template,
      isLoading: false,
      isError: false,
    });
    mocks.update.mockResolvedValue({ data: template });
    mocks.duplicate.mockResolvedValue({ data: makeTemplate({ id: "duplicated-template" }) });
  });

  it("renders the builder page and saves changed subject content", async () => {
    const userEvent = user.setup();

    renderPage();

    expect(screen.getByTestId("edit-email-template-page")).toBeInTheDocument();

    await userEvent.clear(screen.getByTestId("edit-email-template-subject-input"));
    await userEvent.type(
      screen.getByTestId("edit-email-template-subject-input"),
      "Updated subject",
    );
    await userEvent.click(screen.getByTestId("edit-email-template-save-button"));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        id: "template-1",
        data: expect.objectContaining({
          name: "Welcome notification",
          subject: { en: "Updated subject" },
          blocks: expect.any(Object),
          strings: {},
          baseLanguage: "en",
          availableLocales: ["en"],
        }),
      });
    });
  });

  it("renames the template when the heading edit is committed", async () => {
    const userEvent = user.setup();

    renderPage();

    await userEvent.click(screen.getByTestId("edit-email-template-name-button"));
    await userEvent.clear(screen.getByTestId("edit-email-template-name-input"));
    await userEvent.type(screen.getByTestId("edit-email-template-name-input"), "Renamed template");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        id: "template-1",
        data: { name: "Renamed template" },
      });
    });
  });

  it("saves dirty form values before sending a test email", async () => {
    const userEvent = user.setup();

    renderPage();

    await userEvent.clear(screen.getByTestId("edit-email-template-subject-input"));
    await userEvent.type(
      screen.getByTestId("edit-email-template-subject-input"),
      "Preview subject",
    );
    await userEvent.click(screen.getByTestId("edit-email-template-send-test-button"));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalled();
      expect(mocks.sendTestEmail).toHaveBeenCalledWith({ id: "template-1", language: "en" });
    });
  });

  it("blocks saving a published template when diagnostics contain errors", async () => {
    const userEvent = user.setup();
    mocks.useEmailTemplate.mockReturnValue({
      data: makeTemplate({
        status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
        subject: {},
        blocks: { type: "doc", content: [] },
      }),
      isLoading: false,
      isError: false,
    });

    renderPage();

    await userEvent.click(screen.getByTestId("edit-email-template-save-button"));

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: expect.stringContaining("Cannot save"),
      }),
    );
  });

  it("archives templates and saves dirty values before status changes", async () => {
    const userEvent = user.setup();

    renderPage();

    await userEvent.clear(screen.getByTestId("edit-email-template-subject-input"));
    await userEvent.type(
      screen.getByTestId("edit-email-template-subject-input"),
      "Ready to archive",
    );
    await userEvent.click(screen.getByTestId("edit-email-template-status-select"));
    await userEvent.click(await screen.findByRole("option", { name: "Archived" }));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        id: "template-1",
        data: expect.objectContaining({
          subject: { en: "Ready to archive" },
        }),
      });
      expect(mocks.archive).toHaveBeenCalledWith("template-1");
    });
  });

  it("unarchives archived templates through the draft status option", async () => {
    const userEvent = user.setup();
    mocks.useEmailTemplate.mockReturnValue({
      data: makeTemplate({ status: EMAIL_TEMPLATE_STATUSES.ARCHIVED }),
      isLoading: false,
      isError: false,
    });

    renderPage();

    await userEvent.click(screen.getByTestId("edit-email-template-status-select"));
    await userEvent.click(await screen.findByRole("option", { name: "Draft" }));

    expect(mocks.unarchive).toHaveBeenCalledWith("template-1");
  });

  it("publishes valid templates and duplicates templates from builder actions", async () => {
    const userEvent = user.setup();

    renderPage();

    await userEvent.click(screen.getByTestId("edit-email-template-status-select"));
    await userEvent.click(await screen.findByRole("option", { name: "Published" }));

    expect(mocks.publish).toHaveBeenCalledWith("template-1");

    await userEvent.click(screen.getByTestId("edit-email-template-duplicate-button"));

    expect(mocks.duplicate).toHaveBeenCalledWith("template-1");
  });

  it("blocks publishing when diagnostics contain errors", async () => {
    const userEvent = user.setup();
    mocks.useEmailTemplate.mockReturnValue({
      data: makeTemplate({
        subject: {},
        blocks: { type: "doc", content: [] },
      }),
      isLoading: false,
      isError: false,
    });

    renderPage();

    await userEvent.click(screen.getByTestId("edit-email-template-status-select"));
    await userEvent.click(await screen.findByRole("option", { name: "Published" }));

    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: expect.stringContaining("Cannot publish"),
      }),
    );
  });

  it("adds a new language and saves subject content for that language", async () => {
    const userEvent = user.setup();

    renderPage();

    await userEvent.click(screen.getByTestId("edit-email-template-language-select"));
    await userEvent.click(
      await screen.findByTestId(`edit-email-template-language-option-${SUPPORTED_LANGUAGES.PL}`),
    );
    await userEvent.click(
      await screen.findByTestId("edit-email-template-language-create-confirm-button"),
    );
    await userEvent.type(screen.getByTestId("edit-email-template-subject-input"), "Witaj");
    await userEvent.click(screen.getByTestId("edit-email-template-save-button"));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        id: "template-1",
        data: expect.objectContaining({
          subject: { en: "Welcome", pl: "Witaj" },
          availableLocales: ["en", "pl"],
          strings: { pl: {} },
        }),
      });
    });
  });

  it("shows load failure when the template query errors", () => {
    mocks.useEmailTemplate.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderPage();

    expect(screen.getByText("Could not load this email template.")).toBeInTheDocument();
  });
});
