import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export const variableHighlightPluginKey = new PluginKey("email-template-variable-highlight");

const VARIABLE_REGEX = /\{\{[^{}]*\}\}/g;

const VALID_NAME = /^[A-Za-z0-9_.]*$/;

const ACTIVE_VALID_CLASS = "email-variable-active !text-primary-700 font-medium";
const ACTIVE_INVALID_CLASS = "email-variable-active-invalid !text-error-600 font-medium";
const PILL_VALID_CLASS =
  "email-variable-pill inline-block px-1.5 py-px mx-px rounded-md bg-primary-50 !text-primary-700 font-medium leading-tight caret-transparent";
const PILL_INVALID_CLASS =
  "email-variable-pill-invalid inline-block px-1.5 py-px mx-px rounded-md bg-error-50 !text-error-600 font-medium leading-tight caret-transparent";

type Range = { from: number; to: number; valid: boolean };

const findVariableRanges = (doc: ProseMirrorNode): Range[] => {
  const ranges: Range[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    VARIABLE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = VARIABLE_REGEX.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      const name = match[0].slice(2, -2);
      ranges.push({ from, to, valid: VALID_NAME.test(name) });
    }
  });
  return ranges;
};

const isCaretActive = (range: Range, caret: number): boolean =>
  caret > range.from && caret < range.to;

const rangeEndingAt = (ranges: Range[], pos: number): Range | null =>
  ranges.find((r) => r.to === pos) ?? null;

const rangeStartingAt = (ranges: Range[], pos: number): Range | null =>
  ranges.find((r) => r.from === pos) ?? null;

const rangeContaining = (ranges: Range[], pos: number): Range | null =>
  ranges.find((r) => pos > r.from && pos < r.to) ?? null;

const buildDecorations = (state: EditorState): DecorationSet => {
  const ranges = findVariableRanges(state.doc);
  if (!ranges.length) return DecorationSet.empty;
  const caret = state.selection.empty ? state.selection.from : -1;
  const decos = ranges.map((r) => {
    const active = isCaretActive(r, caret);
    let cls;
    if (active) {
      cls = r.valid ? ACTIVE_VALID_CLASS : ACTIVE_INVALID_CLASS;
    } else {
      cls = r.valid ? PILL_VALID_CLASS : PILL_INVALID_CLASS;
    }
    return Decoration.inline(r.from, r.to, { class: cls });
  });
  return DecorationSet.create(state.doc, decos);
};

const handleTextInput = (view: EditorView, from: number, to: number, text: string): boolean => {
  if (text !== "{") return false;
  const { doc, selection } = view.state;
  if (!selection.empty) return false;
  if (from === 0) return false;
  const before = doc.textBetween(from - 1, from, "\n", "\n");
  if (before !== "{") return false;
  const ahead = doc.textBetween(to, Math.min(to + 2, doc.content.size), "\n", "\n");
  if (ahead === "}}") return false;
  const tr = view.state.tr.insertText("{}}", from, to);
  tr.setSelection(TextSelection.create(tr.doc, from + 1));
  view.dispatch(tr);
  return true;
};

const deleteRange = (view: EditorView, range: Range): boolean => {
  const tr: Transaction = view.state.tr.delete(range.from, range.to);
  view.dispatch(tr);
  return true;
};

const moveCaretTo = (view: EditorView, pos: number): boolean => {
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, pos));
  view.dispatch(tr);
  return true;
};

const handleKeyDown = (view: EditorView, event: KeyboardEvent): boolean => {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const { selection } = view.state;
  if (!selection.empty) return false;
  const caret = selection.from;
  const ranges = findVariableRanges(view.state.doc);
  if (!ranges.length) return false;

  switch (event.key) {
    case "Backspace": {
      const range = rangeEndingAt(ranges, caret);
      if (range) return deleteRange(view, range);
      return false;
    }
    case "Delete": {
      const range = rangeStartingAt(ranges, caret);
      if (range) return deleteRange(view, range);
      return false;
    }
    case "ArrowLeft": {
      const range = rangeEndingAt(ranges, caret);
      if (range) return moveCaretTo(view, range.from);
      return false;
    }
    case "ArrowRight": {
      const range = rangeStartingAt(ranges, caret);
      if (range) return moveCaretTo(view, range.to);
      return false;
    }
    case "Enter": {
      const range = rangeContaining(ranges, caret);
      if (range) return moveCaretTo(view, range.to);
      return false;
    }
    default:
      return false;
  }
};

export const VariableHighlightExtension = Extension.create({
  name: "emailTemplateVariableHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: variableHighlightPluginKey,
        state: {
          init: (_config, state) => buildDecorations(state),
          apply: (tr, oldSet, _oldState, newState) => {
            if (!tr.docChanged && !tr.selectionSet) return oldSet.map(tr.mapping, tr.doc);
            return buildDecorations(newState);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty;
          },
          handleTextInput,
          handleKeyDown,
        },
      }),
    ];
  },
});

export default VariableHighlightExtension;
