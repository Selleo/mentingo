import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { Editor } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { describe, expect, it, beforeEach } from "vitest";

import { UuidExtension, stampContent } from "../uuid-extension";

const buildEditor = (
  content: object = {
    type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
    content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH }],
  },
) =>
  new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Heading.configure({ levels: [1, 2, 3] }),
      UuidExtension,
    ],
    content: stampContent(content as never),
  });

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const uuids = (editor: Editor) => {
  const collected: (string | null | undefined)[] = [];
  editor.state.doc.descendants((node) => {
    if (
      node.type.name === EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH ||
      node.type.name === EMAIL_TEMPLATE_NODE_TYPES.HEADING
    ) {
      collected.push((node.attrs?.uuid ?? null) as string | null);
    }
  });
  return collected;
};

describe("stampContent (helper)", () => {
  it("stamps a fresh uuid on tracked nodes missing one", () => {
    const stamped = stampContent({
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [
        { type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH },
        { type: EMAIL_TEMPLATE_NODE_TYPES.HEADING, attrs: { level: 1 } },
      ],
    });
    expect(stamped.content?.[0]?.attrs?.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(stamped.content?.[1]?.attrs?.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(stamped.content?.[0]?.attrs?.uuid).not.toBe(stamped.content?.[1]?.attrs?.uuid);
  });

  it("replaces duplicate uuids with fresh ones", () => {
    const dup = "00000000-0000-4000-8000-000000000000";
    const stamped = stampContent({
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [
        { type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH, attrs: { uuid: dup } },
        { type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH, attrs: { uuid: dup } },
      ],
    });
    expect(stamped.content?.[0]?.attrs?.uuid).toBe(dup);
    expect(stamped.content?.[1]?.attrs?.uuid).not.toBe(dup);
    expect(stamped.content?.[1]?.attrs?.uuid).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("preserves existing unique uuids", () => {
    const a = "00000000-0000-4000-8000-00000000000a";
    const b = "00000000-0000-4000-8000-00000000000b";
    const stamped = stampContent({
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [
        { type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH, attrs: { uuid: a } },
        { type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH, attrs: { uuid: b } },
      ],
    });
    expect(stamped.content?.[0]?.attrs?.uuid).toBe(a);
    expect(stamped.content?.[1]?.attrs?.uuid).toBe(b);
  });
});

describe("UuidExtension", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = buildEditor();
  });

  it("initial content is stamped (via stampContent helper)", () => {
    const stamped = uuids(editor);
    expect(stamped).toHaveLength(1);
    expect(stamped[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("preserves uuids when unrelated nodes are inserted", () => {
    const before = uuids(editor)[0];
    editor.commands.insertContentAt(editor.state.doc.content.size, {
      type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "hello" }],
    });
    const after = uuids(editor);
    expect(after[0]).toBe(before);
    expect(after[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(after[1]).not.toBe(before);
  });

  it("mints a new uuid when a paste introduces a duplicate", () => {
    const [firstUuid] = uuids(editor);
    editor.commands.insertContentAt(editor.state.doc.content.size, {
      type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
      attrs: { uuid: firstUuid },
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "dup" }],
    });
    const after = uuids(editor);
    expect(after).toHaveLength(2);
    expect(after[0]).toBe(firstUuid);
    expect(after[1]).not.toBe(firstUuid);
    expect(after[1]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps stable uuids across a round-trip through JSON (undo/redo pattern)", () => {
    const before = uuids(editor);
    editor.commands.setContent(editor.getJSON());
    const after = uuids(editor);
    expect(after).toEqual(before);
  });

  it("keeps or fresh-stamps a uuid after a paragraph→heading type change", () => {
    editor.commands.setNode(EMAIL_TEMPLATE_NODE_TYPES.HEADING, { level: 2 });
    const stamped = uuids(editor);
    expect(stamped).toHaveLength(1);
    expect(stamped[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("allows deleting a node without errors", () => {
    editor.commands.insertContentAt(editor.state.doc.content.size, {
      type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.TEXT, text: "second" }],
    });
    const before = uuids(editor);
    expect(before).toHaveLength(2);

    editor.commands.setContent({
      type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
      content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH }],
    });
    const after = uuids(editor);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("onCreate stamps content that was not pre-stamped (after microtask)", async () => {
    const bareEditor = new Editor({
      extensions: [Document, Paragraph, Text, UuidExtension],
      content: {
        type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
        content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH }],
      },
    });
    await flushMicrotasks();
    const stamped = uuids(bareEditor);
    expect(stamped[0]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
