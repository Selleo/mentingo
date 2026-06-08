import { Link } from "@remix-run/react";
import { BookOpen, CalendarClock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { CALENDAR_HANDLES } from "../../../../e2e/data/live-training/handles";

import { formatEventDateRange } from "./calendarEventDetailsDialog.utils";
import { CalendarEventMetaRow } from "./CalendarEventMetaRow";

import type { CourseDueDateCalendarEventDetails } from "../calendarEventDetails.types";

type CalendarCourseDueDateEventDetailsDialogProps = {
  open: boolean;
  eventDetails: CourseDueDateCalendarEventDetails;
  onOpenChange: (open: boolean) => void;
};

export function CalendarCourseDueDateEventDetailsDialog({
  open,
  eventDetails,
  onOpenChange,
}: CalendarCourseDueDateEventDetailsDialogProps) {
  const { t } = useTranslation();
  const courseDueDate = eventDetails.payload.courseDueDate;

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
                <Link
                  to={`/course/${courseDueDate.courseId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {eventDetails.title}
                </Link>
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t("calendarView.details.sourceType.courseDueDate")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid max-h-[calc(88dvh-8rem)] gap-4 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" fontWeight="normal">
              {t("calendarView.details.sourceType.courseDueDate")}
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
              value={
                <Link
                  to={`/course/${courseDueDate.courseId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {courseDueDate.courseTitle}
                </Link>
              }
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
