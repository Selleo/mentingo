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

import type { OutlookCalendarEventDetails } from "../calendarEventDetails.types";

type CalendarOutlookEventDetailsDialogProps = {
  open?: boolean;
  eventDetails: OutlookCalendarEventDetails;
  onOpenChange?: (open: boolean) => void;
  insideDialog?: boolean;
};

export function CalendarOutlookEventDetailsDialog({
  open,
  eventDetails,
  onOpenChange,
  insideDialog = false,
}: CalendarOutlookEventDetailsDialogProps) {
  const { t } = useTranslation();
  const outlook = eventDetails.payload.outlookCalendar;

  const content = (
    <>
      <DialogHeader className="border-b border-[#0078d4]/20 bg-[#f5faff] px-6 py-5">
        <div className="flex items-start gap-3 pr-7">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-[#0078d4]/15">
            <Icon name="Microsoft" className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="truncate text-xl">{eventDetails.title}</DialogTitle>
            <DialogDescription className="mt-1">
              {t("calendarView.details.sourceType.microsoftOutlook")}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="grid max-h-[calc(88dvh-8rem)] gap-4 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-[#0078d4] text-white" fontWeight="normal">
            {t("calendarView.details.sourceType.microsoftOutlook")}
          </Badge>
          <Badge variant="outline" fontWeight="normal">
            {t(`calendarView.details.availability.${outlook.availability}`)}
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
            value={t(`calendarView.details.availability.${outlook.availability}`)}
          />

          {eventDetails.location ? (
            <CalendarEventMetaRow
              icon={<MapPin className="size-4" />}
              label={t("calendarView.details.field.location")}
              value={eventDetails.location}
            />
          ) : null}

          {outlook.isSensitive ? (
            <CalendarEventMetaRow
              icon={<Shield className="size-4" />}
              label={t("calendarView.details.field.privacy")}
              value={t("calendarView.details.privateEvent")}
            />
          ) : null}
        </div>

        {outlook.webLink ? (
          <div className="border-t border-neutral-200 pt-4">
            <Button
              asChild
              className="w-full gap-2 bg-[#0078d4] hover:bg-[#006cbd]"
              data-testid={CALENDAR_HANDLES.EVENT_DETAILS_OPEN_OUTLOOK}
            >
              <a href={outlook.webLink} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                {t("calendarView.details.action.openOutlook")}
              </a>
            </Button>
          </div>
        ) : null}
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
