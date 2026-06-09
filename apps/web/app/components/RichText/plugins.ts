import { mergeAttributes } from "@tiptap/core";
import { Heading } from "@tiptap/extension-heading";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { StarterKit } from "@tiptap/starter-kit";

import i18n from "i18n";
import {
  DownloadableFileEmbedEditor,
  DownloadableFileEmbedViewer,
} from "~/components/RichText/extensions/downloadableFile";
import { Iframe } from "~/components/RichText/extensions/iframe";
import { ImageEmbedEditor, ImageEmbedViewer } from "~/components/RichText/extensions/image";
import {
  LoadingAiAssetEditor,
  LoadingAiAssetViewer,
} from "~/components/RichText/extensions/loading-ai-asset";
import {
  PdfPreviewEmbedEditor,
  PdfPreviewEmbedViewer,
} from "~/components/RichText/extensions/pdfPreview";
import {
  PresentationEmbedEditor,
  PresentationEmbedViewer,
} from "~/components/RichText/extensions/presentation";
import { VideoEmbedEditor, VideoEmbedViewer } from "~/components/RichText/extensions/video";

import type { RichTextResourceNodeOptions } from "./extensions/utils/resourceNode";

const HeadingWithId = Heading.extend({
  name: "heading",
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attrs) => (attrs.id ? { id: attrs.id } : {}),
      },
    };
  },
});

const LinkWithDownload = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      download: {
        default: null,
        parseHTML: (element) => element.getAttribute("download"),
        renderHTML: (attrs) => (attrs.download ? { download: attrs.download } : {}),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

const basePlugins = [
  StarterKit.configure({
    heading: false,
  }),
  HeadingWithId.configure({
    levels: [1, 2, 3, 4, 5, 6],
  }),
  TaskList.configure({
    HTMLAttributes: {
      class: "list-none",
    },
  }),
  TaskItem.configure({
    nested: true,
    HTMLAttributes: {
      class: "flex items-start gap-2 [&_p]:inline [&_p]:m-0",
    },
    onReadOnlyChecked: (_node, _checked) => true,
  }),
  LinkWithDownload.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: "text-primary-700 underline",
      rel: "noopener noreferrer",
      target: "_blank",
    },
  }),
  Iframe,
];

export const baseEditorPlugins = [...basePlugins];

const tablePlugins = [
  Table.configure({
    resizable: true,
    HTMLAttributes: {
      class: "rich-text-table",
    },
  }),
  TableRow,
  TableHeader,
  TableCell,
];

export const getContentEditorPlugins = (options?: RichTextResourceNodeOptions) => [
  ...basePlugins,
  ...tablePlugins,
  Placeholder.configure({
    includeChildren: true,
    showOnlyCurrent: true,
    placeholder: ({ node }) =>
      node.type.name === "paragraph" ? i18n.t("richTextEditor.placeholder.lineHint") : "",
  }),
  DownloadableFileEmbedEditor.configure(options),
  LoadingAiAssetEditor,
  ImageEmbedEditor.configure(options),
  PdfPreviewEmbedEditor.configure(options),
  PresentationEmbedEditor.configure(options),
  VideoEmbedEditor.configure(options),
];

export const contentEditorPlugins = getContentEditorPlugins();

export const baseViewerPlugins = [...basePlugins];

export const contentViewerPlugins = [
  ...basePlugins,
  ...tablePlugins,
  DownloadableFileEmbedViewer,
  LoadingAiAssetViewer,
  ImageEmbedViewer,
  PdfPreviewEmbedViewer,
  PresentationEmbedViewer,
  VideoEmbedViewer,
];
