import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { CALENDAR_EVENT_DETAILS_QUERY_KEY } from "~/api/queries/calendar/useCalendarEventDetails";
import { CALENDAR_EVENTS_QUERY_KEY } from "~/api/queries/calendar/useCalendarEvents";
import { LIVE_TRAINING_QUERY_KEY } from "~/api/queries/live-training/useLiveTraining";
import { LIVE_TRAINING_HOST_CANDIDATES_QUERY_KEY } from "~/api/queries/live-training/useLiveTrainingHostCandidates";
import { LIVE_TRAINING_SESSION_QUERY_KEY } from "~/api/queries/live-training/useLiveTrainingSession";
import { LIVE_TRAINING_SESSIONS_QUERY_KEY } from "~/api/queries/live-training/useLiveTrainingSessions";
import { queryClient } from "~/api/queryClient";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasCalendarEventsRange = (queryKey: readonly unknown[]) => {
  const params = queryKey[1];

  if (!isRecord(params)) return false;

  return (
    typeof params.start === "string" &&
    params.start.length > 0 &&
    typeof params.end === "string" &&
    params.end.length > 0
  );
};

type InvalidateLiveTrainingDataOptions = {
  includeCalendar?: boolean;
  includeCoursesAndLessons?: boolean;
  includeHostCandidates?: boolean;
  includeSessions?: boolean;
};

const COURSE_AND_LESSON_QUERY_KEYS = [
  [COURSE_QUERY_KEY],
  ["course"],
  ["lesson"],
  ["lessonProgress"],
  ["lessons-sequence"],
  ["available-courses"],
  ["content-creator-courses"],
  ["get-student-courses"],
] as const;

export async function invalidateLiveTrainingData({
  includeCalendar = false,
  includeCoursesAndLessons = false,
  includeHostCandidates = false,
  includeSessions = false,
}: InvalidateLiveTrainingDataOptions = {}) {
  const invalidations = [queryClient.invalidateQueries({ queryKey: LIVE_TRAINING_QUERY_KEY })];
  const refetches = [queryClient.refetchQueries({ queryKey: LIVE_TRAINING_QUERY_KEY })];

  if (includeCalendar) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CALENDAR_EVENT_DETAILS_QUERY_KEY }),
    );
    refetches.push(
      queryClient.refetchQueries({
        queryKey: CALENDAR_EVENTS_QUERY_KEY,
        type: "active",
        predicate: (query) => hasCalendarEventsRange(query.queryKey),
      }),
      queryClient.refetchQueries({ queryKey: CALENDAR_EVENT_DETAILS_QUERY_KEY }),
    );
  }

  if (includeSessions) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: LIVE_TRAINING_SESSIONS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: LIVE_TRAINING_SESSION_QUERY_KEY }),
    );
    refetches.push(
      queryClient.refetchQueries({ queryKey: LIVE_TRAINING_SESSIONS_QUERY_KEY }),
      queryClient.refetchQueries({ queryKey: LIVE_TRAINING_SESSION_QUERY_KEY }),
    );
  }

  if (includeHostCandidates) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: [LIVE_TRAINING_HOST_CANDIDATES_QUERY_KEY] }),
    );
  }

  if (includeCoursesAndLessons) {
    COURSE_AND_LESSON_QUERY_KEYS.forEach((queryKey) => {
      invalidations.push(queryClient.invalidateQueries({ queryKey }));
    });
  }

  await Promise.all(invalidations);
  await Promise.all(refetches);
}
