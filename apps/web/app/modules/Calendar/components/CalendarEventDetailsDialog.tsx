import { Link } from "@remix-run/react";
import { CALENDAR_EVENT_SOURCE_TYPES, LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";
import { format } from "date-fns";
import { BookOpen, CalendarCheck, CalendarClock, MapPin, Radio, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCalendarEventDetails } from "~/api/queries/calendar/useCalendarEventDetails";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

import { CALENDAR_HANDLES } from "../../../../e2e/data/live-training/handles";

import { formatEventDateRange } from "./calendarEventDetailsDialog.utils";
import { CalendarEventDetailsSkeleton } from "./CalendarEventDetailsSkeleton";
import { CalendarEventMetaRow } from "./CalendarEventMetaRow";

import type { SupportedLanguages } from "@repo/shared";
import type { ReactNode } from "react";
import type {
  CalendarEventDetails,
  CalendarEventSourceType,
  CourseDueDatePayload,
  LiveTrainingPayload,
} from "~/modules/Calendar/calendarEventDetails.types";

type CalendarEventDetailsDialogProps = {
  open: boolean;
  eventId: string | null;
  language: SupportedLanguages;
  onOpenChange: (open: boolean) => void;
};

type CalendarEventMetaRowProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
};

const getLiveTrainingPayload = (
  eventDetails?: CalendarEventDetails,
): LiveTrainingPayload | null => {
  if (!eventDetails || !("liveTraining" in eventDetails.payload)) return null;

  return eventDetails.payload.liveTraining;
};

const getCourseDueDatePayload = (
  eventDetails?: CalendarEventDetails,
): CourseDueDatePayload | null => {
  if (!eventDetails || !("courseDueDate" in eventDetails.payload)) return null;

  return eventDetails.payload.courseDueDate;
};

const formatEventDateRange = (startsAt: string, endsAt: string, allDay: boolean) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (allDay) {
    const inclusiveEnd = new Date(end);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);

    if (start.toDateString() === inclusiveEnd.toDateString()) {
      return format(start, "d MMM yyyy");
    }

    return `${format(start, "d MMM yyyy")} - ${format(inclusiveEnd, "d MMM yyyy")}`;
  }

  const isSameDay = start.toDateString() === end.toDateString();

  if (isSameDay) {
    return `${format(start, "d MMM yyyy, HH:mm")} - ${format(end, "HH:mm")}`;
  }

  return `${format(start, "d MMM yyyy, HH:mm")} - ${format(end, "d MMM yyyy, HH:mm")}`;
};

function CalendarEventMetaRow({ icon, label, value }: CalendarEventMetaRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-50 text-neutral-600">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-neutral-500">{label}</p>
        <div className="mt-0.5 text-sm text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

function CalendarEventDetailsSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  );
}

const getSourceTypeTranslationKey = (sourceType?: CalendarEventSourceType) => {
  if (sourceType === CALENDAR_EVENT_SOURCE_TYPES.COURSE_DUE_DATE) {
    return "calendarView.details.sourceType.courseDueDate";
  }

  if (sourceType === CALENDAR_EVENT_SOURCE_TYPES.LIVE_TRAINING) {
    return "calendarView.details.sourceType.liveTraining";
  }

  return "calendarView.details.description";
};

export function CalendarEventDetailsDialog({
  open,
  eventId,
  language,
  onOpenChange,
}: CalendarEventDetailsDialogProps) {
  const { t } = useTranslation();
  const { data: eventDetails, isLoading } = useCalendarEventDetails(eventId, language, {
    enabled: open && Boolean(eventId),
  });

  const liveTraining = getLiveTrainingPayload(eventDetails);
  const courseDueDate = getCourseDueDatePayload(eventDetails);
  const linkedCourses = liveTraining?.linkedCourses ?? [];
  const hosts = liveTraining?.hosts ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={CALENDAR_HANDLES.EVENT_DETAILS_DIALOG}
        className="z-[90] max-h-[88dvh] overflow-hidden p-0 sm:max-w-[620px]"
      >
        <DialogHeader className="border-b border-neutral-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4 pr-7">
            <div className="min-w-0">
              <DialogTitle className="truncate text-xl">
                {eventDetails?.sourceId && liveTraining ? (
                  <Link
                    to={`/live-training/${eventDetails.sourceId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {eventDetails.title}
                  </Link>
                ) : (
                  (eventDetails?.title ?? t("calendarView.details.title"))
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t(getSourceTypeTranslationKey(eventDetails?.sourceType))}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid max-h-[calc(88dvh-8rem)] gap-4 overflow-y-auto px-6 py-5">
          {isLoading && <CalendarEventDetailsSkeleton />}

          {!isLoading && eventDetails && liveTraining && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" fontWeight="normal">
                  {t(`calendarView.details.deliveryType.${liveTraining.deliveryType}`)}
                </Badge>
              </div>

              {eventDetails.description && (
                <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-700">
                  {eventDetails.description}
                </p>
              )}

              <div className="grid gap-3">
                <CalendarEventMetaRow
                  icon={<CalendarClock className="size-4" />}
                  label={t("calendarView.details.field.time")}
                  value={
                    <span className="grid gap-0.5">
                      <span>
                        {formatEventDateRange(
                          eventDetails.startsAt,
                          eventDetails.endsAt,
                          eventDetails.allDay,
                        )}
                      </span>
                      <span className="text-xs text-neutral-500">{eventDetails.timezone}</span>
                    </span>
                  }
                />

                <CalendarEventMetaRow
                  icon={<Radio className="size-4" />}
                  label={t("calendarView.details.field.training")}
                  value={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>
                        {t(`calendarView.details.deliveryType.${liveTraining.deliveryType}`)}
                      </span>
                    </span>
                  }
                />

                {linkedCourses.length > 0 && (
                  <CalendarEventMetaRow
                    icon={<BookOpen className="size-4" />}
                    label={t("calendarView.details.field.linkedCourses")}
                    value={
                      <div className="flex flex-wrap gap-1.5">
                        {linkedCourses.map((course) => (
                          <span
                            key={course.courseId}
                            className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                          >
                            {course.courseTitle}
                          </span>
                        ))}
                      </div>
                    }
                  />
                )}

                {liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE &&
                  eventDetails.location && (
                    <CalendarEventMetaRow
                      icon={<MapPin className="size-4" />}
                      label={t("calendarView.details.field.location")}
                      value={eventDetails.location}
                    />
                  )}

                <CalendarEventMetaRow
                  icon={<Users className="size-4" />}
                  label={t("calendarView.details.field.people")}
                  value={
                    <div className="grid gap-1">
                      <span>
                        {t("calendarView.details.author", {
                          name:
                            liveTraining.author.fullName ||
                            liveTraining.author.email ||
                            t("calendarView.details.unknown"),
                        })}
                      </span>
                      <span
                        className={cn("text-neutral-600", {
                          "text-neutral-400": hosts.length === 0,
                        })}
                      >
                        {hosts.length
                          ? t("calendarView.details.hosts", { count: hosts.length })
                          : t("calendarView.details.noHosts")}
                      </span>
                    </div>
                  }
                />
              </div>

              <div className="border-t border-neutral-200 pt-4">
                <Button
                  asChild
                  className="w-full gap-2"
                  data-testid={CALENDAR_HANDLES.EVENT_DETAILS_GO_TO_LIVE_TRAINING}
                >
                  <Link to={`/live-training/${eventDetails.sourceId}`}>
                    {t("calendarView.details.action.goToLiveTraining")}
                  </Link>
                </Button>
              </div>
            </>
          )}

          {!isLoading && eventDetails && courseDueDate && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" fontWeight="normal">
                  {t(`calendarView.details.status.${eventDetails.status}`)}
                </Badge>
                <Badge variant="secondary" fontWeight="normal">
                  {t("calendarView.details.sourceType.courseDueDate")}
                </Badge>
              </div>

              <div className="grid gap-3">
                <CalendarEventMetaRow
                  icon={<CalendarCheck className="size-4" />}
                  label={t("calendarView.details.field.dueDate")}
                  value={
                    <span className="grid gap-0.5">
                      <span>
                        {formatEventDateRange(
                          eventDetails.startsAt,
                          eventDetails.endsAt,
                          eventDetails.allDay,
                        )}
                      </span>
                      <span className="text-xs text-neutral-500">{eventDetails.timezone}</span>
                    </span>
                  }
                />

                <CalendarEventMetaRow
                  icon={<BookOpen className="size-4" />}
                  label={t("calendarView.details.field.course")}
                  value={courseDueDate.courseTitle}
                />

                <CalendarEventMetaRow
                  icon={<Users className="size-4" />}
                  label={t("calendarView.details.field.group")}
                  value={courseDueDate.groupName}
                />
              </div>

              <div className="border-t border-neutral-200 pt-4">
                <Button asChild className="w-full gap-2">
                  <Link to={`/course/${courseDueDate.courseId}`}>
                    {t("calendarView.details.action.goToCourse")}
                  </Link>
                </Button>
              </div>
            </>
          )}

          {!isLoading && eventDetails && courseDueDate && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" fontWeight="normal">
                  {t(`calendarView.details.status.${eventDetails.status}`)}
                </Badge>
                <Badge variant="secondary" fontWeight="normal">
                  {t("calendarView.details.sourceType.courseDueDate")}
                </Badge>
              </div>

              <div className="grid gap-3">
                <CalendarEventMetaRow
                  icon={<CalendarCheck className="size-4" />}
                  label={t("calendarView.details.field.dueDate")}
                  value={
                    <span className="grid gap-0.5">
                      <span>
                        {formatEventDateRange(
                          eventDetails.startsAt,
                          eventDetails.endsAt,
                          eventDetails.allDay,
                        )}
                      </span>
                      <span className="text-xs text-neutral-500">{eventDetails.timezone}</span>
                    </span>
                  }
                />

                <CalendarEventMetaRow
                  icon={<BookOpen className="size-4" />}
                  label={t("calendarView.details.field.course")}
                  value={courseDueDate.courseTitle}
                />

                <CalendarEventMetaRow
                  icon={<Users className="size-4" />}
                  label={t("calendarView.details.field.group")}
                  value={courseDueDate.groupName}
                />
              </div>

              <div className="border-t border-neutral-200 pt-4">
                <Button asChild className="w-full gap-2">
                  <Link to={`/course/${courseDueDate.courseId}`}>
                    {t("calendarView.details.action.goToCourse")}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
