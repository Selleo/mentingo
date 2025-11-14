import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const AUTOPLAY_STORAGE_KEY = "lesson-autoplay-storage";
const AUTOPLAY_FULLSCREEN_STORAGE_KEY = "lesson-autoplay-fullscreen";

type AutoplayStore = {
  isAutoplayEnabled: boolean;
  setAutoplayEnabled: (enabled: boolean) => void;
};

type AutoplayFullscreenStore = {
  shouldRestoreFullscreen: boolean;
  setShouldRestoreFullscreen: (value: boolean) => void;
};

export const useAutoplayStore = create<AutoplayStore>()(
  persist(
    (set) => ({
      isAutoplayEnabled: false,
      setAutoplayEnabled: (enabled) => set({ isAutoplayEnabled: enabled }),
    }),
    {
      name: AUTOPLAY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const useAutoplayFullscreenStore = create<AutoplayFullscreenStore>()(
  persist(
    (set) => ({
      shouldRestoreFullscreen: false,
      setShouldRestoreFullscreen: (value) => set({ shouldRestoreFullscreen: value }),
    }),
    {
      name: AUTOPLAY_FULLSCREEN_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
