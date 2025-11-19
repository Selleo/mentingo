import { create } from "zustand";
import { persist } from "zustand/middleware";

type LessonAutoplayStore = {
  isAutoplayEnabled: boolean;
  setAutoplayEnabled: (value: boolean) => void;
  shouldAutoplayNextLesson: boolean;
  setShouldAutoplayNextLesson: (value: boolean) => void;
  shouldResumeFullscreen: boolean;
  setShouldResumeFullscreen: (value: boolean) => void;
};

export const useLessonAutoplayStore = create<LessonAutoplayStore>()(
  persist(
    (set) => ({
      isAutoplayEnabled: true,
      setAutoplayEnabled: (value) => set({ isAutoplayEnabled: value }),
      shouldAutoplayNextLesson: false,
      setShouldAutoplayNextLesson: (value) =>
        set((state) =>
          state.shouldAutoplayNextLesson === value ? state : { shouldAutoplayNextLesson: value },
        ),
      shouldResumeFullscreen: false,
      setShouldResumeFullscreen: (value) =>
        set((state) =>
          state.shouldResumeFullscreen === value ? state : { shouldResumeFullscreen: value },
        ),
    }),
    {
      name: "lesson-autoplay-preference",
      partialize: (state) => ({
        isAutoplayEnabled: state.isAutoplayEnabled,
      }),
    },
  ),
);
