import { ASSISTANT_RUN_ACTIVITIES } from "@repo/shared";

import { NATIVE_READ_TOOL_NAMES } from "src/mcp/mcp-native-read.types";

import { getAssistantReadActivity } from "./assistant-progress";

describe("Assistant read progress", () => {
  it("maps supported operations explicitly without inspecting arguments or text", () => {
    expect(getAssistantReadActivity("global_search")).toBe(ASSISTANT_RUN_ACTIVITIES.SEARCHING);
    expect(getAssistantReadActivity("get_lesson")).toBe(ASSISTANT_RUN_ACTIVITIES.READING);
    for (const name of NATIVE_READ_TOOL_NAMES)
      expect(getAssistantReadActivity(name)).not.toBeNull();
  });

  it("does not advertise progress for arbitrary or write operations", () => {
    expect(getAssistantReadActivity("create_course")).toBeNull();
    expect(getAssistantReadActivity("invented_read_tool")).toBeNull();
  });
});
