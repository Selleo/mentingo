import { McpHttpService } from "./mcp-http.service";
import * as studentLessonTools from "./mcp-student-lesson-tools";
import { MCP_SCOPES } from "./mcp-tool-scope";

describe("MCP learner adapter registration", () => {
  it("fails explicitly if the required learner search adapter is unavailable", () => {
    const registration = jest
      .spyOn(studentLessonTools, "registerMcpStudentLessonTools")
      .mockImplementation(() => undefined);
    const service = Object.create(McpHttpService.prototype) as McpHttpService;
    const collector = { registerTool: jest.fn(() => ({ disable: jest.fn() })) };
    const actor = {
      email: "learner@example.com",
      grant: {
        tenantId: "tenant",
        userId: "learner",
        clientId: "client",
        resource: "https://tenant.example/api/mcp",
        scopes: [MCP_SCOPES.STUDENT_READ],
        expiresAt: Date.now() + 1000,
      },
    };
    try {
      expect(() =>
        Reflect.apply(Reflect.get(service, "createServer"), service, [actor, [], {}, collector]),
      ).toThrow("Learner lesson search adapter unavailable");
    } finally {
      registration.mockRestore();
    }
  });
});
