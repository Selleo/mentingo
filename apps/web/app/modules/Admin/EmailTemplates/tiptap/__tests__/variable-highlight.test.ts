import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { Editor } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { VariableHighlightExtension, variableHighlightPluginKey } from "../variable-highlight";

import type { DecorationSet } from "@tiptap/pm/view";

const buildEditor = (text = "") =>
  new Editor({
    extensions: [Document, Paragraph, Text, VariableHighlightExtension],
    content: {
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [
        {
          type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
          content: text ? [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text }] : undefined,
        },
      ],
    },
  });

const paragraphText = (editor: Editor): string => {
  const first = editor.state.doc.firstChild;
  return first?.textContent ?? "";
};

const setCaret = (editor: Editor, pos: number) => {
  const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos));
  editor.view.dispatch(tr);
};

const decorationClassesAt = (editor: Editor, from: number, to: number): string[] => {
  const set = variableHighlightPluginKey.getState(editor.state) as DecorationSet | undefined;
  if (!set) return [];
  return set
    .find(from, to)
    .flatMap((d) =>
      ((d as unknown as { type: { attrs: { class?: string } } }).type.attrs.class ?? "").split(
        /\s+/,
      ),
    )
    .filter(Boolean);
};

const pressKey = (editor: Editor, key: string): boolean => {
  const event = new KeyboardEvent("keydown", { key });
  return (
    (editor.view.someProp("handleKeyDown", (fn) => fn(editor.view, event)) as
      boolean | undefined) ?? false
  );
};

const typeChar = (editor: Editor, ch: string): boolean => {
  const { from, to } = editor.state.selection;
  return (
    (editor.view.someProp("handleTextInput", (fn) =>
      fn(editor.view, from, to, ch, () => editor.state.tr),
    ) as boolean | undefined) ?? false
  );
};

describe("VariableHighlightExtension - auto-close `{{`", () => {
  it("expands `{{` into `{{}}` and drops the caret between the pairs", () => {
    const editor = buildEditor();
    setCaret(editor, 1);
    editor.commands.insertContent("{");
    const handled = typeChar(editor, "{");
    expect(handled).toBe(true);
    expect(paragraphText(editor)).toBe("{{}}");
    expect(editor.state.selection.from).toBe(3);
  });

  it("does NOT auto-close when the next two chars are already `}}`", () => {
    const editor = buildEditor("{{}}");
    setCaret(editor, 3);
    const handled = typeChar(editor, "{");
    expect(handled).toBe(false);
  });

  it("leaves single `{` alone when there's no preceding brace", () => {
    const editor = buildEditor("hello");
    setCaret(editor, 6);
    const handled = typeChar(editor, "{");
    expect(handled).toBe(false);
  });
});

describe("VariableHighlightExtension - decoration state", () => {
  it("marks `{{name}}` as a pill when the caret is outside", () => {
    const editor = buildEditor("hi {{userName}} there");
    setCaret(editor, 1);
    const classes = decorationClassesAt(editor, 4, 16);
    expect(classes).toContain("email-variable-pill");
    expect(classes).not.toContain("email-variable-active");
  });

  it("switches to active class when the caret is strictly inside the braces", () => {
    const editor = buildEditor("hi {{userName}} there");
    setCaret(editor, 6);
    const classes = decorationClassesAt(editor, 4, 16);
    expect(classes).toContain("email-variable-active");
    expect(classes).not.toContain("email-variable-pill");
  });

  it("treats caret exactly at the edges as OUTSIDE (pill state)", () => {
    const editor = buildEditor("{{x}}");
    setCaret(editor, 1);
    expect(decorationClassesAt(editor, 1, 6)).toContain("email-variable-pill");
    setCaret(editor, 6);
    expect(decorationClassesAt(editor, 1, 6)).toContain("email-variable-pill");
  });

  it("highlights empty `{{}}` as a variable too", () => {
    const editor = buildEditor("{{}}");
    setCaret(editor, 1);
    expect(decorationClassesAt(editor, 1, 5)).toContain("email-variable-pill");
  });

  it("uses the invalid class when the name contains a disallowed char (space)", () => {
    const editor = buildEditor("{{bad name}}");
    setCaret(editor, 1);
    expect(decorationClassesAt(editor, 1, 13)).toContain("email-variable-pill-invalid");
    setCaret(editor, 6);
    expect(decorationClassesAt(editor, 1, 13)).toContain("email-variable-active-invalid");
  });

  it("treats empty `{{}}` as valid (no danger flash for one keystroke)", () => {
    const editor = buildEditor("{{}}");
    setCaret(editor, 1);
    const classes = decorationClassesAt(editor, 1, 5);
    expect(classes).toContain("email-variable-pill");
    expect(classes).not.toContain("email-variable-pill-invalid");
  });

  it("accepts allowed chars: letters, digits, `_`, `.`", () => {
    const editor = buildEditor("{{user_1.name}}");
    setCaret(editor, 1);
    const classes = decorationClassesAt(editor, 1, 16);
    expect(classes).toContain("email-variable-pill");
    expect(classes).not.toContain("email-variable-pill-invalid");
  });

  it("flags non-ASCII in the name as invalid", () => {
    const editor = buildEditor("{{użytkownik}}");
    setCaret(editor, 1);
    expect(decorationClassesAt(editor, 1, 15)).toContain("email-variable-pill-invalid");
  });
});

describe("VariableHighlightExtension - keyboard atomicity", () => {
  it("Backspace at the trailing edge deletes the whole `{{...}}`", () => {
    const editor = buildEditor("before {{name}} after");
    setCaret(editor, 16);
    const handled = pressKey(editor, "Backspace");
    expect(handled).toBe(true);
    expect(paragraphText(editor)).toBe("before  after");
  });

  it("Delete at the leading edge deletes the whole `{{...}}`", () => {
    const editor = buildEditor("before {{name}} after");
    setCaret(editor, 8);
    const handled = pressKey(editor, "Delete");
    expect(handled).toBe(true);
    expect(paragraphText(editor)).toBe("before  after");
  });

  it("Backspace inside an active pill still deletes one char (falls through)", () => {
    const editor = buildEditor("{{name}}");
    setCaret(editor, 6);
    const handled = pressKey(editor, "Backspace");
    expect(handled).toBe(false);
  });

  it("ArrowLeft at the trailing edge jumps to the leading edge (skips the pill)", () => {
    const editor = buildEditor("a{{x}}b");
    setCaret(editor, 7);
    const handled = pressKey(editor, "ArrowLeft");
    expect(handled).toBe(true);
    expect(editor.state.selection.from).toBe(2);
  });

  it("ArrowRight at the leading edge jumps to the trailing edge (skips the pill)", () => {
    const editor = buildEditor("a{{x}}b");
    setCaret(editor, 2);
    const handled = pressKey(editor, "ArrowRight");
    expect(handled).toBe(true);
    expect(editor.state.selection.from).toBe(7);
  });

  it("Backspace does nothing special when caret isn't adjacent to a pill", () => {
    const editor = buildEditor("hello");
    setCaret(editor, 3);
    const handled = pressKey(editor, "Backspace");
    expect(handled).toBe(false);
  });
});
