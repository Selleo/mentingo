import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

import { buildRichTextFileUploadHandler } from "~/hooks/buildRichTextFileUploadHandler";

import { contentViewerPlugins, getContentEditorPlugins } from "../plugins";

import { insertResourceIntoEditor } from "./insertResourceIntoEditor";

const resources = ["first", "second", "third"];

const getResourceNames = (editor: Editor) =>
  editor
    .getJSON()
    .content?.filter((node) => node.type === "downloadableFile")
    .map((node) => node.attrs?.name);

describe("inserting document attachments", () => {
  it.each(["articles", "news"] as const)(
    "preserves a batch of uploaded documents in %s",
    async (entityType) => {
      const editor = new Editor({
        extensions: getContentEditorPlugins(),
        content: "<p>Existing text</p>",
        editorProps: { handleScrollToSelection: () => true },
      });
      const files = resources.map(
        (id) =>
          new File([id], `${id}.docx`, {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
      );
      const uploadResourceFile = vi.fn(async (file: File) => file.name);
      const upload = buildRichTextFileUploadHandler({
        entityType,
        uploadResourceFile,
        getVideoSessionForFile: vi.fn(),
        uploadVideo: vi.fn(),
        askForDisplayMode: vi.fn(),
        onVideoUploadError: vi.fn(),
        fallbackUploadErrorMessage: "Upload failed",
      });
      try {
        editor.commands.setTextSelection(editor.state.doc.content.size - 1);
        await Promise.all(files.map((file) => upload(file, editor)));
        expect(getResourceNames(editor)).toEqual(files.map((file) => file.name));
        expect(uploadResourceFile).toHaveBeenCalledTimes(files.length);
        expect(editor.getText()).toContain("Existing text");
      } finally {
        editor.destroy();
      }
    },
  );
  it("adds a document after a selected existing attachment instead of replacing it", () => {
    const editor = new Editor({
      extensions: getContentEditorPlugins(),
      content:
        '<div data-node-type="downloadable-file" data-src="/first.docx" data-name="first.docx"></div>',
      editorProps: { handleScrollToSelection: () => true },
    });
    try {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)));
      insertResourceIntoEditor({
        editor,
        resourceId: "second",
        entityType: "news",
        file: { name: "second.docx" },
        resourceType: "document",
      });
      expect(getResourceNames(editor)).toEqual(["first.docx", "second.docx"]);
    } finally {
      editor.destroy();
    }
  });
  it.each(["articles", "news"] as const)(
    "keeps every consecutive attachment in %s and its saved viewer content",
    (entityType) => {
      const editor = new Editor({
        extensions: getContentEditorPlugins(),
        content: "",
        editorProps: { handleScrollToSelection: () => true },
      });
      let viewer: Editor | undefined;
      try {
        for (const resourceId of resources) {
          insertResourceIntoEditor({
            editor,
            resourceId,
            entityType,
            file: { name: `${resourceId}.docx` },
            resourceType: "document",
          });
        }
        expect(getResourceNames(editor)).toEqual(resources.map((id) => `${id}.docx`));
        viewer = new Editor({
          extensions: contentViewerPlugins,
          content: editor.getHTML(),
          editable: false,
        });
        expect(getResourceNames(viewer)).toEqual(resources.map((id) => `${id}.docx`));
      } finally {
        viewer?.destroy();
        editor.destroy();
      }
    },
  );
});
