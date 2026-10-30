import { ENTITY_TYPES } from "@repo/shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import i18n from "i18n";
import { insertResourceIntoEditor } from "~/components/RichText/utils/insertResourceIntoEditor";
import { buildRichTextFileUploadHandler } from "~/hooks/buildRichTextFileUploadHandler";

import { contentViewerPlugins, getContentEditorPlugins } from "../plugins";

const src = "/api/lesson/lesson-resource/11111111-1111-4111-8111-111111111111";

describe("rich text audio", () => {
  it.each([ENTITY_TYPES.ARTICLES, ENTITY_TYPES.NEWS])(
    "does not insert a lesson audio asset into %s content",
    (entityType) => {
      const editor = new Editor({
        editorProps: { handleScrollToSelection: () => true },
        extensions: getContentEditorPlugins(),
        content: "<p>Unchanged</p>",
      });
      const before = editor.getJSON();
      insertResourceIntoEditor({
        editor,
        entityType,
        resourceId: "11111111-1111-4111-8111-111111111111",
        file: { name: "Interview.mp3" },
        resourceType: "audio",
      });
      expect(editor.getJSON()).toEqual(before);
      editor.destroy();
    },
  );
  it("inserts a successful resource upload as a stable playable node, never a download link", async () => {
    const editor = new Editor({
      editorProps: { handleScrollToSelection: () => true },
      extensions: getContentEditorPlugins(),
      content: "<p>Intro</p>",
    });
    const handler = buildRichTextFileUploadHandler({
      entityType: ENTITY_TYPES.LESSON,
      getVideoSessionForFile: vi.fn(),
      uploadVideo: vi.fn(),
      uploadResourceFile: vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111"),
      askForDisplayMode: vi.fn(),
      onVideoUploadError: vi.fn(),
      fallbackUploadErrorMessage: "Failed",
    });
    await handler(new File(["audio"], "Interview.mp3", { type: "audio/mpeg" }), editor);
    expect(editor.getJSON().content?.find((node) => node.type === "audio")?.attrs).toMatchObject({
      name: "Interview.mp3",
      src: expect.stringContaining(src),
    });
    expect(editor.getHTML()).toContain("<audio");
    expect(editor.getHTML()).not.toContain("<a ");
    editor.destroy();
  });
  it("removes only the selected audio node in mixed content using current document positions", async () => {
    const editor = new Editor({
      editorProps: { handleScrollToSelection: () => true },
      extensions: getContentEditorPlugins(),
      content: `<p>Keep text</p><audio data-node-type="audio" src="${src}" data-name="First.mp3"></audio><div data-node-type="downloadable-file" data-src="${src}" data-name="Keep.pdf"></div><audio data-node-type="audio" src="${src}" data-name="Second.mp3"></audio>`,
    });
    const { unmount } = render(<EditorContent editor={editor} />);
    fireEvent.click(
      (await screen.findAllByRole("button", { name: i18n.t("richText.audio.remove") }))[0],
    );
    expect(
      editor
        .getJSON()
        .content?.filter((node) => node.type === "audio")
        .map((node) => node.attrs?.name),
    ).toEqual(["Second.mp3"]);
    expect(editor.getJSON().content?.some((node) => node.type === "downloadableFile")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("richText.audio.remove") }));
    expect(editor.getJSON().content?.some((node) => node.type === "audio")).toBe(false);
    expect(editor.getText()).toContain("Keep text");
    unmount();
    act(() => editor.destroy());
  });
  it("renders accessible native viewer playback with loading and recoverable errors", () => {
    const editor = new Editor({
      editorProps: { handleScrollToSelection: () => true },
      extensions: contentViewerPlugins,
      editable: false,
      content: `<audio data-node-type="audio" src="${src}" data-name="Interview.mp3"></audio>`,
    });
    const { container, unmount } = render(<EditorContent editor={editor} />);
    const player = container.querySelector("audio")!;
    expect(player).toHaveAttribute("aria-label", "Interview.mp3");
    expect(player).toHaveClass("w-full");
    expect(player).toHaveAttribute("controls");
    expect(player).not.toHaveAttribute("autoplay");
    expect(screen.getByRole("status")).toHaveTextContent(i18n.t("richText.audio.loading"));
    fireEvent.loadedMetadata(player);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.error(player);
    expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("richText.audio.error"));
    fireEvent.canPlay(player);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();
    act(() => editor.destroy());
  });

  it.each([
    "javascript:alert(1)",
    "data:audio/mp3;base64,AA",
    "blob:https://app.test/id",
    "https://evil.test/api/lesson/lesson-resource/11111111-1111-4111-8111-111111111111",
    "//evil.test/audio.mp3",
    "/unrelated.mp3",
    "api/lesson/lesson-resource/11111111-1111-4111-8111-111111111111",
  ])("does not retain unsafe or transient audio URLs: %s", (unsafeSrc) => {
    const editor = new Editor({
      editorProps: { handleScrollToSelection: () => true },
      extensions: getContentEditorPlugins(),
      content: {
        type: "doc",
        content: [{ type: "audio", attrs: { src: unsafeSrc, name: "Unsafe" } }],
      },
    });
    const container = document.createElement("div");
    container.innerHTML = editor.getHTML();
    expect(container.querySelector("audio[src]")).toBeNull();
    editor.commands.setContent(`<audio data-node-type="audio" src="${unsafeSrc}"></audio>`);
    expect(editor.getJSON().content?.some((node) => node.type === "audio")).toBe(false);
    act(() => editor.destroy());
  });
  it("roundtrips audio HTML and JSON between the real editor and viewer schemas", () => {
    const editor = new Editor({
      editorProps: { handleScrollToSelection: () => true },
      extensions: getContentEditorPlugins(),
      content: `<p>Before</p><audio data-node-type="audio" src="${src}" data-name="Lesson &amp; interview.mp3" controls preload="metadata"></audio><p>After</p>`,
    });
    const audio = editor.getJSON().content?.find((node) => node.type === "audio");
    expect(audio?.attrs).toMatchObject({ src, name: "Lesson & interview.mp3" });
    const viewer = new Editor({
      editorProps: { handleScrollToSelection: () => true },
      extensions: contentViewerPlugins,
      content: editor.getHTML(),
    });
    expect(viewer.getJSON()).toEqual(editor.getJSON());
    const fromJson = new Editor({
      editorProps: { handleScrollToSelection: () => true },
      extensions: getContentEditorPlugins(),
      content: viewer.getJSON(),
    });
    expect(fromJson.getHTML()).toEqual(editor.getHTML());
    const html = document.createElement("div");
    html.innerHTML = viewer.getHTML();
    const player = html.querySelector("audio");
    expect(player?.getAttribute("src")).toBe(src);
    expect(player?.hasAttribute("controls")).toBe(true);
    expect(player?.hasAttribute("autoplay")).toBe(false);
    expect(player?.getAttribute("preload")).toBe("metadata");
    act(() => editor.destroy());
    viewer.destroy();
    fromJson.destroy();
  });
});
