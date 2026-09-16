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
          baseLanguage: "en",
          source: "override",
          status: "draft",
          completeLocales: ["en"],
        },
        {
          id: null,
          event: "welcome",
          name: { en: "Welcome template" },
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
    const defaultRow = screen.getByRole("link", { name: "Welcome template" }).closest("tr")!;
    expect(
      within(defaultRow).queryByRole("button", { name: "Delete template" }),
    ).not.toBeInTheDocument();
    const deleteButton = screen.getByRole("button", { name: "Delete template" });
    await user.click(deleteButton);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(mocks.deleteTemplate).not.toHaveBeenCalled();
    await user.click(deleteButton);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete template" }),
    );
    await waitFor(() => expect(mocks.deleteTemplate).toHaveBeenCalledWith("saved-template"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("shows System badges and repository flags", () => {
    renderWith({ withQuery: true }).render(<EmailTemplatesPage />);
    const row = screen.getByRole("link", { name: "Welcome template" }).closest("tr")!;
    expect(within(row).getByText("System")).toHaveClass("text-neutral-600", "bg-neutral-100");
    expect(within(row).getByRole("link")).toHaveClass("text-neutral-900");
    expect(within(row).getByRole("img")).toHaveAccessibleName();
    expect(within(row).getByRole("button")).toHaveClass("size-10");
  });

  it("opens the template when clicking outside its name link", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<EmailTemplatesPage />);
    await user.click(screen.getByText("System"));
    expect(mocks.navigate).toHaveBeenCalledWith("/admin/email-templates/defaults/welcome");
  });

  it("copies a system template without opening the source row", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<EmailTemplatesPage />);
    const row = screen.getByRole("link", { name: "Welcome template" }).closest("tr")!;
    await user.click(within(row).getByRole("button"));
    expect(mocks.copyDefault).toHaveBeenCalledWith("welcome");
    expect(mocks.navigate).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith("/admin/email-templates/copied-template");
  });
});
