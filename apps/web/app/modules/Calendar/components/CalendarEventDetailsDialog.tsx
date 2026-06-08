import { CALENDAR_EVENT_SOURCE_TYPES } from "@repo/shared";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCalendarEventDetails } from "~/api/queries/calendar/useCalendarEventDetails";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { CALENDAR_HANDLES } from "../../../../e2e/data/live-training/handles";

import { CalendarCourseDueDateEventDetailsDialog } from "./CalendarCourseDueDateEventDetailsDialog";
import { CalendarEventDetailsSkeleton } from "./CalendarEventDetailsSkeleton";
import { CalendarLiveTrainingEventDetailsDialog } from "./CalendarLiveTrainingEventDetailsDialog";

import type {
  CalendarEventDetails,
  CourseDueDateCalendarEventDetails,
  LiveTrainingCalendarEventDetails,
} from "../calendarEventDetails.types";
import type { SupportedLanguages } from "@repo/shared";

type CalendarEventDetailsDialogProps = {
  open: boolean;
  eventId: string | null;
  language: SupportedLanguages;
  onOpenChange: (open: boolean) => void;
};

const isLiveTrainingEventDetails = (
  eventDetails: CalendarEventDetails,
): eventDetails is LiveTrainingCalendarEventDetails =>
  eventDetails.sourceType === CALENDAR_EVENT_SOURCE_TYPES.LIVE_TRAINING &&
  "liveTraining" in eventDetails.payload;

const isCourseDueDateEventDetails = (
  eventDetails: CalendarEventDetails,
): eventDetails is CourseDueDateCalendarEventDetails =>
  eventDetails.sourceType === CALENDAR_EVENT_SOURCE_TYPES.COURSE_DUE_DATE &&
  "courseDueDate" in eventDetails.payload;

function CalendarEventDetailsLoadingDialog({
  open,
  onOpenChange,
}: Pick<CalendarEventDetailsDialogProps, "open" | "onOpenChange">) {
  const { t } = useTranslation();

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
                {t("calendarView.details.title")}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t("calendarView.details.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid max-h-[calc(88dvh-8rem)] gap-4 overflow-y-auto px-6 py-5">
          <CalendarEventDetailsSkeleton />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarEventDetailsDialog({
  open,
  eventId,
  language,
  onOpenChange,
}: CalendarEventDetailsDialogProps) {
  const { data: eventDetails, isLoading } = useCalendarEventDetails(eventId, language, {
    enabled: open && Boolean(eventId),
  });

  if (isLoading || !eventDetails) {
    return <CalendarEventDetailsLoadingDialog open={open} onOpenChange={onOpenChange} />;
  }

  return match(eventDetails)
    .when(isLiveTrainingEventDetails, (liveTrainingEventDetails) => (
      <CalendarLiveTrainingEventDetailsDialog
        open={open}
        eventDetails={liveTrainingEventDetails}
        onOpenChange={onOpenChange}
      />
    ))
    .when(isCourseDueDateEventDetails, (courseDueDateEventDetails) => (
      <CalendarCourseDueDateEventDetailsDialog
        open={open}
        eventDetails={courseDueDateEventDetails}
        onOpenChange={onOpenChange}
      />
    ))
    .otherwise(() => <CalendarEventDetailsLoadingDialog open={open} onOpenChange={onOpenChange} />);
}
