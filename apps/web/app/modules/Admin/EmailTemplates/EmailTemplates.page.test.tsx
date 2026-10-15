import { screen, within, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import EmailTemplatesPage from "./EmailTemplates.page";

import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  deleteTemplate: vi.fn().mockResolvedValue(true),
  copyDefault: vi.fn().mockResolvedValue({ id: "copied-template" }),
}));

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/api/queries/useEmailTemplates", () => ({
  useEmailTemplates: () => ({
    data: {
      data: [
        {
          id: "saved-template",
          event: "welcome",
          name: { en: "Saved template" },
          subject: { en: "Welcome subject" },
          updatedAt: null,
          baseLanguage: "en",
          source: "override",
          status: "draft",
          completeLocales: ["en"],
        },
        {
          id: null,
          event: "welcome",
          name: { en: "Welcome template" },
          subject: { en: "Welcome subject" },
          updatedAt: null,
          baseLanguage: "en",
          source: "default",
          status: null,
          completeLocales: ["en"],
        },
      ],
      pagination: { totalItems: 2 },
    },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("~/api/mutations/emailTemplates/useCopyDefaultEmailTemplate", () => ({
  useCopyDefaultEmailTemplate: () => ({ mutateAsync: mocks.copyDefault, isPending: false }),
}));

vi.mock("~/api/mutations/emailTemplates/useDeleteEmailTemplate", () => ({
  useDeleteEmailTemplate: () => ({ mutateAsync: mocks.deleteTemplate, isPending: false }),
}));

describe("EmailTemplatesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows cancellation and confirms deletion only for saved templates", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<EmailTemplatesPage />);
    const savedRow = screen.getByText("Saved template").closest("tr")!;
    const actions = within(savedRow).getByRole("button", { name: "Actions" });
    await user.click(actions);
    await user.click(screen.getByRole("menuitem", { name: "Delete template" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(mocks.deleteTemplate).not.toHaveBeenCalled();
    await user.click(actions);
    await user.click(screen.getByRole("menuitem", { name: "Delete template" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete template" }),
    );
    await waitFor(() => expect(mocks.deleteTemplate).toHaveBeenCalledWith("saved-template"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("shows the system status, subject, and actions", () => {
    renderWith({ withQuery: true }).render(<EmailTemplatesPage />);
    const row = screen.getByText("Welcome template").closest("tr")!;
    expect(within(row).getByText("System")).toHaveClass("text-neutral-600", "bg-neutral-100");
    expect(within(row).getByText("Welcome subject")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Actions" })).toBeEnabled();
  });

  it("opens the template when clicking its status cell", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<EmailTemplatesPage />);
    await user.click(screen.getByText("System"));
    expect(mocks.navigate).toHaveBeenCalledWith("/admin/email-templates/defaults/welcome");
  });

  it("copies a system template without opening the source row", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<EmailTemplatesPage />);
    const row = screen.getByText("Welcome template").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Actions" }));
    expect(screen.queryByRole("menuitem", { name: "Delete template" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Copy" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledOnce());
    expect(mocks.copyDefault).toHaveBeenCalledWith("welcome");
    expect(mocks.navigate).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith("/admin/email-templates/copied-template");
  });
});
