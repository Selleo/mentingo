import { EMAIL_TEMPLATE_NODE_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { act, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { renderWith } from "~/utils/testUtils";

vi.mock("~/api/api-client");
vi.mock("@maily-to/core", () => ({
  Editor: vi.fn(
    ({ extensions, onUpdate }: { extensions: unknown[]; onUpdate?: (editor: unknown) => void }) => {
      (globalThis as Record<string, unknown>).__capturedExtensions = extensions;
      (globalThis as Record<string, unknown>).__capturedOnUpdate = onUpdate;
      return null;
    },
  ),
}));
vi.mock("~/modules/Admin/EmailTemplates/tiptap/maily-styles", () => ({
  useMailyEditorStyles: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock("~/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

import { EmailTemplateEditor } from "./EmailTemplateEditor";

import type { EmailTemplateBlocks, EmailTemplateStrings } from "@repo/shared";

const emptyContent: EmailTemplateBlocks = { type: EMAIL_TEMPLATE_NODE_TYPES.DOC, content: [] };
const emptyStrings: EmailTemplateStrings = {};

const makeAxiosError = (status: number, message: string): AxiosError =>
  Object.assign(new AxiosError("request failed"), {
    response: { status, data: { message }, headers: {}, config: {}, statusText: "" },
  }) as AxiosError;

const captureOnImageUpload = () => {
  renderWith({ withQuery: true }).render(
    <EmailTemplateEditor
      blocks={emptyContent}
      strings={emptyStrings}
      language={SUPPORTED_LANGUAGES.EN}
      baseLanguage={SUPPORTED_LANGUAGES.EN}
      onBlocksChange={vi.fn()}
      onStringsChange={vi.fn()}
    />,
  );
  const extensions: Array<{ options?: Record<string, unknown> }> = (
    globalThis as Record<string, unknown>
  ).__capturedExtensions as never;
  const imageUploadExt = extensions?.find((ext) => ext?.options && "onImageUpload" in ext.options);
  const onImageUpload = imageUploadExt?.options?.onImageUpload as
    ((file: Blob) => Promise<string>) | undefined;
  if (!onImageUpload) throw new Error("onImageUpload handler not found on ImageUploadExtension");
  return onImageUpload;
};

describe("EmailTemplateEditor — upload handler", () => {
  it("calls emailTemplateImageControllerUpload and returns the proxied URL", async () => {
    const proxiedUrl = "https://tenant.local/api/public/email-template-image/encoded-key";
    const mockedUpload = vi.fn().mockResolvedValue({
      data: { data: { url: proxiedUrl } },
    });
    (ApiClient.api as Record<string, unknown>).emailTemplateImageControllerUpload = mockedUpload;

    const onImageUpload = captureOnImageUpload();
    const fakeFile = new Blob(["fake-image"], { type: "image/png" });
    let result: string | undefined;

    await act(async () => {
      result = await onImageUpload(fakeFile);
    });

    await waitFor(() => {
      expect(mockedUpload).toHaveBeenCalledTimes(1);
    });
    expect(result).toBe(proxiedUrl);
  });

  it("throws and shows a toast when the upload fails", async () => {
    const uploadError = new Error("Network error");
    const mockedUpload = vi.fn().mockRejectedValue(uploadError);
    (ApiClient.api as Record<string, unknown>).emailTemplateImageControllerUpload = mockedUpload;

    const onImageUpload = captureOnImageUpload();
    const fakeFile = new Blob(["fake-image"], { type: "image/png" });

    await expect(
      act(async () => {
        await onImageUpload(fakeFile);
      }),
    ).rejects.toThrow("Network error");
  });

  it("shows the tooLarge toast on 413 status", async () => {
    const mockedUpload = vi.fn().mockRejectedValue(makeAxiosError(413, "Payload Too Large"));
    (ApiClient.api as Record<string, unknown>).emailTemplateImageControllerUpload = mockedUpload;

    const onImageUpload = captureOnImageUpload();
    const fakeFile = new Blob(["fake-image"], { type: "image/png" });

    await expect(
      act(async () => {
        await onImageUpload(fakeFile);
      }),
    ).rejects.toThrow();

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("too large") }),
    );
  });

  it("shows the tooLarge toast on 400 with expected size message", async () => {
    const mockedUpload = vi
      .fn()
      .mockRejectedValue(
        makeAxiosError(400, "Validation failed (expected size is less than 10485760)"),
      );
    (ApiClient.api as Record<string, unknown>).emailTemplateImageControllerUpload = mockedUpload;

    const onImageUpload = captureOnImageUpload();
    const fakeFile = new Blob(["fake-image"], { type: "image/png" });

    await expect(
      act(async () => {
        await onImageUpload(fakeFile);
      }),
    ).rejects.toThrow();

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("too large") }),
    );
  });

  it("shows the invalidType toast on 400 with files.toast.invalidFileType message", async () => {
    const mockedUpload = vi
      .fn()
      .mockRejectedValue(makeAxiosError(400, "files.toast.invalidFileType"));
    (ApiClient.api as Record<string, unknown>).emailTemplateImageControllerUpload = mockedUpload;

    const onImageUpload = captureOnImageUpload();
    const fakeFile = new Blob(["fake-image"], { type: "application/pdf" });

    await expect(
      act(async () => {
        await onImageUpload(fakeFile);
      }),
    ).rejects.toThrow();

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("Invalid image type") }),
    );
  });
});

const uuid1 = "aaaaaaaa-0000-4000-8000-000000000001";

const paraNode = (uuid: string, text: string): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
  attrs: { uuid },
  content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text }],
});

const docNode = (...children: EmailTemplateBlocks[]): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: children,
});

const makeEditorStub = (json: EmailTemplateBlocks) =>
  ({ getJSON: () => json }) as unknown as import("@tiptap/core").Editor;

const captureOnUpdate = (props: {
  language: (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];
  baseLanguage: (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  onBlocksChange: ReturnType<typeof vi.fn>;
  onStringsChange: ReturnType<typeof vi.fn>;
}) => {
  renderWith({ withQuery: true }).render(<EmailTemplateEditor {...props} />);
  const onUpdate = (globalThis as Record<string, unknown>).__capturedOnUpdate as
    ((editor: unknown) => void) | undefined;
  if (!onUpdate) throw new Error("onUpdate handler not captured from MailyEditor");
  return onUpdate;
};

describe("EmailTemplateEditor — translation mode wiring", () => {
  it("routes edits to onBlocksChange when language equals baseLanguage", () => {
    const onBlocksChange = vi.fn();
    const onStringsChange = vi.fn();
    const blocks = docNode(paraNode(uuid1, "hello"));

    const onUpdate = captureOnUpdate({
      language: SUPPORTED_LANGUAGES.EN,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      blocks,
      strings: emptyStrings,
      onBlocksChange,
      onStringsChange,
    });

    const newDoc = docNode(paraNode(uuid1, "updated"));
    act(() => onUpdate(makeEditorStub(newDoc)));

    expect(onBlocksChange).toHaveBeenCalledTimes(1);
  });

  it("does not call onStringsChange when language equals baseLanguage", () => {
    const onBlocksChange = vi.fn();
    const onStringsChange = vi.fn();
    const blocks = docNode(paraNode(uuid1, "hello"));

    const onUpdate = captureOnUpdate({
      language: SUPPORTED_LANGUAGES.EN,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      blocks,
      strings: emptyStrings,
      onBlocksChange,
      onStringsChange,
    });

    const newDoc = docNode(paraNode(uuid1, "updated"));
    act(() => onUpdate(makeEditorStub(newDoc)));

    expect(onStringsChange).not.toHaveBeenCalled();
  });

  it("calls onStringsChange with extracted strings when in translation mode", () => {
    const onBlocksChange = vi.fn();
    const onStringsChange = vi.fn();
    const blocks = docNode(paraNode(uuid1, "base text"));

    const onUpdate = captureOnUpdate({
      language: SUPPORTED_LANGUAGES.PL,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      blocks,
      strings: emptyStrings,
      onBlocksChange,
      onStringsChange,
    });

    const translatedDoc = docNode(paraNode(uuid1, "Polish text"));
    act(() => onUpdate(makeEditorStub(translatedDoc)));

    expect(onStringsChange).toHaveBeenCalledTimes(1);
    const stringsArg = onStringsChange.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(stringsArg[uuid1]).toBeDefined();
  });

  it("also calls onBlocksChange in translation mode to propagate structural changes", () => {
    const onBlocksChange = vi.fn();
    const onStringsChange = vi.fn();
    const blocks = docNode(paraNode(uuid1, "base text"));

    const onUpdate = captureOnUpdate({
      language: SUPPORTED_LANGUAGES.PL,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      blocks,
      strings: emptyStrings,
      onBlocksChange,
      onStringsChange,
    });

    const translatedDoc = docNode(paraNode(uuid1, "translated"));
    act(() => onUpdate(makeEditorStub(translatedDoc)));

    expect(onBlocksChange).toHaveBeenCalledTimes(1);
  });

  it("restores base content via applyStructuralChangesToBase when in translation mode", () => {
    const onBlocksChange = vi.fn();
    const onStringsChange = vi.fn();
    const baseText = "original base text";
    const blocks = docNode(paraNode(uuid1, baseText));

    const onUpdate = captureOnUpdate({
      language: SUPPORTED_LANGUAGES.PL,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      blocks,
      strings: emptyStrings,
      onBlocksChange,
      onStringsChange,
    });

    const translatedDoc = docNode(paraNode(uuid1, "Polish text"));
    act(() => onUpdate(makeEditorStub(translatedDoc)));

    const blocksArg = onBlocksChange.mock.calls[0]?.[0] as EmailTemplateBlocks;
    const firstChild = blocksArg?.content?.[0];
    const firstText = firstChild?.content?.[0]?.text;
    expect(firstText).toBe(baseText);
  });
});
