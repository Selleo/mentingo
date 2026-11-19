import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { act, screen, waitFor } from "@testing-library/react";
import videojs from "video.js";
import { afterEach, describe, expect, it } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { VideoPlayer } from "../VideoPlayer";

const originalLanguages = { ...videojs.options.languages };

afterEach(async () => {
  videojs.options.languages = { ...originalLanguages };
  await act(async () => {
    await i18next.changeLanguage("en");
  });
});

describe("VideoPlayer localization with a real Video.js player", () => {
  it("names sliders and the player region in the UI language on first render", async () => {
    await act(async () => {
      await i18next.changeLanguage("pl");
    });

    renderWith({ withQuery: true }).render(
      <VideoPlayer provider={VIDEO_EMBED_PROVIDERS.SELF} url="https://example.com/video.mp4" />,
    );

    expect(await screen.findByRole("slider", { name: "Pasek postępu" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Poziom głośności" })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector(".video-js")).toHaveAttribute("aria-label", "Odtwarzacz wideo"),
    );
  });
});
