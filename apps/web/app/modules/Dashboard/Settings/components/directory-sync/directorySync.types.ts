import type {
  GetDirectorySyncConnectionResponse,
  ListDirectorySyncRunsResponse,
} from "~/api/generated-api";

export type DirectorySyncConnection = NonNullable<GetDirectorySyncConnectionResponse["data"]>;
export type DirectorySyncRoleMapping = DirectorySyncConnection["roleMappings"][number];
export type DirectorySyncGroupMapping = DirectorySyncConnection["groupMappings"][number];
export type DirectorySyncRun = ListDirectorySyncRunsResponse["data"][number];
