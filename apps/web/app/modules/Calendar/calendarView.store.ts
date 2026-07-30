import { create } from "zustand";
import { persist } from "zustand/middleware";

export const CALENDAR_VIEWS = {
  MONTH: "month",
  WEEK: "week",
  DAY: "day",
} as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[keyof typeof CALENDAR_VIEWS];

type CalendarViewStore = {
  view: CalendarView;
  setView: (view: CalendarView) => void;
};

export const useCalendarViewStore = create<CalendarViewStore>()(
  persist(
    (set) => ({
      view: CALENDAR_VIEWS.MONTH,
      setView: (view) => set({ view }),
    }),
    { name: "calendar-view-storage" },
  ),
);
