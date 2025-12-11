import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

import type { Editor } from "@tiptap/react";

type FormatTypeProps = {
  editor: Editor;
};

export function FormatType({ editor }: FormatTypeProps) {
  const value = () => {
    if (editor.isActive("paragraph")) return "paragraph";
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    if (editor.isActive("heading", { level: 4 })) return "h4";
    if (editor.isActive("heading", { level: 5 })) return "h5";
    if (editor.isActive("heading", { level: 6 })) return "h6";
  };

  const onChange = (value: string) => {
    const { from, to, empty, $from } = editor.state.selection;
    const nodeStart = $from.start();
    const nodeEnd = $from.end();
    const selectedText = editor.state.doc.textBetween(from, to).trim();
    const isPartialSelection = from > nodeStart || to < nodeEnd;
    const hasPartialSelection = !empty && selectedText && isPartialSelection;

    if (hasPartialSelection) {
      const fullNodeText = editor.state.doc.textBetween(nodeStart, nodeEnd);
      const beforeContent = fullNodeText.substring(0, from - nodeStart).trim();
      const afterContent = fullNodeText.substring(to - nodeStart).trim();
      const level = value.replace("h", "");
      const middleContent =
        value === "paragraph" ? `<p>${selectedText}</p>` : `<h${level}>${selectedText}</h${level}>`;

      const newContent = [
        beforeContent && `<p>${beforeContent}</p>`,
        middleContent,
        afterContent && `<p>${afterContent}</p>`,
      ]
        .filter(Boolean)
        .join("");

      editor
        .chain()
        .focus()
        .deleteRange({ from: nodeStart, to: nodeEnd })
        .insertContentAt(nodeStart, newContent)
        .run();
      return;
    }

    const chain = editor.chain().focus();
    if (value === "paragraph") return chain.setNode("paragraph").run();
    if (value === "h1") return chain.setNode("heading", { level: 1 }).run();
    if (value === "h2") return chain.setNode("heading", { level: 2 }).run();
    if (value === "h3") return chain.setNode("heading", { level: 3 }).run();
    if (value === "h4") return chain.setNode("heading", { level: 4 }).run();
    if (value === "h5") return chain.setNode("heading", { level: 5 }).run();
    if (value === "h6") return chain.setNode("heading", { level: 6 }).run();
  };

  return (
    <Select onValueChange={onChange} defaultValue={value()} value={value()}>
      <SelectTrigger className="invisible h-8 w-[120px] sm:visible">
        <SelectValue placeholder="Select format" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="paragraph">Paragraph</SelectItem>
          <SelectItem value="h1">H1</SelectItem>
          <SelectItem value="h2">H2</SelectItem>
          <SelectItem value="h3">H3</SelectItem>
          <SelectItem value="h4">H4</SelectItem>
          <SelectItem value="h5">H5</SelectItem>
          <SelectItem value="h6">H6</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
