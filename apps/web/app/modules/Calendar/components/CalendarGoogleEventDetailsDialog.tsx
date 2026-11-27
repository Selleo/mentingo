import { CALENDAR_EVENT_STATUSES } from "@repo/shared";
import { CalendarClock, ExternalLink, MapPin, Shield, Signal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
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

import type { GoogleCalendarEventDetails } from "../calendarEventDetails.types";

type CalendarGoogleEventDetailsDialogProps = {
  open?: boolean;
  eventDetails: GoogleCalendarEventDetails;
  onOpenChange?: (open: boolean) => void;
  insideDialog?: boolean;
};

export function CalendarGoogleEventDetailsDialog({
  open,
  eventDetails,
  onOpenChange,
  insideDialog = false,
}: CalendarGoogleEventDetailsDialogProps) {
  const { t } = useTranslation();
  const googleCalendar = eventDetails.payload.googleCalendar;

  const content = (
    <>
      <DialogHeader className="border-b border-[#188038]/20 bg-[#f3faf5] px-6 py-5">
        <div className="flex items-start gap-3 pr-7">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-[#188038]/15">
            <Icon name="Google" className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="truncate text-xl">{eventDetails.title}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("calendarView.details.sourceType.googleCalendar")}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="grid max-h-[calc(88dvh-8rem)] gap-4 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-[#188038] text-white" fontWeight="normal">
            {t("calendarView.details.sourceType.googleCalendar")}
          </Badge>
          <Badge variant="outline" fontWeight="normal">
            {t(`calendarView.details.availability.${googleCalendar.availability}`)}
          </Badge>
          {eventDetails.status === CALENDAR_EVENT_STATUSES.CANCELLED && (
            <Badge variant="outline" className="border-neutral-300 text-neutral-600">
              {t("calendarView.details.status.cancelled")}
            </Badge>
          )}
        </div>

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
            icon={<Signal className="size-4" />}
            label={t("calendarView.details.field.availability")}
            value={t(`calendarView.details.availability.${googleCalendar.availability}`)}
          />

          {eventDetails.location && (
            <CalendarEventMetaRow
              icon={<MapPin className="size-4" />}
              label={t("calendarView.details.field.location")}
              value={eventDetails.location}
            />
          )}

          {googleCalendar.isSensitive && (
            <CalendarEventMetaRow
              icon={<Shield className="size-4" />}
              label={t("calendarView.details.field.privacy")}
              value={t("calendarView.details.privateEvent")}
            />
          )}
        </div>

        {googleCalendar.webLink && (
          <div className="border-t border-neutral-200 pt-4">
            <Button
              asChild
              className="w-full gap-2 bg-[#188038] hover:bg-[#137333]"
              data-testid={CALENDAR_HANDLES.EVENT_DETAILS_OPEN_GOOGLE_CALENDAR}
            >
              <a href={googleCalendar.webLink} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                {t("calendarView.details.action.openGoogleCalendar")}
              </a>
            </Button>
          </div>
        )}
      </div>
    </>
  );

  if (insideDialog) return content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={CALENDAR_HANDLES.EVENT_DETAILS_DIALOG}
        className="z-[90] max-h-[88dvh] overflow-hidden p-0 sm:max-w-[620px]"
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
