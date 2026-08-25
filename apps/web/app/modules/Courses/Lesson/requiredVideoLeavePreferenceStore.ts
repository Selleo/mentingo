import { create } from "zustand";
import { persist } from "zustand/middleware";

type RequiredVideoLeavePreferenceState = {
  dismissed: Record<string, true>;
  dismissForCourse: (key: string) => void;
};

export const getRequiredVideoLeavePreferenceKey = (userId: string, courseId: string) =>
  `${userId}:${courseId}`;

export const useRequiredVideoLeavePreferenceStore = create<RequiredVideoLeavePreferenceState>()(
  persist(
    (set) => ({
      dismissed: {},
      dismissForCourse: (key) =>
        set((state) => ({ dismissed: { ...state.dismissed, [key]: true } })),
    }),
    { name: "required-video-leave-preferences" },
  ),
);
