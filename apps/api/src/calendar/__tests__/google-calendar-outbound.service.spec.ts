import { CALENDAR_OUTBOUND_STATUSES, CALENDAR_PROVIDERS } from "@repo/shared";

import {
  CALENDAR_OUTBOUND_ERROR_CODES,
  CALENDAR_OUTBOUND_SOURCE_TYPES,
  GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY,
} from "../calendar.constants";
import { GoogleCalendarApiError } from "../clients/google-calendar-api.client";
import { GoogleCalendarOutboundService } from "../services/google-calendar-outbound.service";

import type {
  CalendarConnection,
  CalendarOutboundCandidate,
} from "../types/calendar-connection.types";

const connection = (overrides: Partial<CalendarConnection> = {}) =>
  ({
    id: "f83a0c69-0271-47e3-a052-958924c8d68b",
    tenantId: "a4d63c7f-018b-4c8c-8b29-04ab4e94a67e",
    userId: "07dde027-268e-4a98-b740-f28ac979614f",
    provider: CALENDAR_PROVIDERS.GOOGLE,
    outboundSyncEnabled: true,
    outboundStatus: CALENDAR_OUTBOUND_STATUSES.QUEUED,
    outboundCalendarId: "mentingo-calendar",
    outboundErrorCode: null,
    ...overrides,
  }) as CalendarConnection;

const liveTraining = (
  overrides: Partial<CalendarOutboundCandidate> = {},
): CalendarOutboundCandidate => ({
  calendarEventId: "0d3c9a52-1f3d-4bd0-9a8a-0c3f0f8b2a11",
  title: "Onboarding live training",
  description: "Bring your questions",
  startsAt: "2026-07-22T09:00:00.000Z",
  endsAt: "2026-07-22T10:00:00.000Z",
  allDay: false,
  timezone: "Europe/Warsaw",
  location: "Room 4",
  sourceType: CALENDAR_OUTBOUND_SOURCE_TYPES.LIVE_TRAINING,
  groupName: null,
  courseTitle: null,
  recipientId: "07dde027-268e-4a98-b740-f28ac979614f",
  ...overrides,
});

const courseDueDate = (): CalendarOutboundCandidate =>
  liveTraining({
    calendarEventId: "6a2f5d0e-4e4f-4b8e-9b1c-2f8f0e6f7a22",
    title: "Security basics due",
    description: "",
    startsAt: "2026-07-24T22:00:00.000Z",
    endsAt: "2026-07-24T22:00:00.000Z",
    allDay: true,
    location: null,
    sourceType: CALENDAR_OUTBOUND_SOURCE_TYPES.COURSE_DUE_DATE,
    groupName: "Engineering",
    courseTitle: "Security basics",
  });

const GOOGLE_EVENT_ID_PATTERN = /^[0-9a-v]{5,1024}$/;

describe("GoogleCalendarOutboundService", () => {
  const calendarConnectionRepository = {
    getConnectionById: jest.fn(),
    updateConnection: jest.fn(),
    listOutboundCandidates: jest.fn(),
    getOutboundMapping: jest.fn(),
    upsertOutboundMapping: jest.fn(),
    listOutboundMappings: jest.fn(),
    deleteOutboundMapping: jest.fn(),
    deleteOutboundMappingsForConnection: jest.fn(),
  };
  const googleCalendarApiClient = {
    getCalendar: jest.fn(),
    listCalendars: jest.fn(),
    createCalendar: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
    deleteEvent: jest.fn(),
  };
  const googleCalendarAccessTokenService = { getAccessToken: jest.fn() };

  const service = new GoogleCalendarOutboundService(
    calendarConnectionRepository as never,
    googleCalendarApiClient as never,
    googleCalendarAccessTokenService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    calendarConnectionRepository.getConnectionById.mockResolvedValue(connection());
    calendarConnectionRepository.listOutboundCandidates.mockResolvedValue([]);
    calendarConnectionRepository.getOutboundMapping.mockResolvedValue(null);
    calendarConnectionRepository.listOutboundMappings.mockResolvedValue([]);
    googleCalendarAccessTokenService.getAccessToken.mockResolvedValue("access-token");
    googleCalendarApiClient.getCalendar.mockResolvedValue({ id: "mentingo-calendar" });
    googleCalendarApiClient.createEvent.mockResolvedValue({ id: "google-event-1" });
    googleCalendarApiClient.updateEvent.mockResolvedValue(undefined);
  });

  it("exports a live training as a marked timed event and stores the mapping", async () => {
    calendarConnectionRepository.listOutboundCandidates.mockResolvedValue([liveTraining()]);

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(googleCalendarApiClient.createEvent).toHaveBeenCalledWith(
      "access-token",
      "mentingo-calendar",
      expect.stringMatching(GOOGLE_EVENT_ID_PATTERN),
      {
        summary: "Onboarding live training",
        description: "Bring your questions\n\nThis session is managed in Mentingo.",
        start: { dateTime: "2026-07-22T09:00:00.000Z", timeZone: "Europe/Warsaw" },
        end: { dateTime: "2026-07-22T10:00:00.000Z", timeZone: "Europe/Warsaw" },
        location: "Room 4",
        status: "confirmed",
        extendedProperties: { private: { [GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY]: "true" } },
      },
    );
    expect(calendarConnectionRepository.upsertOutboundMapping).toHaveBeenCalledWith({
      connectionId: connection().id,
      calendarEventId: liveTraining().calendarEventId,
      userId: liveTraining().recipientId,
      externalEventId: googleCalendarApiClient.createEvent.mock.calls[0][2],
    });
    expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
      connection().id,
      expect.objectContaining({ outboundStatus: CALENDAR_OUTBOUND_STATUSES.CONNECTED }),
    );
  });

  it("exports course due dates as all-day events in the course timezone", async () => {
    calendarConnectionRepository.listOutboundCandidates.mockResolvedValue([courseDueDate()]);

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(googleCalendarApiClient.createEvent).toHaveBeenCalledWith(
      "access-token",
      "mentingo-calendar",
      expect.any(String),
      expect.objectContaining({
        start: { date: "2026-07-25" },
        end: { date: "2026-07-26" },
        description: expect.stringContaining("Course: Security basics"),
      }),
    );
    expect(googleCalendarApiClient.createEvent).toHaveBeenCalledWith(
      "access-token",
      "mentingo-calendar",
      expect.any(String),
      expect.not.objectContaining({ location: expect.anything() }),
    );
  });

  it("updates an exported event in place", async () => {
    calendarConnectionRepository.listOutboundCandidates.mockResolvedValue([liveTraining()]);
    calendarConnectionRepository.getOutboundMapping.mockResolvedValue({
      externalEventId: "google-event-1",
    });

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(googleCalendarApiClient.updateEvent).toHaveBeenCalledWith(
      "access-token",
      "mentingo-calendar",
      "google-event-1",
      expect.objectContaining({ summary: "Onboarding live training" }),
    );
    expect(googleCalendarApiClient.createEvent).not.toHaveBeenCalled();
  });

  it("recreates an exported event the user deleted in Google Calendar", async () => {
    calendarConnectionRepository.listOutboundCandidates.mockResolvedValue([liveTraining()]);
    calendarConnectionRepository.getOutboundMapping.mockResolvedValue({
      externalEventId: "google-event-deleted",
    });
    googleCalendarApiClient.updateEvent.mockRejectedValue(
      new GoogleCalendarApiError("Not found", false, 404),
    );

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(googleCalendarApiClient.createEvent).toHaveBeenCalled();
    expect(calendarConnectionRepository.upsertOutboundMapping).toHaveBeenCalledWith(
      expect.objectContaining({ externalEventId: expect.stringMatching(GOOGLE_EVENT_ID_PATTERN) }),
    );
  });

  it("creates the same Google event ID for a commitment on every run", async () => {
    calendarConnectionRepository.listOutboundCandidates.mockResolvedValue([liveTraining()]);

    await service.exportMentingoEventsToGoogleCalendar(connection().id);
    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    const [firstEventId, secondEventId] = googleCalendarApiClient.createEvent.mock.calls.map(
      (call) => call[2],
    );
    expect(firstEventId).toBe(secondEventId);
  });

  it("reconciles an event created by an interrupted run instead of duplicating it", async () => {
    calendarConnectionRepository.listOutboundCandidates.mockResolvedValue([liveTraining()]);
    googleCalendarApiClient.createEvent.mockRejectedValue(
      new GoogleCalendarApiError("Duplicate", false, 409),
    );

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    const eventId = googleCalendarApiClient.createEvent.mock.calls[0][2];
    expect(googleCalendarApiClient.updateEvent).toHaveBeenCalledWith(
      "access-token",
      "mentingo-calendar",
      eventId,
      expect.objectContaining({ summary: "Onboarding live training", status: "confirmed" }),
    );
    expect(calendarConnectionRepository.upsertOutboundMapping).toHaveBeenCalledWith(
      expect.objectContaining({ externalEventId: eventId }),
    );
    expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
      connection().id,
      expect.objectContaining({ outboundStatus: CALENDAR_OUTBOUND_STATUSES.CONNECTED }),
    );
  });

  it("deletes exported events that are no longer Mentingo commitments", async () => {
    calendarConnectionRepository.listOutboundMappings.mockResolvedValue([
      {
        id: "mapping-1",
        calendarEventId: "c0a2d1a4-9a52-4c39-9f4b-3c8b0d1e2f33",
        userId: connection().userId,
        externalEventId: "google-event-stale",
      },
    ]);

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(googleCalendarApiClient.deleteEvent).toHaveBeenCalledWith(
      "access-token",
      "mentingo-calendar",
      "google-event-stale",
    );
    expect(calendarConnectionRepository.deleteOutboundMapping).toHaveBeenCalledWith("mapping-1");
  });

  it("reuses an existing owned Mentingo calendar before creating one", async () => {
    calendarConnectionRepository.getConnectionById.mockResolvedValue(
      connection({ outboundCalendarId: null }),
    );
    googleCalendarApiClient.listCalendars.mockResolvedValue([
      { id: "primary-calendar", summary: "Mentingo", primary: true, accessRole: "owner" },
      { id: "shared-calendar", summary: "Mentingo", accessRole: "reader" },
      { id: "owned-mentingo-calendar", summary: "Mentingo", accessRole: "owner" },
    ]);

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(googleCalendarApiClient.createCalendar).not.toHaveBeenCalled();
    expect(calendarConnectionRepository.updateConnection).toHaveBeenCalledWith(connection().id, {
      outboundCalendarId: "owned-mentingo-calendar",
    });
  });

  it("creates the Mentingo calendar in the primary calendar timezone", async () => {
    calendarConnectionRepository.getConnectionById.mockResolvedValue(
      connection({ outboundCalendarId: null }),
    );
    googleCalendarApiClient.listCalendars.mockResolvedValue([]);
    googleCalendarApiClient.getCalendar.mockResolvedValue({
      id: "primary",
      timeZone: "Europe/Warsaw",
    });
    googleCalendarApiClient.createCalendar.mockResolvedValue({ id: "new-mentingo-calendar" });

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(googleCalendarApiClient.createCalendar).toHaveBeenCalledWith(
      "access-token",
      "Europe/Warsaw",
    );
    expect(calendarConnectionRepository.updateConnection).toHaveBeenCalledWith(connection().id, {
      outboundCalendarId: "new-mentingo-calendar",
    });
  });

  it("disables export and forgets the deleted Mentingo calendar so it can be recreated", async () => {
    calendarConnectionRepository.listOutboundCandidates.mockResolvedValue([liveTraining()]);
    googleCalendarApiClient.getCalendar.mockRejectedValue(
      new GoogleCalendarApiError("Not found", false, 404),
    );

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(googleCalendarApiClient.createEvent).not.toHaveBeenCalled();
    expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
      connection().id,
      {
        outboundSyncEnabled: false,
        outboundStatus: CALENDAR_OUTBOUND_STATUSES.DISABLED,
        outboundCalendarId: null,
        outboundErrorCode: CALENDAR_OUTBOUND_ERROR_CODES.CALENDAR_DELETED,
      },
    );
    expect(calendarConnectionRepository.deleteOutboundMappingsForConnection).toHaveBeenCalledWith(
      connection().id,
    );
  });

  it("records expired authorization separately from other export failures", async () => {
    googleCalendarAccessTokenService.getAccessToken.mockRejectedValue(
      new GoogleCalendarApiError("invalid grant", true, 400),
    );

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(calendarConnectionRepository.updateConnection).toHaveBeenLastCalledWith(
      connection().id,
      {
        outboundStatus: CALENDAR_OUTBOUND_STATUSES.ERROR,
        outboundErrorCode: CALENDAR_OUTBOUND_ERROR_CODES.AUTHORIZATION_EXPIRED,
      },
    );
  });

  it.each([
    ["export is disabled", connection({ outboundSyncEnabled: false })],
    ["the connection belongs to Microsoft", connection({ provider: CALENDAR_PROVIDERS.MICROSOFT })],
  ])("does nothing when %s", async (_scenario, skippedConnection) => {
    calendarConnectionRepository.getConnectionById.mockResolvedValue(skippedConnection);

    await service.exportMentingoEventsToGoogleCalendar(connection().id);

    expect(calendarConnectionRepository.updateConnection).not.toHaveBeenCalled();
    expect(googleCalendarAccessTokenService.getAccessToken).not.toHaveBeenCalled();
  });
});
