import type { McpResource } from "./mcp.types";
import type { Request } from "express";

export type ExternalConversationRequest = Request & { externalConversationResource?: McpResource };
