import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { redirect } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";

import { currentUserQueryOptions } from "~/api/queries";
import { useCalendarEvents } from "~/api/queries/calendar/useCalendarEvents";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";
import { setPageTitle } from "~/utils/setPageTitle";

import calendarStyles from "./calendar.css?url";
import {
  CALENDAR_ACTION_TYPES,
  calendarReducer,
  getSelectedRangeFromDateClick,
  getSelectedRangeFromSelection,
  getVisibleRangeFromDatesSet,
  initialCalendarState,
} from "./calendar.reducer";
import { CalendarCreateLiveTrainingDialog } from "./components/CalendarCreateLiveTrainingDialog";
import { CalendarEventDetailsDialog } from "./components/CalendarEventDetailsDialog";

import type { DatesSetArg, DateSelectArg, EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { LinksFunction, MetaFunction } from "@remix-run/node";
import type { ClientLoaderFunctionArgs } from "@remix-run/react";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: calendarStyles }];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.calendar");

const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const clientLoader = async ({ request }: ClientLoaderFunctionArgs) => {
  const currentUserResponse = await queryClient.ensureQueryData(currentUserQueryOptions);

  const currentUser = currentUserResponse?.data;

  if (!currentUser) {
    saveEntryToNavigationHistory(request);
    throw redirect("/auth/login");
  }

  const canReadCalendar = hasPermission(currentUser.permissions, PERMISSIONS.CALENDAR_READ);

  if (!canReadCalendar) {
    throw redirect("/");
  }

  return null;
};

export default function CalendarPage() {
  const { t } = useTranslation();
  const [calendarState, dispatchCalendarAction] = useReducer(calendarReducer, initialCalendarState);

  const language = useLanguageStore((state) => state.language);
  const { data: globalSettings } = useGlobalSettings();
  const { hasAccess: hasLiveTrainingCreateAccess } = usePermissions({
    required: PERMISSIONS.LIVE_TRAINING_CREATE,
  });
  const timezone = useMemo(() => getBrowserTimezone(), []);
  const canCreateLiveTraining =
    Boolean(globalSettings?.liveTrainingEnabled) && hasLiveTrainingCreateAccess;
  const visibleRange = calendarState.visibleRange;

  const { data: events = [] } = useCalendarEvents(
    {
      start: visibleRange?.start,
      end: visibleRange?.end,
      language,
      timezone,
    },
    { enabled: Boolean(visibleRange?.start && visibleRange?.end) },
  );

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startsAt,
        end: event.endsAt,
        allDay: event.allDay,
        classNames: [`calendar-event--${event.sourceType}`, `calendar-event--${event.status}`],
        extendedProps: {
          sourceId: event.sourceId,
          sourceType: event.sourceType,
          status: event.status,
        },
      })),
    [events],
  );

  const handleDatesSet = (dateInfo: DatesSetArg) => {
    dispatchCalendarAction({
      type: CALENDAR_ACTION_TYPES.VISIBLE_RANGE_CHANGED,
      range: getVisibleRangeFromDatesSet(dateInfo),
    });
  };

  const handleDateClick = (dateInfo: DateClickArg) => {
    dispatchCalendarAction({
      type: CALENDAR_ACTION_TYPES.CREATE_RANGE_SELECTED,
      selectedRange: getSelectedRangeFromDateClick(dateInfo),
    });
  };

  const handleSelect = (dateInfo: DateSelectArg) => {
    dispatchCalendarAction({
      type: CALENDAR_ACTION_TYPES.CREATE_RANGE_SELECTED,
      selectedRange: getSelectedRangeFromSelection(dateInfo),
    });
  };

  const handleEventClick = (eventInfo: EventClickArg) => {
    dispatchCalendarAction({
      type: CALENDAR_ACTION_TYPES.EVENT_DETAILS_SELECTED,
      eventId: eventInfo.event.id,
    });
  };

  return (
    <PageWrapper
      isBarebones
      className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-neutral-50/50 p-4 md:p-6 2xl:h-dvh 3xl:p-8"
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="calendar-shell min-h-0 flex-1">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={calendarEvents}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={handleEventClick}
            selectable
            selectMirror
            unselectAuto
            height="100%"
            expandRows
            firstDay={1}
            locale={language}
            timeZone="local"
            nowIndicator
            dayMaxEvents={3}
            displayEventTime={false}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{
              today: t("calendarView.today"),
              month: t("calendarView.view.monthShort"),
              week: t("calendarView.view.weekShort"),
              day: t("calendarView.view.dayShort"),
            }}
            buttonHints={{
              today: t("calendarView.today"),
              dayGridMonth: t("calendarView.view.month"),
              timeGridWeek: t("calendarView.view.week"),
              timeGridDay: t("calendarView.view.day"),
            }}
            allDayText=""
            noEventsText={t("calendarView.empty")}
          />
        </div>
      </section>
      <CalendarCreateLiveTrainingDialog
        open={calendarState.isCreateDialogOpen}
        selectedRange={calendarState.selectedRange}
        timezone={timezone}
        canCreateLiveTraining={canCreateLiveTraining}
        onOpenChange={(open) =>
          dispatchCalendarAction({
            type: CALENDAR_ACTION_TYPES.CREATE_DIALOG_OPEN_CHANGED,
            open,
          })
        }
      />
      <CalendarEventDetailsDialog
        open={calendarState.isDetailsDialogOpen}
        eventId={calendarState.selectedEventId}
        language={language}
        onOpenChange={(open) =>
          dispatchCalendarAction({
            type: CALENDAR_ACTION_TYPES.DETAILS_DIALOG_OPEN_CHANGED,
            open,
          })
        }
      />
    </PageWrapper>
  );
}
