import { CALENDAR_EVENT_SOURCE_TYPES } from "@repo/shared";
import { useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";

import { useCalendarEventDetails } from "~/api/queries/calendar/useCalendarEventDetails";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";

import { CALENDAR_HANDLES } from "../../../../e2e/data/live-training/handles";

import { CalendarCourseDueDateEventDetailsDialog } from "./CalendarCourseDueDateEventDetailsDialog";
import { CalendarEventDetailsSkeleton } from "./CalendarEventDetailsSkeleton";
import { CalendarLiveTrainingEventDetailsDialog } from "./CalendarLiveTrainingEventDetailsDialog";
import { CalendarOutlookEventDetailsDialog } from "./CalendarOutlookEventDetailsDialog";

import type {
  CalendarEventDetails,
  CourseDueDateCalendarEventDetails,
  LiveTrainingCalendarEventDetails,
  OutlookCalendarEventDetails,
} from "../calendarEventDetails.types";
import type { SupportedLanguages } from "@repo/shared";
import type { ReactNode } from "react";

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

const isOutlookEventDetails = (
  eventDetails: CalendarEventDetails,
): eventDetails is OutlookCalendarEventDetails =>
  eventDetails.sourceType === CALENDAR_EVENT_SOURCE_TYPES.MICROSOFT_OUTLOOK &&
  "outlookCalendar" in eventDetails.payload;

function CalendarEventDetailsLoadingContent() {
  return (
    <>
      <DialogHeader className="border-b border-neutral-200 px-6 py-5">
        <div className="flex items-start gap-3 pr-7">
          <Skeleton className="mt-0.5 size-9 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <DialogTitle className="truncate text-xl">
              <Skeleton className="h-6 w-56" />
            </DialogTitle>
            <DialogDescription className="mt-2">
              <Skeleton className="h-4 w-36" />
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="grid max-h-[calc(88dvh-8rem)] gap-4 overflow-y-auto px-6 py-5">
        <CalendarEventDetailsSkeleton />
      </div>
    </>
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
  const [isMinimumLoadingTimeComplete, setIsMinimumLoadingTimeComplete] = useState(false);
  const loadingEventIds = useRef(new Set<string>());

  useEffect(() => {
    if (!open || !eventId || loadingEventIds.current.has(eventId)) {
      setIsMinimumLoadingTimeComplete(Boolean(eventId && loadingEventIds.current.has(eventId)));
      return;
    }

    setIsMinimumLoadingTimeComplete(false);
    const timeout = window.setTimeout(() => {
      loadingEventIds.current.add(eventId);
      setIsMinimumLoadingTimeComplete(true);
    }, 1_000);

    return () => window.clearTimeout(timeout);
  }, [eventId, open]);

  const showLoading = isLoading || !eventDetails || !isMinimumLoadingTimeComplete;

  let dialogContent: ReactNode = <CalendarEventDetailsLoadingContent />;

  if (!showLoading && eventDetails) {
    dialogContent = match(eventDetails)
      .when(isLiveTrainingEventDetails, (liveTrainingEventDetails) => (
        <CalendarLiveTrainingEventDetailsDialog
          eventDetails={liveTrainingEventDetails}
          insideDialog
          open={open}
          onOpenChange={onOpenChange}
        />
      ))
      .when(isCourseDueDateEventDetails, (courseDueDateEventDetails) => (
        <CalendarCourseDueDateEventDetailsDialog
          eventDetails={courseDueDateEventDetails}
          insideDialog
          open={open}
          onOpenChange={onOpenChange}
        />
      ))
      .when(isOutlookEventDetails, (outlookEventDetails) => (
        <CalendarOutlookEventDetailsDialog
          eventDetails={outlookEventDetails}
          insideDialog
          open={open}
          onOpenChange={onOpenChange}
        />
      ))
      .otherwise(() => <CalendarEventDetailsLoadingContent />);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={CALENDAR_HANDLES.EVENT_DETAILS_DIALOG}
        className="z-[90] max-h-[88dvh] overflow-hidden p-0 sm:max-w-[620px]"
      >
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}
