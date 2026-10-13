import { Editor } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";

import { contentViewerPlugins, getContentEditorPlugins } from "../plugins";

import { AUTHORING_BLOCK_ID_ATTRIBUTE } from "./authoringBlockId";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getBlockIds = (html: string) => {
  const container = document.createElement("div");
  container.innerHTML = html;
  return Array.from(container.children).map((element) =>
    element.getAttribute(AUTHORING_BLOCK_ID_ATTRIBUTE),
  );
};

describe("AuthoringBlockId", () => {
  it("round-trips top-level IDs while preserving heading anchors and resource IDs", async () => {
    const existingId = "11111111-1111-4111-8111-111111111111";
    const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const resourceHref = `/api/lesson/lesson-resource/${resourceId}`;
    const editor = new Editor({
      extensions: getContentEditorPlugins(),
      content: [
        `<h2 id="intro" ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${existingId}">Introduction</h2>`,
        `<div data-node-type="image" data-src="${resourceHref}" data-alt="Diagram" data-resource-id="${resourceId}"></div>`,
        "<ul><li><p>Nested item</p></li></ul>",
      ].join(""),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const serialized = editor.getHTML();
    const container = document.createElement("div");
    container.innerHTML = serialized;
    const ids = getBlockIds(serialized);

    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(existingId);
    expect(ids.every((id) => id !== null && UUID_PATTERN.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(container.querySelector("h2")?.getAttribute("id")).toBe("intro");
    expect(container.querySelector("[data-node-type='image']")?.getAttribute("data-src")).toBe(
      resourceHref,
    );
    expect(
      container.querySelector("[data-node-type='image']")?.getAttribute("data-resource-id"),
    ).toBe(resourceId);
    expect(container.querySelector("li")?.hasAttribute(AUTHORING_BLOCK_ID_ATTRIBUTE)).toBe(false);
    expect(container.querySelector("li p")?.hasAttribute(AUTHORING_BLOCK_ID_ATTRIBUTE)).toBe(false);

    editor.commands.setContent(serialized);
    expect(getBlockIds(editor.getHTML())).toEqual(ids);
    editor.destroy();
  });

  it("allocates new identity after duplicating and splitting a block", async () => {
    const sourceId = "11111111-1111-4111-8111-111111111111";
    const editor = new Editor({
      extensions: getContentEditorPlugins(),
      content: `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${sourceId}">First block</p>`,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const sourceBlock = editor.getJSON().content?.[0];
    expect(sourceBlock).toBeDefined();
    editor.commands.insertContentAt(editor.state.doc.content.size, sourceBlock!);

    let ids = getBlockIds(editor.getHTML());
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(sourceId);
    expect(ids[1]).not.toBe(sourceId);

    editor.view.dispatch(editor.state.tr.split(3));
    ids = getBlockIds(editor.getHTML());
    expect(ids).toHaveLength(3);
    expect(ids.every((id) => id !== null && UUID_PATTERN.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    editor.destroy();
  });

  it("strips copied block identity before pasted content is inserted", async () => {
    const sourceId = "11111111-1111-4111-8111-111111111111";
    const editor = new Editor({
      extensions: getContentEditorPlugins(),
      content: `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${sourceId}">Original</p>`,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const copiedNode = editor.schema.node(
      "paragraph",
      { authoringBlockId: sourceId },
      editor.schema.text("Pasted"),
    );
    const copiedSlice = new Slice(Fragment.from(copiedNode), 0, 0);
    const transformPasted = editor.state.plugins.find((plugin) =>
      Boolean(plugin.props.transformPasted),
    );

    expect(transformPasted).toBeDefined();
    const transformed = transformPasted!.props.transformPasted!.call(
      transformPasted!,
      copiedSlice,
      editor.view,
    );
    expect(transformed.content.firstChild?.attrs.authoringBlockId).toBeNull();

    editor.commands.insertContentAt(
      editor.state.doc.content.size,
      transformed.content.firstChild!.toJSON(),
    );
    const ids = getBlockIds(editor.getHTML());
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(sourceId);
    expect(ids[1]).not.toBe(sourceId);
    editor.destroy();
  });

  it("preserves existing IDs in the content viewer without assigning legacy IDs", async () => {
    const existingId = "11111111-1111-4111-8111-111111111111";
    const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const resourceHref = `/api/lesson/lesson-resource/${resourceId}`;
    const viewer = new Editor({
      editable: false,
      extensions: contentViewerPlugins,
      content: [
        `<p ${AUTHORING_BLOCK_ID_ATTRIBUTE}="${existingId}">Identified</p>`,
        `<div data-node-type="image" data-src="${resourceHref}" data-alt="Diagram" data-resource-id="${resourceId}"></div>`,
        "<p>Legacy</p>",
      ].join(""),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const viewerHtml = viewer.getHTML();
    const container = document.createElement("div");
    container.innerHTML = viewerHtml;

    expect(getBlockIds(viewerHtml)).toEqual([existingId, null, null]);
    expect(container.querySelectorAll("[data-node-type='image']")).toHaveLength(1);
    expect(container.querySelector("[data-node-type='image']")?.getAttribute("data-src")).toBe(
      resourceHref,
    );
    expect(
      container.querySelector("[data-node-type='image']")?.getAttribute("data-resource-id"),
    ).toBe(resourceId);
    viewer.destroy();
  });
});
