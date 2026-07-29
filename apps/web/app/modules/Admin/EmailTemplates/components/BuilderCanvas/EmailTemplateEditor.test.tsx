import { EMAIL_TEMPLATE_NODE_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { renderWith } from "~/utils/testUtils";

vi.mock("~/api/api-client");
vi.mock("@maily-to/core", () => ({
  Editor: vi.fn(
    ({ extensions, onUpdate }: { extensions: unknown[]; onUpdate?: (editor: unknown) => void }) => {
      (globalThis as Record<string, unknown>).__capturedExtensions = extensions;
      (globalThis as Record<string, unknown>).__capturedOnUpdate = onUpdate;
      const renderedUuids = ((globalThis as Record<string, unknown>).__mailyRenderedUuids ?? [
        "aaaaaaaa-0000-4000-8000-000000000001",
      ]) as string[];
      return (
        <>
          {renderedUuids.map((uuid, index) => (
            <div key={uuid} contentEditable data-uuid={uuid} suppressContentEditableWarning>
              {index === 0 ? "Base text" : "New text"}
            </div>
          ))}
        </>
      );
    },
  ),
}));
vi.mock("~/modules/Admin/EmailTemplates/tiptap/maily-styles", () => ({
  useMailyEditorStyles: vi.fn(),
}));
vi.mock("~/hooks/usePlatformLogo", () => ({
  usePlatformLogo: () => ({
    data: "https://tenant.example.com/logo.png",
    isFetched: true,
  }),
}));

const mockToast = vi.fn();
vi.mock("~/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

import {
  EmailTemplateEditor,
  buildInlineDiagnosticSpacingCss,
  measureInlineDiagnosticAnchors,
} from "./EmailTemplateEditor";

import type {
  EmailTemplateBlocks,
  EmailTemplateDiagnostic,
  EmailTemplateStrings,
} from "@repo/shared";

const emptyContent: EmailTemplateBlocks = { type: EMAIL_TEMPLATE_NODE_TYPES.DOC, content: [] };
const emptyStrings: EmailTemplateStrings = {};

beforeEach(() => {
  (globalThis as Record<string, unknown>).__mailyRenderedUuids = [uuid1];
});

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
    | ((file: Blob) => Promise<string>)
    | undefined;
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
    | ((editor: unknown) => void)
    | undefined;
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

describe("EmailTemplateEditor — inline diagnostics", () => {
  it("renders inline diagnostics on initial editor render without waiting for user edits", async () => {
    const diagnostic: EmailTemplateDiagnostic = {
      severity: "warning",
      reason: "empty_translation",
      nodeUuid: uuid1,
    };

    renderWith({ withQuery: true }).render(
      <EmailTemplateEditor
        blocks={docNode(paraNode(uuid1, "Base text"))}
        strings={emptyStrings}
        language={SUPPORTED_LANGUAGES.EN}
        baseLanguage={SUPPORTED_LANGUAGES.EN}
        onBlocksChange={vi.fn()}
        onStringsChange={vi.fn()}
        diagnosticsByNodeUuid={new Map([[uuid1, [diagnostic]]])}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Translation is empty")).toBeInTheDocument();
    });
  });

  it("keeps existing empty translation diagnostics visible when their node is focused", async () => {
    const diagnostic: EmailTemplateDiagnostic = {
      severity: "warning",
      reason: "empty_translation",
      nodeUuid: uuid1,
    };

    renderWith({ withQuery: true }).render(
      <>
        <button type="button">Outside editor</button>
        <EmailTemplateEditor
          blocks={docNode(paraNode(uuid1, "Base text"))}
          strings={emptyStrings}
          language={SUPPORTED_LANGUAGES.EN}
          baseLanguage={SUPPORTED_LANGUAGES.EN}
          onBlocksChange={vi.fn()}
          onStringsChange={vi.fn()}
          diagnosticsByNodeUuid={new Map([[uuid1, [diagnostic]]])}
        />
      </>,
    );

    const node = screen.getByText("Base text");
    node.focus();
    fireEvent.focusIn(node);

    await waitFor(() => {
      expect(screen.getByText("Translation is empty")).toBeInTheDocument();
    });
  });

  it("defers empty translation diagnostics for a newly created node until the user leaves it", async () => {
    const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";
    const diagnostic: EmailTemplateDiagnostic = {
      severity: "warning",
      reason: "empty_translation",
      nodeUuid: uuid2,
    };
    const onBlocksChange = vi.fn();

    const { rerender } = renderWith({ withQuery: true }).render(
      <>
        <button type="button">Outside editor</button>
        <EmailTemplateEditor
          blocks={docNode(paraNode(uuid1, "Base text"))}
          strings={emptyStrings}
          language={SUPPORTED_LANGUAGES.EN}
          baseLanguage={SUPPORTED_LANGUAGES.EN}
          onBlocksChange={onBlocksChange}
          onStringsChange={vi.fn()}
          diagnosticsByNodeUuid={new Map()}
        />
      </>,
    );

    const onUpdate = (globalThis as Record<string, unknown>).__capturedOnUpdate as
      | ((editor: unknown) => void)
      | undefined;
    if (!onUpdate) throw new Error("onUpdate handler not captured from MailyEditor");

    act(() => {
      onUpdate(makeEditorStub(docNode(paraNode(uuid1, "Base text"), paraNode(uuid2, ""))));
    });
    (globalThis as Record<string, unknown>).__mailyRenderedUuids = [uuid1, uuid2];

    rerender(
      <>
        <button type="button">Outside editor</button>
        <EmailTemplateEditor
          blocks={docNode(paraNode(uuid1, "Base text"), paraNode(uuid2, ""))}
          strings={emptyStrings}
          language={SUPPORTED_LANGUAGES.EN}
          baseLanguage={SUPPORTED_LANGUAGES.EN}
          onBlocksChange={onBlocksChange}
          onStringsChange={vi.fn()}
          diagnosticsByNodeUuid={new Map([[uuid2, [diagnostic]]])}
        />
      </>,
    );

    expect(screen.queryByText("Translation is empty")).not.toBeInTheDocument();

    const node = screen.getByText("New text");
    node.focus();
    fireEvent.focusIn(node);

    await waitFor(() => {
      expect(screen.queryByText("Translation is empty")).not.toBeInTheDocument();
    });

    const outsideButton = screen.getByRole("button", { name: "Outside editor" });
    outsideButton.focus();
    fireEvent.focusOut(node);

    await waitFor(() => {
      expect(screen.getByText("Translation is empty")).toBeInTheDocument();
    });
  });

  it("shows diagnostics for untouched siblings when multiple nodes are created", async () => {
    const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";
    const uuid3 = "aaaaaaaa-0000-4000-8000-000000000003";
    const diagnosticsByNodeUuid = new Map<string, EmailTemplateDiagnostic[]>([
      [
        uuid2,
        [
          {
            severity: "warning",
            reason: "empty_translation",
            nodeUuid: uuid2,
          },
        ],
      ],
      [
        uuid3,
        [
          {
            severity: "warning",
            reason: "empty_translation",
            nodeUuid: uuid3,
          },
        ],
      ],
    ]);
    const onBlocksChange = vi.fn();

    const { rerender } = renderWith({ withQuery: true }).render(
      <EmailTemplateEditor
        blocks={docNode(paraNode(uuid1, "Base text"))}
        strings={emptyStrings}
        language={SUPPORTED_LANGUAGES.EN}
        baseLanguage={SUPPORTED_LANGUAGES.EN}
        onBlocksChange={onBlocksChange}
        onStringsChange={vi.fn()}
        diagnosticsByNodeUuid={new Map()}
      />,
    );

    const onUpdate = (globalThis as Record<string, unknown>).__capturedOnUpdate as
      | ((editor: unknown) => void)
      | undefined;
    if (!onUpdate) throw new Error("onUpdate handler not captured from MailyEditor");

    act(() => {
      onUpdate(
        makeEditorStub(
          docNode(paraNode(uuid1, "Base text"), paraNode(uuid2, ""), paraNode(uuid3, "")),
        ),
      );
    });
    (globalThis as Record<string, unknown>).__mailyRenderedUuids = [uuid1, uuid2, uuid3];

    rerender(
      <EmailTemplateEditor
        blocks={docNode(paraNode(uuid1, "Base text"), paraNode(uuid2, ""), paraNode(uuid3, ""))}
        strings={emptyStrings}
        language={SUPPORTED_LANGUAGES.EN}
        baseLanguage={SUPPORTED_LANGUAGES.EN}
        onBlocksChange={onBlocksChange}
        onStringsChange={vi.fn()}
        diagnosticsByNodeUuid={diagnosticsByNodeUuid}
      />,
    );

    const activeNewNode = document.querySelector(`[data-uuid="${uuid2}"]`);
    if (!(activeNewNode instanceof HTMLElement)) throw new Error("New node not rendered");
    activeNewNode.focus();
    fireEvent.focusIn(activeNewNode);

    await waitFor(() => {
      expect(screen.getAllByText("Translation is empty")).toHaveLength(1);
    });
  });

  it("shows diagnostics for a programmatically created node when focus never enters it", async () => {
    const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";
    const diagnostic: EmailTemplateDiagnostic = {
      severity: "warning",
      reason: "empty_translation",
      nodeUuid: uuid2,
    };
    const onBlocksChange = vi.fn();

    const { rerender } = renderWith({ withQuery: true }).render(
      <EmailTemplateEditor
        blocks={docNode(paraNode(uuid1, "Base text"))}
        strings={emptyStrings}
        language={SUPPORTED_LANGUAGES.EN}
        baseLanguage={SUPPORTED_LANGUAGES.EN}
        onBlocksChange={onBlocksChange}
        onStringsChange={vi.fn()}
        diagnosticsByNodeUuid={new Map()}
      />,
    );

    const onUpdate = (globalThis as Record<string, unknown>).__capturedOnUpdate as
      | ((editor: unknown) => void)
      | undefined;
    if (!onUpdate) throw new Error("onUpdate handler not captured from MailyEditor");

    act(() => {
      onUpdate(makeEditorStub(docNode(paraNode(uuid1, "Base text"), paraNode(uuid2, ""))));
    });
    (globalThis as Record<string, unknown>).__mailyRenderedUuids = [uuid1, uuid2];

    rerender(
      <EmailTemplateEditor
        blocks={docNode(paraNode(uuid1, "Base text"), paraNode(uuid2, ""))}
        strings={emptyStrings}
        language={SUPPORTED_LANGUAGES.EN}
        baseLanguage={SUPPORTED_LANGUAGES.EN}
        onBlocksChange={onBlocksChange}
        onStringsChange={vi.fn()}
        diagnosticsByNodeUuid={new Map([[uuid2, [diagnostic]]])}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Translation is empty")).toBeInTheDocument();
    });
  });
});

describe("measureInlineDiagnosticAnchors", () => {
  it("creates an anchor for a matching data-uuid node", () => {
    const root = document.createElement("div");
    const node = document.createElement("p");
    node.dataset.uuid = uuid1;
    root.appendChild(node);
    const diagnostic: EmailTemplateDiagnostic = {
      severity: "warning",
      reason: "empty_translation",
      nodeUuid: uuid1,
    };

    root.getBoundingClientRect = vi.fn(() => ({
      bottom: 100,
      height: 100,
      left: 10,
      right: 110,
      top: 0,
      width: 100,
      x: 10,
      y: 0,
      toJSON: vi.fn(),
    }));
    node.getBoundingClientRect = vi.fn(() => ({
      bottom: 40,
      height: 20,
      left: 20,
      right: 80,
      top: 20,
      width: 60,
      x: 20,
      y: 20,
      toJSON: vi.fn(),
    }));

    const anchors = measureInlineDiagnosticAnchors(root, new Map([[uuid1, [diagnostic]]]));

    expect(anchors).toEqual([
      expect.objectContaining({
        uuid: uuid1,
        diagnostics: [diagnostic],
        top: 41,
        left: 10,
        width: 60,
        height: 24,
      }),
    ]);
  });

  it("does not create an anchor when a node is no longer targetable", () => {
    const root = document.createElement("div");

    const anchors = measureInlineDiagnosticAnchors(root, new Map([[uuid1, []]]));

    expect(anchors).toEqual([]);
  });

  it("moves later anchors down when diagnostic notes would overlap", () => {
    const root = document.createElement("div");
    const firstNode = document.createElement("p");
    const secondNode = document.createElement("p");
    const uuid2 = "aaaaaaaa-0000-4000-8000-000000000002";
    firstNode.dataset.uuid = uuid1;
    secondNode.dataset.uuid = uuid2;
    root.append(firstNode, secondNode);

    root.getBoundingClientRect = vi.fn(() => ({
      bottom: 200,
      height: 200,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
    firstNode.getBoundingClientRect = vi.fn(() => ({
      bottom: 40,
      height: 20,
      left: 0,
      right: 100,
      top: 20,
      width: 100,
      x: 0,
      y: 20,
      toJSON: vi.fn(),
    }));
    secondNode.getBoundingClientRect = vi.fn(() => ({
      bottom: 52,
      height: 8,
      left: 0,
      right: 100,
      top: 44,
      width: 100,
      x: 0,
      y: 44,
      toJSON: vi.fn(),
    }));

    const anchors = measureInlineDiagnosticAnchors(
      root,
      new Map([
        [
          uuid1,
          [
            {
              severity: "warning",
              reason: "empty_translation",
              nodeUuid: uuid1,
            },
          ],
        ],
        [
          uuid2,
          [
            {
              severity: "warning",
              reason: "empty_translation",
              nodeUuid: uuid2,
            },
          ],
        ],
      ]),
    );

    expect(anchors[0].top).toBe(41);
    expect(anchors[1].top).toBe(69);
  });

  it("uses rendered note height when reserving space", () => {
    const root = document.createElement("div");
    const node = document.createElement("p");
    const note = document.createElement("div");
    node.dataset.uuid = uuid1;
    note.dataset.inlineDiagnosticAnchor = uuid1;
    root.append(node, note);
    const diagnostic: EmailTemplateDiagnostic = {
      severity: "warning",
      reason: "empty_translation",
      nodeUuid: uuid1,
    };

    root.getBoundingClientRect = vi.fn(() => ({
      bottom: 140,
      height: 140,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
    node.getBoundingClientRect = vi.fn(() => ({
      bottom: 40,
      height: 20,
      left: 0,
      right: 100,
      top: 20,
      width: 100,
      x: 0,
      y: 20,
      toJSON: vi.fn(),
    }));
    note.getBoundingClientRect = vi.fn(() => ({
      bottom: 88,
      height: 47,
      left: 0,
      right: 100,
      top: 41,
      width: 100,
      x: 0,
      y: 41,
      toJSON: vi.fn(),
    }));

    const anchors = measureInlineDiagnosticAnchors(root, new Map([[uuid1, [diagnostic]]]));

    expect(anchors[0].height).toBe(47);
  });

  it("keeps diagnostic note width inside the editor canvas", () => {
    const root = document.createElement("div");
    const node = document.createElement("p");
    node.dataset.uuid = uuid1;
    root.appendChild(node);
    const diagnostic: EmailTemplateDiagnostic = {
      severity: "warning",
      reason: "empty_translation",
      nodeUuid: uuid1,
    };

    root.getBoundingClientRect = vi.fn(() => ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
    node.getBoundingClientRect = vi.fn(() => ({
      bottom: 40,
      height: 20,
      left: 80,
      right: 160,
      top: 20,
      width: 80,
      x: 80,
      y: 20,
      toJSON: vi.fn(),
    }));

    const anchors = measureInlineDiagnosticAnchors(root, new Map([[uuid1, [diagnostic]]]));

    expect(anchors[0].left + anchors[0].width).toBeLessThanOrEqual(96);
  });

  it("builds scoped CSS that reserves space under nodes with diagnostic notes", () => {
    const css = buildInlineDiagnosticSpacingCss([
      {
        uuid: uuid1,
        diagnostics: [
          {
            severity: "warning",
            reason: "empty_translation",
            nodeUuid: uuid1,
          },
        ],
        top: 48,
        left: 0,
        width: 240,
        height: 24,
      },
    ]);

    expect(css).toBe(`[data-uuid="${uuid1}"]{margin-bottom:44px!important;}`);
  });
});
