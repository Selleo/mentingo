import { create } from "zustand";
import { persist } from "zustand/middleware";

type VideoPreferencesStore = {
  autoplay: boolean;
  setAutoplay: (value: boolean) => void;
};

export const useVideoPreferencesStore = create<VideoPreferencesStore>()(
  persist(
    (set) => ({
      autoplay: true,
      setAutoplay: (value) => set({ autoplay: value }),
    }),
    {
      name: "video-preferences-storage",
    },
  ),
);
