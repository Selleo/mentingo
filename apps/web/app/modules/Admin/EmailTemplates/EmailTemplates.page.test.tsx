import { createRemixStub } from "@remix-run/testing";
import { EMAIL_TEMPLATE_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { screen, waitFor } from "@testing-library/react";
import user from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import EmailTemplatesPage from "./EmailTemplates.page";

import type { ListTemplatesResponse } from "~/api/generated-api";

const mocks = vi.hoisted(() => ({
  createEmailTemplate: vi.fn(),
  deleteEmailTemplate: vi.fn(),
  deleteManyEmailTemplates: vi.fn(),
  useAllEmailTemplates: vi.fn(),
}));

vi.mock("~/api/queries/admin/useAllEmailTemplates", () => ({
  useAllEmailTemplates: mocks.useAllEmailTemplates,
}));

vi.mock("~/api/mutations/admin/useCreateEmailTemplate", () => ({
  useCreateEmailTemplate: () => ({
    mutateAsync: mocks.createEmailTemplate,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useDeleteEmailTemplate", () => ({
  useDeleteEmailTemplate: () => ({
    mutate: mocks.deleteEmailTemplate,
  }),
}));

vi.mock("~/api/mutations/admin/useDeleteManyEmailTemplates", () => ({
  useDeleteManyEmailTemplates: () => ({
    mutate: mocks.deleteManyEmailTemplates,
  }),
}));

vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: (selector: (state: { language: "en" }) => unknown) =>
    selector({ language: SUPPORTED_LANGUAGES.EN }),
}));

const RemixStub = createRemixStub([
  {
    path: "/",
    Component: EmailTemplatesPage,
  },
  {
    path: "/admin/email-templates/:id",
    Component: () => <div data-testid="email-template-builder-route" />,
  },
]);

const makeTemplate = (
  overrides: Partial<ListTemplatesResponse["data"][number]> = {},
): ListTemplatesResponse["data"][number] => ({
  id: overrides.id ?? "template-1",
  createdAt: overrides.createdAt ?? "2026-07-28T10:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-07-28T10:00:00.000Z",
  name: overrides.name ?? "Welcome notification",
  subject: overrides.subject ?? { en: "Welcome" },
  blocks: overrides.blocks ?? { type: "doc", content: [] },
  strings: overrides.strings ?? {},
  baseLanguage: overrides.baseLanguage ?? "en",
  availableLocales: overrides.availableLocales ?? ["en"],
  status: overrides.status ?? EMAIL_TEMPLATE_STATUSES.DRAFT,
  archivedAt: overrides.archivedAt ?? null,
});

const makeListResponse = (
  templates: ListTemplatesResponse["data"],
  pagination: Partial<ListTemplatesResponse["pagination"]> = {},
): ListTemplatesResponse => ({
  data: templates,
  pagination: {
    totalItems: pagination.totalItems ?? templates.length,
    page: pagination.page ?? 1,
    perPage: pagination.perPage ?? 20,
  },
});

const renderPage = () => renderWith().render(<RemixStub />);

describe("EmailTemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAllEmailTemplates.mockReturnValue({
      data: makeListResponse([makeTemplate()]),
      isLoading: false,
      isError: false,
    });
    mocks.createEmailTemplate.mockResolvedValue({ data: makeTemplate({ id: "created-template" }) });
  });

  it("renders the template list and opens a row in the builder", async () => {
    const userEvent = user.setup();

    renderPage();

    expect(screen.getByRole("heading", { name: "Email templates" })).toBeInTheDocument();
    expect(screen.getByText("Welcome notification")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("email-templates-row-template-1"));

    expect(await screen.findByTestId("email-template-builder-route")).toBeInTheDocument();
  });

  it("creates a new template using the current UI language and navigates to it", async () => {
    const userEvent = user.setup();

    renderPage();

    await userEvent.click(screen.getByTestId("email-templates-create-button"));

    await waitFor(() => {
      expect(mocks.createEmailTemplate).toHaveBeenCalledWith({
        data: {
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          availableLocales: [SUPPORTED_LANGUAGES.EN],
        },
      });
    });
    expect(await screen.findByTestId("email-template-builder-route")).toBeInTheDocument();
  });

  it("deletes a selected template through the confirmation dialog", async () => {
    const userEvent = user.setup();

    renderPage();

    await userEvent.click(screen.getByTestId("email-templates-row-checkbox-template-1"));
    await userEvent.click(screen.getByTestId("email-templates-delete-selected-button"));
    await userEvent.click(await screen.findByTestId("email-templates-delete-confirm-button"));

    expect(mocks.deleteEmailTemplate).toHaveBeenCalledWith(
      "template-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mocks.deleteManyEmailTemplates).not.toHaveBeenCalled();
  });

  it("bulk deletes multiple selected templates through the confirmation dialog", async () => {
    const userEvent = user.setup();
    mocks.useAllEmailTemplates.mockReturnValue({
      data: makeListResponse([
        makeTemplate({ id: "template-1", name: "Welcome notification" }),
        makeTemplate({ id: "template-2", name: "Reminder notification" }),
      ]),
      isLoading: false,
      isError: false,
    });

    renderPage();

    await userEvent.click(screen.getByTestId("email-templates-row-checkbox-template-1"));
    await userEvent.click(screen.getByTestId("email-templates-row-checkbox-template-2"));
    await userEvent.click(screen.getByTestId("email-templates-delete-selected-button"));
    await userEvent.click(await screen.findByTestId("email-templates-delete-confirm-button"));

    expect(mocks.deleteManyEmailTemplates).toHaveBeenCalledWith(
      ["template-1", "template-2"],
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mocks.deleteEmailTemplate).not.toHaveBeenCalled();
  });

  it("updates query params when filters and pagination controls change", async () => {
    const userEvent = user.setup();
    mocks.useAllEmailTemplates.mockReturnValue({
      data: makeListResponse([makeTemplate()], { totalItems: 45, page: 1, perPage: 20 }),
      isLoading: false,
      isError: false,
    });

    renderPage();

    await userEvent.click(screen.getByTestId("email-templates-pagination-next"));

    await waitFor(() => {
      expect(mocks.useAllEmailTemplates).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, perPage: 20 }),
      );
    });

    await userEvent.type(screen.getByTestId("email-templates-name-filter"), "Quarterly");

    await waitFor(
      () => {
        expect(mocks.useAllEmailTemplates).toHaveBeenLastCalledWith(
          expect.objectContaining({ name: "Quarterly", page: 1, perPage: 20 }),
        );
      },
      { timeout: 1000 },
    );

    await waitFor(() => {
      expect(screen.getByTestId("email-templates-status-filter")).not.toBeDisabled();
    });
    await userEvent.click(screen.getByTestId("email-templates-status-filter"));
    await userEvent.click(
      await screen.findByTestId(
        `email-templates-status-filter-option-${EMAIL_TEMPLATE_STATUSES.PUBLISHED}`,
      ),
    );

    await waitFor(() => {
      expect(mocks.useAllEmailTemplates).toHaveBeenLastCalledWith(
        expect.objectContaining({
          name: "Quarterly",
          status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
          page: 1,
          perPage: 20,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("email-templates-pagination-items-per-page")).not.toBeDisabled();
    });
    await userEvent.click(screen.getByTestId("email-templates-pagination-items-per-page"));
    await userEvent.click(
      await screen.findByTestId("email-templates-pagination-items-per-page-option-50"),
    );

    await waitFor(() => {
      expect(mocks.useAllEmailTemplates).toHaveBeenLastCalledWith(
        expect.objectContaining({
          name: "Quarterly",
          status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
          page: 1,
          perPage: 50,
        }),
      );
    });
  });

  it("shows loading, error, and empty states from the templates query", () => {
    mocks.useAllEmailTemplates.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    const { unmount } = renderPage();
    expect(screen.getByText("Loading templates...")).toBeInTheDocument();
    unmount();

    mocks.useAllEmailTemplates.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    const errorRender = renderPage();
    expect(screen.getByText("Could not load email templates.")).toBeInTheDocument();
    errorRender.unmount();

    mocks.useAllEmailTemplates.mockReturnValueOnce({
      data: makeListResponse([]),
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText("No email templates yet.")).toBeInTheDocument();
  });
});
