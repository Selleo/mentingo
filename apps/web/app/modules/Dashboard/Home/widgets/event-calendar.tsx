import { Link } from "@remix-run/react";
import {
  CALENDAR_EVENT_SOURCE_TYPES,
  DASHBOARD_CALENDAR_VIEWS,
  DASHBOARD_WIDGET_TYPES,
} from "@repo/shared";
import { endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { SquareArrowRightEnter } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDashboardEventCalendar } from "~/api/queries/useDashboardEventCalendar";
import { Calendar } from "~/components/ui/calendar";
import { Separator } from "~/components/ui/separator";
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
  showDateIcon?: boolean;
  openDialog: (eventId: string) => void;
};

function CalendarEventList({
  events,
  highlighted = false,
  showDateIcon = false,
  openDialog,
}: CalendarEventListProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const startsAt = new Date(event.startsAt);
        const eventType = t(
          event.sourceType === CALENDAR_EVENT_SOURCE_TYPES.LIVE_TRAINING
            ? "dashboardHome.widgets.event_calendar.liveTraining"
            : "dashboardHome.widgets.event_calendar.courseDeadline",
        );

        return (
          <button
            key={event.id}
            type="button"
            onClick={() => openDialog(event.id)}
            className={cn(
              "w-full rounded-lg border border-neutral-100 p-3 text-left transition-colors hover:border-primary-200 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2",
              highlighted && "bg-primary-50",
              showDateIcon && "flex items-start gap-3",
            )}
          >
            {showDateIcon && (
              <span
                className="flex size-11 shrink-0 flex-col overflow-hidden rounded-lg border border-primary-200 bg-white text-center shadow-sm"
                aria-hidden="true"
              >
                <span className="bg-primary-700 px-1 py-0.5 text-[9px] font-semibold uppercase leading-3 tracking-wide text-white">
                  {new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(startsAt)}
                </span>
                <span className="flex flex-1 items-center justify-center text-sm font-semibold text-neutral-950">
                  {new Intl.DateTimeFormat(i18n.language, { day: "numeric" }).format(startsAt)}
                </span>
              </span>
            )}
            <span className="min-w-0 flex-1">
              {showDateIcon && (
                <span className="block text-[10px] font-semibold uppercase leading-4 tracking-wide text-neutral-500">
                  {eventType}
                </span>
              )}
              <span
                className={cn("body-sm-md block text-neutral-950", {
                  "mt-0.5 line-clamp-2": showDateIcon,
                  "line-clamp-1": !showDateIcon,
                })}
              >
                {event.title}
              </span>
              {!showDateIcon && (
                <span className="details mt-0.5 block truncate text-neutral-500">
                  {eventType}
                  {" · "}
                  {new Intl.DateTimeFormat(i18n.language, {
                    day: "numeric",
                    month: "short",
                    hour: event.allDay ? undefined : "2-digit",
                    minute: event.allDay ? undefined : "2-digit",
                  }).format(startsAt)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function WidgetEventCalendar() {
  const { t, i18n } = useTranslation();

  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [eventDialogOpen, setEventDialogOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const language = useLanguageStore((state) => state.language);

  const currentYear = new Date().getFullYear();
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
  const metadata = DASHBOARD_WIDGET_REGISTRY[DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR];

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
      <DashboardWidgetCard testId={DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR} className="w-full">
        <DashboardWidgetHeader
          title={t(metadata.titleKey)}
          icon={metadata.icon}
          iconClassName={metadata.iconClassName}
          iconContainerClassName={metadata.iconContainerClassName}
          headerAction={
            <Link
              to="/calendar"
              className="inline-flex size-8 items-center justify-center rounded-md text-neutral-500 transition-[color,transform] duration-75 hover:text-primary-700 active:scale-95 active:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1 motion-reduce:transition-none"
              aria-label={t("navigationSideBar.calendar")}
              title={t("navigationSideBar.calendar")}
            >
              <SquareArrowRightEnter className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        <DashboardWidgetContent className="!overflow-y-hidden grid grid-cols-[minmax(0,3fr)_1px_minmax(0,2fr)] items-stretch">
          {isAllEventsLoading || isAllEventsError ? (
            <div>
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
                className="h-full min-w-0 !w-full max-w-none overflow-hidden p-2"
                classNames={{
                  months: "h-full w-full",
                  month:
                    "flex h-full w-full flex-col rounded-none border-0 bg-transparent p-0 shadow-none",
                  caption: "relative flex h-8 shrink-0 items-center justify-center",
                  caption_dropdowns: "order-2 flex items-center justify-center gap-1",
                  nav_button:
                    "inline-flex size-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-neutral-500 shadow-none hover:bg-neutral-100 hover:text-neutral-950",
                  nav_button_previous: "absolute left-0 top-0.5",
                  nav_button_next: "absolute right-0 top-0.5",
                  table: "flex min-h-0 flex-1 flex-col pt-3",
                  head_row: "flex h-6 w-full shrink-0 items-center",
                  head_cell: "flex-1 text-center text-[0.7rem] font-medium text-neutral-500",
                  tbody: "grid min-h-0 flex-1 grid-rows-6",
                  row: "flex min-h-0 w-full",
                  cell: "min-h-0 flex-1 p-0 text-center text-xs",
                  day: "h-full w-full p-0 text-xs",
                }}
              />
              <Separator orientation="vertical" className="h-full" />
              <div className="min-h-0 min-w-0 self-stretch overflow-y-auto p-2">
                {selectedEvents.length > 0 && (
                  <section className="mb-4">
                    <h3 className="body-sm-md mb-2 flex h-8 items-center text-neutral-950">
                      {t("dashboardHome.widgets.event_calendar.selectedDay")}
                    </h3>
                    <CalendarEventList
                      events={selectedEvents}
                      highlighted
                      showDateIcon
                      openDialog={openEventDialog}
                    />
                  </section>
                )}
                <section>
                  <h3 className="body-sm-md mb-2 flex h-8 items-center text-neutral-950">
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
                    <CalendarEventList
                      events={upcomingEvents}
                      showDateIcon
                      openDialog={openEventDialog}
                    />
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
