import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { StarterKit } from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";

export const plugins = [
  StarterKit,
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
      class: 'text-primary-700 underline',
      rel: 'noopener noreferrer',
      target: '_blank',
    },
  }),
];
