import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCalendarEvents } from "~/api/queries/calendar/useCalendarEvents";
import { PageWrapper } from "~/components/PageWrapper";
import { isSupportedLanguage } from "~/utils/browser-language";
import { setPageTitle } from "~/utils/setPageTitle";

import calendarStyles from "./calendar.css?url";

import type { DatesSetArg, EventInput } from "@fullcalendar/core";
import type { LinksFunction, MetaFunction } from "@remix-run/node";
import type { SupportedLanguages } from "@repo/shared";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: calendarStyles }];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.calendar");

type CalendarRange = {
  start: string;
  end: string;
};

const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const resolveLanguage = (language: string): SupportedLanguages => {
  if (isSupportedLanguage(language)) return language;

  const baseLanguage = language.split("-")[0];
  if (isSupportedLanguage(baseLanguage)) return baseLanguage;

  return SUPPORTED_LANGUAGES.EN;
};

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<CalendarRange>();

  const language = resolveLanguage(i18n.language);
  const timezone = useMemo(() => getBrowserTimezone(), []);

  const { data: events = [] } = useCalendarEvents(
    {
      start: range?.start,
      end: range?.end,
      language,
      timezone,
    },
    { enabled: Boolean(range?.start && range?.end) },
  );

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startsAt,
        end: event.endsAt,
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
    setRange({
      start: dateInfo.startStr,
      end: dateInfo.endStr,
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
            height="100%"
            expandRows
            firstDay={1}
            locale={language}
            timeZone={timezone}
            nowIndicator
            dayMaxEvents={3}
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
    </PageWrapper>
  );
}
