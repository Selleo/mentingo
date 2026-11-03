import { UnauthorizedException } from "@nestjs/common";

import { McpController } from "./mcp.controller";

import type { McpHttpService } from "./mcp-http.service";
import type { McpRequest, McpToolActor } from "./mcp.types";
import type { Response } from "express";

describe("MCP controller identity boundary", () => {
  it("rejects a missing authenticated actor before invoking the transport", async () => {
    const handle = jest.fn();
    const controller = new McpController({ handle } as unknown as McpHttpService);
    await expect(controller.handle({} as McpRequest, {} as Response)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(handle).not.toHaveBeenCalled();
  });

  it("passes the resolved actor to the transport", async () => {
    const handle = jest.fn().mockResolvedValue(undefined);
    const controller = new McpController({ handle } as unknown as McpHttpService);
    const actor = { email: "test@example.com" } as McpToolActor;
    const request = { mcpActor: actor } as McpRequest;
    const response = {} as Response;
    await controller.handle(request, response);
    expect(handle).toHaveBeenCalledWith(request, response, actor);
  });
});
