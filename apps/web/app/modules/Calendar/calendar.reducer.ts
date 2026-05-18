import type { CalendarSelectedRange } from "./components/calendarCreateLiveTraining.types";
import type { DatesSetArg, DateSelectArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";

export const CALENDAR_ACTION_TYPES = {
  VISIBLE_RANGE_CHANGED: "visibleRangeChanged",
  CREATE_RANGE_SELECTED: "createRangeSelected",
  CREATE_DIALOG_OPEN_CHANGED: "createDialogOpenChanged",
  EVENT_DETAILS_SELECTED: "eventDetailsSelected",
  DETAILS_DIALOG_OPEN_CHANGED: "detailsDialogOpenChanged",
} as const;

export type CalendarVisibleRange = {
  start: string;
  end: string;
};

export type CalendarState = {
  visibleRange?: CalendarVisibleRange;
  selectedRange: CalendarSelectedRange | null;
  isCreateDialogOpen: boolean;
  selectedEventId: string | null;
  isDetailsDialogOpen: boolean;
};

export type CalendarAction =
  | {
      type: typeof CALENDAR_ACTION_TYPES.VISIBLE_RANGE_CHANGED;
      range: CalendarVisibleRange;
    }
  | {
      type: typeof CALENDAR_ACTION_TYPES.CREATE_RANGE_SELECTED;
      selectedRange: CalendarSelectedRange;
    }
  | {
      type: typeof CALENDAR_ACTION_TYPES.CREATE_DIALOG_OPEN_CHANGED;
      open: boolean;
    }
  | {
      type: typeof CALENDAR_ACTION_TYPES.EVENT_DETAILS_SELECTED;
      eventId: string;
    }
  | {
      type: typeof CALENDAR_ACTION_TYPES.DETAILS_DIALOG_OPEN_CHANGED;
      open: boolean;
    };

export const initialCalendarState: CalendarState = {
  selectedRange: null,
  isCreateDialogOpen: false,
  selectedEventId: null,
  isDetailsDialogOpen: false,
};

const getNearestHalfHourRange = (date: Date) => {
  const startsAt = new Date(date);
  const minutes = startsAt.getMinutes();
  let roundedMinutes = 0;

  if (minutes >= 15 && minutes < 45) {
    roundedMinutes = 30;
  }

  if (roundedMinutes === 0 && minutes >= 45) {
    startsAt.setHours(startsAt.getHours() + 1);
  }

  startsAt.setMinutes(roundedMinutes, 0, 0);

  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + 30);

  return {
    startsAt,
    endsAt,
  };
};

const setDateFromSelection = (targetDate: Date, selectedDate: Date) => {
  targetDate.setFullYear(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );
};

export const getVisibleRangeFromDatesSet = (dateInfo: DatesSetArg): CalendarVisibleRange => ({
  start: dateInfo.startStr,
  end: dateInfo.endStr,
});

export const getSelectedRangeFromDateClick = (dateInfo: DateClickArg): CalendarSelectedRange => {
  if (!dateInfo.allDay) {
    return {
      start: dateInfo.date,
      end: new Date(dateInfo.date.getTime() + 30 * 60 * 1000),
      allDay: false,
    };
  }

  const { startsAt, endsAt } = getNearestHalfHourRange(new Date());

  setDateFromSelection(startsAt, dateInfo.date);
  setDateFromSelection(endsAt, dateInfo.date);

  return {
    start: startsAt,
    end: endsAt,
    allDay: false,
  };
};

export const getSelectedRangeFromSelection = (dateInfo: DateSelectArg): CalendarSelectedRange => {
  if (!dateInfo.allDay) {
    return {
      start: dateInfo.start,
      end: dateInfo.end,
      allDay: false,
    };
  }

  const { startsAt, endsAt } = getNearestHalfHourRange(new Date());

  setDateFromSelection(startsAt, dateInfo.start);

  const lastSelectedDate = new Date(dateInfo.end);
  lastSelectedDate.setDate(lastSelectedDate.getDate() - 1);

  setDateFromSelection(endsAt, lastSelectedDate);

  if (endsAt <= startsAt) {
    endsAt.setTime(startsAt.getTime() + 30 * 60 * 1000);
  }

  return {
    start: startsAt,
    end: endsAt,
    allDay: false,
  };
};

export const calendarReducer = (state: CalendarState, action: CalendarAction): CalendarState => {
  switch (action.type) {
    case CALENDAR_ACTION_TYPES.VISIBLE_RANGE_CHANGED:
      return {
        ...state,
        visibleRange: action.range,
      };
    case CALENDAR_ACTION_TYPES.CREATE_RANGE_SELECTED:
      return {
        ...state,
        selectedRange: action.selectedRange,
        isCreateDialogOpen: true,
      };
    case CALENDAR_ACTION_TYPES.CREATE_DIALOG_OPEN_CHANGED:
      return {
        ...state,
        isCreateDialogOpen: action.open,
      };
    case CALENDAR_ACTION_TYPES.EVENT_DETAILS_SELECTED:
      return {
        ...state,
        selectedEventId: action.eventId,
        isDetailsDialogOpen: true,
      };
    case CALENDAR_ACTION_TYPES.DETAILS_DIALOG_OPEN_CHANGED:
      return {
        ...state,
        isDetailsDialogOpen: action.open,
      };
    default: {
      const exhaustiveCheck: never = action satisfies never;
      return exhaustiveCheck;
    }
  }
};
