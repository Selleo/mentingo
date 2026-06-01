import { Link } from "@remix-run/react";
import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";
import { BookOpen, CalendarClock, MapPin, Radio, Users } from "lucide-react";
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
import { cn } from "~/lib/utils";

import { CALENDAR_HANDLES } from "../../../../e2e/data/live-training/handles";

import { formatEventDateRange } from "./calendarEventDetailsDialog.utils";
import { CalendarEventDetailsSkeleton } from "./CalendarEventDetailsSkeleton";
import { CalendarEventMetaRow } from "./CalendarEventMetaRow";

import type { SupportedLanguages } from "@repo/shared";

type CalendarEventDetailsDialogProps = {
  open: boolean;
  eventId: string | null;
  language: SupportedLanguages;
  onOpenChange: (open: boolean) => void;
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

  const liveTraining = eventDetails?.payload.liveTraining;
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
                {t("calendarView.details.sourceType.liveTraining")}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
