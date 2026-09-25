import type { McpAccessGrant } from "./mcp.types";
import type OAuth2Server from "@node-oauth/oauth2-server";

export type McpClient = OAuth2Server.Client & { name: string };
export type McpUser = OAuth2Server.User & Pick<McpAccessGrant, "userId" | "tenantId" | "resource">;
export type StoredCode = Omit<OAuth2Server.AuthorizationCode, "expiresAt"> & { expiresAt: string };
export type StoredRefresh = Omit<OAuth2Server.RefreshToken, "refreshTokenExpiresAt"> & {
  refreshTokenExpiresAt: string;
};
export type ConsentRequest = { userId: string; query: Record<string, string> };
