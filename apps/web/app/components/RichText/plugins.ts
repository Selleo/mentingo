import { Heading } from "@tiptap/extension-heading";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { StarterKit } from "@tiptap/starter-kit";

const HeadingWithId = Heading.extend({
  addAttributes: () => ({
    id: {
      default: null,
      parseHTML: (element) => element.getAttribute("id"),
      renderHTML: (attrs) => (attrs.id ? { id: attrs.id } : {}),
    },
  }),
});

export const plugins = [
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
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: "text-primary-700 underline",
      rel: "noopener noreferrer",
      target: "_blank",
    },
  }),
  Image.configure({
    HTMLAttributes: {
      class: "max-w-full h-auto m-0",
    },
  }),
];
