import {
  CALENDAR_EVENT_SOURCE_TYPES,
  DASHBOARD_CALENDAR_VIEWS,
  DASHBOARD_WIDGET_IDS,
} from "@repo/shared";
import { endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDashboardEventCalendar } from "~/api/queries/useDashboardEventCalendar";
import { Calendar } from "~/components/ui/calendar";
import { cn } from "~/lib/utils";
import { CalendarEventDetailsDialog } from "~/modules/Calendar/components/CalendarEventDetailsDialog";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDateLocale } from "~/utils/getDateLocale";

import { DASHBOARD_WIDGET_HANDLES } from "../../../../../e2e/data/dashboard/handles";
import { DashboardWidgetQueryState } from "../components/DashboardWidgetQueryState";
import {
  DashboardWidgetCard,
  DashboardWidgetContent,
  DashboardWidgetHeader,
} from "../components/WidgetCard";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import type { GetDashboardEventsResponse } from "~/api/generated-api";

type CalendarEvent = GetDashboardEventsResponse["data"][number];

type CalendarEventListProps = {
  events: CalendarEvent[];
  highlighted?: boolean;
  openDialog: (eventId: string) => void;
};

function CalendarEventList({ events, highlighted = false, openDialog }: CalendarEventListProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => openDialog(event.id)}
          className={cn(
            "block w-full text-left rounded-lg border border-neutral-100 p-3 transition-colors hover:border-primary-200 hover:bg-primary-50",
            highlighted && "bg-primary-50",
          )}
        >
          <p className="body-sm-md line-clamp-1 text-neutral-950">{event.title}</p>
          <p className="details mt-0.5 text-neutral-500">
            {t(
              event.sourceType === CALENDAR_EVENT_SOURCE_TYPES.LIVE_TRAINING
                ? "dashboardHome.widgets.event_calendar.liveTraining"
                : "dashboardHome.widgets.event_calendar.courseDeadline",
            )}
            {" · "}
            {new Intl.DateTimeFormat(i18n.language, {
              day: "numeric",
              month: "short",
              hour: event.allDay ? undefined : "2-digit",
              minute: event.allDay ? undefined : "2-digit",
            }).format(new Date(event.startsAt))}
          </p>
        </button>
      ))}
    </div>
  );
}

export function WidgetAdminEventCalendar() {
  const { t, i18n } = useTranslation();
  const [eventDialogOpen, setEventDialogOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const language = useLanguageStore((state) => state.language);
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const rangeStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const rangeEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const {
    data: events = [],
    isLoading: isAllEventsLoading,
    isError: isAllEventsError,
    refetch: refetchAllEvents,
  } = useDashboardEventCalendar({
    start: rangeStart.toISOString(),
    end: rangeEnd.toISOString(),
    language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    view: DASHBOARD_CALENDAR_VIEWS.ALL,
  });
  const {
    data: upcomingEvents = [],
    isError: isUpcomingEventsError,
    refetch: refetchUpcomingEvents,
  } = useDashboardEventCalendar({
    start: rangeStart.toISOString(),
    end: rangeEnd.toISOString(),
    language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    view: DASHBOARD_CALENDAR_VIEWS.UPCOMING,
    selectedDate: format(selectedDay, "yyyy-MM-dd"),
  });
  const selectedEvents = events.filter((event) => isSameDay(new Date(event.startsAt), selectedDay));
  const eventDays = useMemo(() => events.map((event) => new Date(event.startsAt)), [events]);
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_IDS.ADMIN_EVENT_CALENDAR];

  function openEventDialog(eventId: string) {
    setSelectedEvent(eventId);
    setEventDialogOpen(true);
  }

  function closeEventDialog() {
    setEventDialogOpen(false);
    setSelectedEvent(null);
  }

  return (
    <>
      <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR}>
        <DashboardWidgetHeader
          title={t(metadata.titleKey)}
          icon={metadata.icon}
          iconClassName={metadata.iconClassName}
          iconContainerClassName={metadata.iconContainerClassName}
        />
        <DashboardWidgetContent className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)] lg:overflow-hidden px-5 pb-5 md:px-6 md:pb-6">
          {isAllEventsLoading || isAllEventsError ? (
            <div className="lg:col-span-2">
              <DashboardWidgetQueryState
                isLoading={isAllEventsLoading}
                isError={isAllEventsError}
                onRetry={() => void refetchAllEvents()}
              />
            </div>
          ) : (
            <>
              <Calendar
                variant="default"
                mode="single"
                captionLayout="dropdown-buttons"
                fromYear={currentYear - 5}
                toYear={currentYear + 5}
                month={month}
                onMonthChange={(nextMonth) => setMonth(startOfMonth(nextMonth))}
                selected={selectedDay}
                onSelect={(day) => {
                  if (day) setSelectedDay(day);
                }}
                showOutsideDays
                fixedWeeks
                weekStartsOn={1}
                locale={getDateLocale(i18n.language)}
                modifiers={{ hasEvents: eventDays }}
                modifiersClassNames={{
                  hasEvents:
                    "bg-primary-50 hover:bg-primary-100 aria-selected:bg-primary-700 aria-selected:!text-white aria-selected:hover:bg-primary-600",
                }}
                labels={{
                  labelPrevious: () => t("dashboardHome.widgets.event_calendar.previousMonth"),
                  labelNext: () => t("dashboardHome.widgets.event_calendar.nextMonth"),
                  labelMonthDropdown: () => t("dashboardHome.widgets.event_calendar.selectMonth"),
                  labelYearDropdown: () => t("dashboardHome.widgets.event_calendar.selectYear"),
                }}
                className="mx-auto w-full max-w-none"
                classNames={{
                  months: "w-full",
                  month: "w-full space-y-4 rounded-none border-0 bg-transparent p-0 shadow-none",
                  caption: "relative flex items-center justify-center pt-1",
                  caption_dropdowns: "order-2 flex items-center justify-center gap-2",
                  dropdown_month: "order-1 w-auto max-w-[8rem]",
                  dropdown_year: "order-2 w-auto max-w-[6rem]",
                  nav_button_previous: "absolute left-0",
                  nav_button_next: "absolute right-0",
                }}
              />
              <div className="max-h-52 min-h-0 overflow-y-auto border-t pt-4 lg:max-h-none lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:[contain:size]">
                {selectedEvents.length > 0 && (
                  <section className="mb-5">
                    <h3 className="body-sm-md mb-3 text-neutral-950">
                      {t("dashboardHome.widgets.event_calendar.selectedDay")}
                    </h3>
                    <CalendarEventList
                      events={selectedEvents}
                      highlighted
                      openDialog={openEventDialog}
                    />
                  </section>
                )}
                <section>
                  <h3 className="body-sm-md mb-3 text-neutral-950">
                    {t("dashboardHome.widgets.event_calendar.upcoming")}
                  </h3>
                  {isUpcomingEventsError ? (
                    <DashboardWidgetQueryState
                      isLoading={false}
                      isError
                      onRetry={() => void refetchUpcomingEvents()}
                    />
                  ) : upcomingEvents.length === 0 ? (
                    <p className="text-neutral-500">
                      {t("dashboardHome.widgets.event_calendar.empty")}
                    </p>
                  ) : (
                    <CalendarEventList events={upcomingEvents} openDialog={openEventDialog} />
                  )}
                </section>
              </div>
            </>
          )}
        </DashboardWidgetContent>
      </DashboardWidgetCard>
      <CalendarEventDetailsDialog
        open={eventDialogOpen}
        onOpenChange={closeEventDialog}
        eventId={selectedEvent}
        language={language}
      />
    </>
  );
}
