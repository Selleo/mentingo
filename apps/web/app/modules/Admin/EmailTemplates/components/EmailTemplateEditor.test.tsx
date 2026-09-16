import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { EmailTemplateEditor } from "./EmailTemplateEditor";

import type { EmailTemplate } from "../emailTemplates.types";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({
  upload: vi.fn(),
  preview: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      emailTemplateControllerPreviewEmailTemplate: api.preview,
      emailTemplateControllerUpdateEmailTemplate: api.save,
      emailTemplateControllerDeleteEmailTemplate: api.delete,
      emailTemplateControllerUploadEmailTemplateImage: api.upload,
    },
  },
}));

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useNavigate: () => api.navigate,
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/modules/Admin/components/UnsavedChangesExitGuard", () => ({
  UnsavedChangesExitGuard: () => null,
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: undefined }),
}));
vi.mock("~/hooks/usePlatformLogo", () => ({ usePlatformLogo: () => ({ data: null }) }));

const template: EmailTemplate = {
  id: "template-id",
  source: "override",
  editable: true,
  event: "welcome",
  status: "draft",
  name: { en: "Welcome", pl: "Powitanie" },
  subject: { en: "Saved subject", pl: "Temat" },
  content: {
    en: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "text",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
        },
      ],
    },
  },
  variables: [],
  baseLanguage: "en",
  availableLocales: ["en", "pl"],
  completeLocales: ["en"],
  createdAt: null,
  updatedAt: null,
  publishedAt: null,
  archivedAt: null,
};

describe("EmailTemplateEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps image settings selected during and after upload", async () => {
    let finishUpload!: (value: unknown) => void;
    api.upload.mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    const imageTemplate: EmailTemplate = {
      ...template,
      content: {
        en: {
          type: "doc",
          version: 1,
          content: [{ type: "image", attrs: { src: "", alt: "Original description" } }],
        },
      },
    };
    renderWith({ withQuery: true }).render(<EmailTemplateEditor template={imageTemplate} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit block Image" }));
    await user.upload(
      screen.getByLabelText("Upload image"),
      new File(["image"], "image.png", { type: "image/png" }),
    );
    expect(screen.getByRole("textbox", { name: "Alternative text" })).toBeDisabled();
    finishUpload({ data: { data: { src: "https://example.com/image.png" } } });
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Alternative text" })).toBeEnabled(),
    );
    expect(screen.getByRole("textbox", { name: "Alternative text" })).toHaveValue(
      "Original description",
    );
    expect(screen.getByRole("button", { name: "1. Image" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("img", { name: "Original description" })).toHaveAttribute(
      "src",
      "https://example.com/image.png",
    );
  });

  it("requires confirmation before deletion and returns to the list on success", async () => {
    api.delete.mockResolvedValue({ data: { data: true } });
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<EmailTemplateEditor template={template} />);
    await user.click(screen.getByRole("button", { name: "Delete template" }));
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete template" }),
    );
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(template.id));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith("/admin/email-templates"));
  });

  it("keeps the editor and confirmation open when deletion fails", async () => {
    api.delete.mockRejectedValue(new Error("Delete failed"));
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<EmailTemplateEditor template={template} />);
    await user.click(screen.getByRole("button", { name: "Delete template" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete template" }),
    );
    await waitFor(() => expect(api.delete).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(api.navigate).not.toHaveBeenCalled();
  });

  it.each([
    { label: "", url: "" },
    { label: "Open course", url: "" },
    { label: "", url: "https://example.com" },
    { label: "  ", url: "  " },
  ])("blocks saving incomplete buttons: %j", async (attrs) => {
    const invalidTemplate: EmailTemplate = {
      ...template,
      content: { en: { type: "doc", version: 1, content: [{ type: "button", attrs }] } },
    };
    renderWith({ withQuery: true }).render(<EmailTemplateEditor template={invalidTemplate} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Subject" }), {
      target: { value: "Changed subject" },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save draft" }));
    expect(
      screen.queryByText("Complete the required button and image fields before continuing."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Enter a button label and URL.")).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("previews inline without saving or requesting a dialog rendering", async () => {
    renderWith({ withQuery: true }).render(<EmailTemplateEditor template={template} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Subject" }), {
      target: { value: "Unsaved subject" },
    });
    const user = userEvent.setup();
    const sidebars = screen.getAllByRole("complementary");
    const preview = screen.getByRole("button", { name: "Preview" });
    await user.click(preview);
    sidebars.forEach((sidebar) => expect(sidebar).toHaveClass("hidden"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.preview).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Subject" })).toHaveValue("Unsaved subject");
    await user.click(preview);
    sidebars.forEach((sidebar) => expect(sidebar).not.toHaveClass("hidden"));
    expect(screen.getByRole("textbox", { name: "Subject" })).toHaveValue("Unsaved subject");
  });

  it("sends only edited locales when saving and accepts the server's merged translations", async () => {
    const save = api.save.mockResolvedValue({
      data: { data: { ...template, subject: { en: "New subject", pl: "Nowy temat" } } },
    });
    renderWith({ withQuery: true }).render(<EmailTemplateEditor template={template} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Subject" }), {
      target: { value: "New subject" },
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("template-id", {
        name: {},
        subject: { en: "New subject" },
        content: {},
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled());
  });
});
