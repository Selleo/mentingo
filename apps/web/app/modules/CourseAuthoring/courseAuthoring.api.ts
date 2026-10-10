/** Adapts generated API responses to the stable data shape consumed by the workspace. */
import { ApiClient } from "~/api/api-client";

import { parseFetchedResearchSources } from "./authoringSources";

import type { AuthoringSessionCommandId } from "./authoringSessionSelection";
import type {
  AuthoringCommand,
  AuthoringSession,
  AuthoringTurn,
  AuthoringTurnHistoryPage,
  CourseContext,
} from "./courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";
import type {
  GetAuthoringCourseContextResponse,
  ListAuthoringSessionsResponse,
  OpenAuthoringSessionResponse,
  SendAuthoringCommandBody,
} from "~/api/generated-api";

const taskStatuses = new Set([
  "queued",
  "running",
  "waiting_author",
  "waiting_dependencies",
  "paused",
  "succeeded",
  "failed",
  "superseded",
  "stopped",
]);

/** Normalize persisted citations to the same safe shape as live tool events. */
const normalizeTurns = (
  turns: NonNullable<OpenAuthoringSessionResponse["data"]["turns"]>,
): AuthoringTurn[] =>
  turns.map((turn) => ({
    ...turn,
    parts: turn.parts.map((part) => {
      const tool = part.tool;
      if (!tool) return { ...part, tool };
      const result = tool.result;
      return {
        ...part,
        tool: {
          ...tool,
          result: result
            ? { ...result, sources: parseFetchedResearchSources(result.sources) }
            : result,
        },
      };
    }),
  }));

/** Converts a generated response into the projection shape expected by the workspace. */
const normalizeSession = (session: OpenAuthoringSessionResponse["data"]): AuthoringSession => ({
  ...session,
  turns: session.turns ? normalizeTurns(session.turns) : undefined,
  applicationDelta: session.applicationDelta
    ? {
        appliedOperationIds: session.applicationDelta.appliedOperationIds,
        idMappings: Object.fromEntries(
          Object.entries(session.applicationDelta.idMappings).filter(
            ([, value]) => typeof value === "string",
          ),
        ),
      }
    : undefined,
  records: session.records.map((record) => ({
    ...record,
    payload:
      typeof record.payload === "object" && record.payload !== null
        ? (record.payload as Record<string, unknown>)
        : {},
  })),
  tasks: session.tasks.map((task) => ({
    ...task,
    status: taskStatuses.has(task.status)
      ? (task.status as AuthoringSession["tasks"][number]["status"])
      : "unknown",
  })),
});

/** Opens a localized authoring session for the selected course. */
export const openAuthoringSession = async (
  courseId: string,
  language: SupportedLanguages,
  commandId: AuthoringSessionCommandId = crypto.randomUUID(),
): Promise<AuthoringSession> => {
  const response = await ApiClient.api.courseAuthoringControllerOpenAuthoringSession(courseId, {
    commandId,
    language,
  });
  return normalizeSession(response.data.data);
};

/** Lists one server-filtered, offset-paginated page of session-browser summaries before the UI chooses a timeline to restore. */
export const listAuthoringSessions = async (
  courseId: string,
  params?: { page?: number; perPage?: number; keyword?: string },
): Promise<ListAuthoringSessionsResponse> => {
  const response = await ApiClient.api.courseAuthoringControllerListAuthoringSessions(
    courseId,
    params,
  );
  return response.data;
};

/** Loads one durable session snapshot by course and session identifiers. */
export const getAuthoringSession = async (
  courseId: string,
  sessionId: string,
): Promise<AuthoringSession> => {
  const response = await ApiClient.api.courseAuthoringControllerGetAuthoringSession(
    courseId,
    sessionId,
  );
  return normalizeSession(response.data.data);
};

/** Loads an immutable older turn page through Core's course-editor authorization. */
export const getOlderAuthoringTurns = async (
  courseId: string,
  sessionId: string,
  beforeRequestId: string,
): Promise<AuthoringTurnHistoryPage> => {
  const response = await ApiClient.api.courseAuthoringControllerGetOlderAuthoringTurns(
    courseId,
    sessionId,
    { beforeRequestId },
  );
  const page = response.data.data;
  return {
    turns: normalizeTurns(page.turns),
    records: page.records.map((record) => ({
      ...record,
      payload:
        typeof record.payload === "object" && record.payload !== null
          ? (record.payload as Record<string, unknown>)
          : {},
    })),
    hasMore: page.hasMore,
    nextBeforeRequestId: page.nextBeforeRequestId,
  };
};

/** Sends a generated-client command to the active authoring session. */
export const sendAuthoringCommand = async (
  courseId: string,
  sessionId: string,
  command: Omit<AuthoringCommand, "schemaVersion" | "commandId"> & { commandId?: string },
) => {
  const response = await ApiClient.api.courseAuthoringControllerSendAuthoringCommand(
    courseId,
    sessionId,
    {
      ...command,
      schemaVersion: 1,
      commandId: command.commandId ?? crypto.randomUUID(),
    } as SendAuthoringCommandBody,
  );
  return response.data.data;
};

/** Loads the localized native context used by target editors. */
export const getAuthoringCourseContext = async (
  courseId: string,
  language: SupportedLanguages,
): Promise<CourseContext> => {
  const response = await ApiClient.api.courseAuthoringControllerGetAuthoringCourseContext(
    courseId,
    { language },
  );
  const context: GetAuthoringCourseContextResponse["data"] = response.data.data;
  const fieldHashes = Object.fromEntries(
    Object.entries(context.fieldHashes).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return { ...context, fieldHashes };
};

/** Requests explicit export preparation for accepted proposals and asset omissions. */
export const applyAuthoringProposals = async (
  courseId: string,
  sessionId: string,
  proposalIds: string[],
  acknowledgeAssessmentChanges: boolean,
  commandId: string,
  omitOptionalAssetIds: string[] = [],
) => {
  const response = await ApiClient.api.courseAuthoringControllerApplyAuthoringProposals(
    courseId,
    sessionId,
    {
      commandId,
      proposalIds,
      ...(omitOptionalAssetIds.length > 0 ? { omitOptionalAssetIds } : {}),
      acknowledgeAssessmentChanges,
    },
  );
  return response.data.data;
};

/** Reads application status for the export currently being tracked. */
export const getAuthoringApplication = async (
  courseId: string,
  sessionId: string,
  exportId: string,
) => {
  const response = await ApiClient.api.courseAuthoringControllerGetAuthoringApplication(
    courseId,
    sessionId,
    exportId,
  );
  return response.data.data;
};

/** Uploads a source file through the generated multipart endpoint. */
export const uploadAuthoringSource = async (courseId: string, sessionId: string, file: File) => {
  const response = await ApiClient.api.courseAuthoringControllerUploadAuthoringSource(
    courseId,
    sessionId,
    { commandId: crypto.randomUUID(), file },
  );
  return response.data.data;
};
