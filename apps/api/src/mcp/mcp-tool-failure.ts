import { HttpException, HttpStatus } from "@nestjs/common";
import { match } from "ts-pattern";

import { MCP_TOOL_ERROR_CODES } from "./mcp.constants";

import type { McpToolErrorCode } from "./mcp.constants";

const getMcpToolErrorCode = (status: number): McpToolErrorCode =>
  match(status)
    .with(HttpStatus.BAD_REQUEST, () => MCP_TOOL_ERROR_CODES.INVALID_ARGUMENT)
    .with(HttpStatus.UNAUTHORIZED, () => MCP_TOOL_ERROR_CODES.UNAUTHENTICATED)
    .with(HttpStatus.FORBIDDEN, () => MCP_TOOL_ERROR_CODES.PERMISSION_DENIED)
    .with(HttpStatus.NOT_FOUND, () => MCP_TOOL_ERROR_CODES.NOT_FOUND)
    .with(HttpStatus.CONFLICT, () => MCP_TOOL_ERROR_CODES.CONFLICT)
    .otherwise(() => MCP_TOOL_ERROR_CODES.INTERNAL);

/** Describes a failed tool call; only HTTP errors expose their message, others stay generic. */
export function toMcpToolFailure(error: unknown, requestId?: string) {
  const isHttpError = error instanceof HttpException;
  const status = isHttpError ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

  return {
    code: getMcpToolErrorCode(status),
    status,
    message: isHttpError ? error.message : "Operation failed",
    requestId,
  };
}
