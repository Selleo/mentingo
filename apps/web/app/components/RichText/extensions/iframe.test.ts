import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import { Iframe } from "./iframe";
import { safeEmbedUrl } from "./utils/embedUrl";

const unsafe = [
  "javascript:parent.alert(1)",
  "java&#x09;script:parent.alert(1)",
  "data:text/html,payload",
  "file:///private/file",
  "blob:https://example.com/iframe",
];
describe("Tiptap iframe URL boundary", () => {
  it.each([false, true])("neutralizes executable sources for editable=%s", (editable) => {
    for (const src of unsafe) {
      const editor = new Editor({
        extensions: [StarterKit, Iframe],
        editable,
        content: `<iframe src="${src}" srcdoc="malicious" onload="malicious"></iframe>`,
      });
      const html = editor.getHTML();
      const element = new DOMParser().parseFromString(html, "text/html").querySelector("iframe");
      expect(element?.hasAttribute("src")).toBe(false);
      expect(element?.hasAttribute("srcdoc")).toBe(false);
      expect(element?.hasAttribute("onload")).toBe(false);
      editor.destroy();
    }
  });
  it.each([
    "https://www.youtube.com/embed/video",
    "//www.youtube.com/embed/video",
    "/api/lesson/lesson-resource/id",
  ])("preserves a standard embed %s", (src) => {
    expect(safeEmbedUrl(src)).toBe(src);
  });
  it("forces an opaque-origin sandbox that input cannot widen", () => {
    const editor = new Editor({
      extensions: [StarterKit, Iframe],
      content:
        '<iframe src="/uploaded-active-content" sandbox="allow-scripts allow-same-origin allow-top-navigation"></iframe>',
    });
    const iframe = new DOMParser()
      .parseFromString(editor.getHTML(), "text/html")
      .querySelector("iframe");
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts allow-presentation");
    editor.destroy();
  });
  it("permits object URLs only for generated image previews", () => {
    expect(safeEmbedUrl("blob:https://example.com/preview", true)).toBe(
      "blob:https://example.com/preview",
    );
    expect(safeEmbedUrl("blob:https://example.com/preview")).toBeNull();
    expect(safeEmbedUrl("java\tscript:alert(1)", true)).toBeNull();
  });
});
