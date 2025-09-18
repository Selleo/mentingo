import { create } from "zustand";

type AnnouncementsPopupStore = {
  isVisible: boolean;
  setIsVisible: (value: boolean) => void;
};

export const useAnnouncementsPopupStore = create<AnnouncementsPopupStore>()((set) => ({
  isVisible: true,
  setIsVisible: (value) => set({ isVisible: value }),
}));
