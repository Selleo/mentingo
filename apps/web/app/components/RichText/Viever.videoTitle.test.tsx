import { render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import enTranslations from "~/locales/en/translation.json";

import { ContentViewer } from "./Viever";

vi.mock("~/api/queries/useThumbnail", () => ({
  useThumbnail: () => ({ data: undefined }),
}));

const VIDEO_CONTENT =
  '<div data-node-type="video" data-source-type="external" data-provider="unknown" data-src="https://example.com/video.mp4"></div>';

describe("ContentViewer video title", () => {
  it("names the video play button after the lesson title", async () => {
    const i18n = createInstance();

    await i18n.init({
      lng: "en",
      resources: { en: { translation: enTranslations } },
      interpolation: { escapeValue: false },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ContentViewer content={VIDEO_CONTENT} videoTitle="Intro" />
      </I18nextProvider>,
    );

    expect(await screen.findByRole("button", { name: "Play video: Intro" })).toBeInTheDocument();
  });
});
