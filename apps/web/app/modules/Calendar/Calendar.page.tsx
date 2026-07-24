import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { redirect } from "@remix-run/react";
import { CALENDAR_EVENT_SOURCE_TYPES, PERMISSIONS } from "@repo/shared";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useSyncMicrosoftCalendar } from "~/api/mutations/calendar/useSyncMicrosoftCalendar";
import { currentUserQueryOptions } from "~/api/queries";
import { useCalendarEvents } from "~/api/queries/calendar/useCalendarEvents";
import { useMicrosoftCalendarConnection } from "~/api/queries/calendar/useMicrosoftCalendarConnection";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";
import { setPageTitle } from "~/utils/setPageTitle";

import { CALENDAR_HANDLES } from "../../../e2e/data/live-training/handles";

import calendarStyles from "./calendar.css?url";
import {
  CALENDAR_ACTION_TYPES,
  calendarReducer,
  getSelectedRangeFromDateClick,
  getSelectedRangeFromSelection,
  getVisibleRangeFromDatesSet,
  initialCalendarState,
} from "./calendar.reducer";
import { CALENDAR_VIEWS, useCalendarViewStore } from "./calendarView.store";
import { CalendarCreateLiveTrainingDialog } from "./components/CalendarCreateLiveTrainingDialog";
import { CalendarEventDetailsDialog } from "./components/CalendarEventDetailsDialog";

import type {
  DayCellMountArg,
  DatesSetArg,
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventInput,
  EventMountArg,
} from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { LinksFunction, MetaFunction } from "@remix-run/node";
import type { ClientLoaderFunctionArgs } from "@remix-run/react";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: calendarStyles }];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.calendar");

const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const getFullCalendarView = (view: (typeof CALENDAR_VIEWS)[keyof typeof CALENDAR_VIEWS]) => {
  switch (view) {
    case CALENDAR_VIEWS.WEEK:
      return "timeGridWeek" as const;
    case CALENDAR_VIEWS.DAY:
      return "timeGridDay" as const;
    case CALENDAR_VIEWS.MONTH:
      return "dayGridMonth" as const;
  }
};

const getCalendarView = (viewType: string) => {
  switch (viewType) {
    case "timeGridWeek":
      return CALENDAR_VIEWS.WEEK;
    case "timeGridDay":
      return CALENDAR_VIEWS.DAY;
    default:
      return CALENDAR_VIEWS.MONTH;
  }
};

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
  const calendarRef = useRef<FullCalendar>(null);

  const language = useLanguageStore((state) => state.language);
  const { view: calendarView, setView: setCalendarView } = useCalendarViewStore();

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    const nextView = getFullCalendarView(calendarView);
    if (api && api.view.type !== nextView) api.changeView(nextView);
  }, [calendarView]);
  const { data: globalSettings } = useGlobalSettings();
  const { data: microsoftConnection } = useMicrosoftCalendarConnection();
  const { mutateAsync: syncCalendar, isPending: isSyncPending } = useSyncMicrosoftCalendar();
  const { hasAccess: hasLiveTrainingCreateAccess } = usePermissions({
    required: PERMISSIONS.LIVE_TRAINING_CREATE,
  });
  const timezone = useMemo(() => getBrowserTimezone(), []);
  const canCreateLiveTraining =
    Boolean(globalSettings?.liveTrainingEnabled) && hasLiveTrainingCreateAccess;
  const canSyncMicrosoftCalendar =
    microsoftConnection?.status === "connected" || microsoftConnection?.status === "syncing";
  const visibleRange = calendarState.visibleRange;
  const showHorizonNotice = useMemo(() => {
    if (!visibleRange || microsoftConnection?.status === "disconnected") return false;
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - 30);
    const horizonEnd = new Date();
    horizonEnd.setMonth(horizonEnd.getMonth() + 6);
    return (
      Date.parse(visibleRange.start) < historyStart.getTime() ||
      Date.parse(visibleRange.end) > horizonEnd.getTime()
    );
  }, [microsoftConnection?.status, visibleRange]);

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
    setCalendarView(getCalendarView(dateInfo.view.type));
    dispatchCalendarAction({
      type: CALENDAR_ACTION_TYPES.VISIBLE_RANGE_CHANGED,
      range: getVisibleRangeFromDatesSet(dateInfo),
    });
  };

  const handleDateClick = (dateInfo: DateClickArg) => {
    if (!canCreateLiveTraining) return;

    dispatchCalendarAction({
      type: CALENDAR_ACTION_TYPES.CREATE_RANGE_SELECTED,
      selectedRange: getSelectedRangeFromDateClick(dateInfo),
    });
  };

  const handleSelect = (dateInfo: DateSelectArg) => {
    if (!canCreateLiveTraining) return;

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

  const handleDayCellDidMount = (dayCellInfo: DayCellMountArg) => {
    dayCellInfo.el.dataset.testid = CALENDAR_HANDLES.dayCell(dayCellInfo.dateStr);
  };

  const handleEventDidMount = (eventInfo: EventMountArg) => {
    eventInfo.el.dataset.testid = CALENDAR_HANDLES.event(eventInfo.event.id);
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    const sourceType = eventInfo.event.extendedProps.sourceType as string;
    const isOutlook = sourceType === CALENDAR_EVENT_SOURCE_TYPES.MICROSOFT_OUTLOOK;
    let sourceLabelKey = "calendarView.details.sourceType.courseDueDate";
    if (sourceType === CALENDAR_EVENT_SOURCE_TYPES.LIVE_TRAINING) {
      sourceLabelKey = "calendarView.details.sourceType.liveTraining";
    }
    if (isOutlook) {
      sourceLabelKey = "calendarView.details.sourceType.microsoftOutlook";
    }
    const sourceLabel = t(sourceLabelKey);

    return (
      <span className="flex min-w-0 items-center gap-1.5">
        {isOutlook && (
          <span className="calendar-event__microsoft-badge" aria-hidden="true">
            <Icon name="Microsoft" className="size-2.5" />
          </span>
        )}
        <span className="sr-only">{sourceLabel}: </span>
        <span className="truncate">{eventInfo.event.title}</span>
      </span>
    );
  };

  return (
    <PageWrapper
      isBarebones
      className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-neutral-50/50 p-4 md:p-6 2xl:h-dvh 3xl:p-8"
      data-testid={CALENDAR_HANDLES.PAGE}
    >
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-neutral-600"
            data-testid={CALENDAR_HANDLES.SOURCE_LEGEND}
            aria-label={t("calendarView.legend.label")}
          >
            <span className="font-semibold text-neutral-800">{t("calendarView.legend.label")}</span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary-700" />
              {t("calendarView.details.sourceType.liveTraining")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-warning-600" />
              {t("calendarView.details.sourceType.courseDueDate")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-[#0078d4]" />
              {t("calendarView.details.sourceType.microsoftOutlook")}
            </span>
          </div>
          {canSyncMicrosoftCalendar && (
            <Button
              variant="outline"
              disabled={microsoftConnection?.status === "syncing" || isSyncPending}
              onClick={() => syncCalendar()}
              data-testid={CALENDAR_HANDLES.MICROSOFT_CALENDAR_SYNC}
            >
              <RefreshCw
                className={cn(
                  "mr-2 size-4",
                  (microsoftConnection?.status === "syncing" || isSyncPending) && "animate-spin",
                )}
                aria-hidden="true"
              />
              {t("microsoftCalendar.action.sync")}
            </Button>
          )}
        </div>

        {microsoftConnection?.stale && (
          <div
            role="status"
            className="rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-950"
            data-testid={CALENDAR_HANDLES.STALE_WARNING}
          >
            {t("calendarView.microsoft.staleWarning")}
          </div>
        )}

        {showHorizonNotice && (
          <div
            role="status"
            className="rounded-md border border-[#0078d4]/20 bg-[#f5faff] px-3 py-2 text-sm text-[#004578]"
            data-testid={CALENDAR_HANDLES.HORIZON_NOTICE}
          >
            {t("calendarView.microsoft.horizonNotice")}
          </div>
        )}

        <div className="calendar-shell min-h-0 flex-1">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={getFullCalendarView(calendarView)}
            events={calendarEvents}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={handleEventClick}
            dayCellDidMount={handleDayCellDidMount}
            eventDidMount={handleEventDidMount}
            eventContent={renderEventContent}
            selectable={canCreateLiveTraining}
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
