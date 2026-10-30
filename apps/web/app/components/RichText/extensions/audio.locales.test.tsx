import { act, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { contentViewerPlugins } from "../plugins";

const locales = import.meta.glob<{ default: { richText: { audio?: Record<string, string> } } }>(
  "../../../locales/*/translation.json",
  { eager: true },
);

describe("audio translations", () => {
  it.each(Object.entries(locales))(
    "provides native player loading and error messages in %s",
    async (path, locale) => {
      const audio = locale.default.richText.audio;
      expect(audio).toBeDefined();
      for (const key of [
        "label",
        "upload",
        "drag",
        "remove",
        "loading",
        "error",
        "unsupported",
        "invalidType",
        "tooLarge",
        "uploadFailed",
      ]) {
        expect(audio?.[key]).toBeTruthy();
      }
      const language = path.split("/").at(-2)!;
      const i18n = createInstance();
      await i18n.init({
        lng: language,
        resources: { [language]: { translation: locale.default } },
        interpolation: { escapeValue: false },
      });
      const editor = new Editor({
        extensions: contentViewerPlugins,
        editable: false,
        content:
          '<audio data-node-type="audio" src="/api/lesson/lesson-resource/11111111-1111-4111-8111-111111111111"></audio>',
      });
      const { container, unmount } = render(
        <I18nextProvider i18n={i18n}>
          <EditorContent editor={editor} />
        </I18nextProvider>,
      );
      expect(await screen.findByRole("status")).toHaveTextContent(audio!.loading);
      const player = container.querySelector("audio")!;
      expect(player).toHaveAccessibleName(audio!.label);
      fireEvent.error(player);
      expect(screen.getByRole("alert")).toHaveTextContent(audio!.error);
      unmount();
      act(() => editor.destroy());
    },
  );
});
