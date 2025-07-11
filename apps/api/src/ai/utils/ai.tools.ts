import { jsonSchema, tool } from "ai";

import { type ThreadOwnershipBody, threadOwnershipSchema } from "src/ai/utils/ai.schema";

import type { AiService } from "src/ai/services/ai.service";

export const judge = (service: AiService) => {
  return tool({
    description:
      "Run the AI Judge method. When user asks to check the task, or says in any way that he is done. You should run the judge.",
    parameters: jsonSchema(threadOwnershipSchema),
    execute: async (data: ThreadOwnershipBody) => {
      return await service.runJudge(data);
    },
  });
};
