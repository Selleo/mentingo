import { VIDEO_AUTOPLAY } from "@repo/shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { VideoAutoplay } from "@repo/shared";

type AutoplaySettings = {
  currentAction: VideoAutoplay;
  nextVideoUrl?: string;
};

type VideoPreferencesStore = {
  autoplay: boolean;
  autoplaySettings: AutoplaySettings;

  setAutoplaySettings: (value: AutoplaySettings) => void;
  setAutoplay: (value: boolean) => void;
};

export const useVideoPreferencesStore = create<VideoPreferencesStore>()(
  persist<VideoPreferencesStore>(
    (set) => ({
      autoplay: true,
      setAutoplay: (value) => set({ autoplay: value }),
      autoplaySettings: { currentAction: VIDEO_AUTOPLAY.NO_AUTOPLAY },
      setAutoplaySettings: (value) => set({ autoplaySettings: value }),
    }),
    {
      name: "video-preferences-storage",
    },
  ),
);
