/** Converts validated API operations to the wire shape expected by the authoring service. */
import { BadRequestException } from "@nestjs/common";

import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";
import type { AuthoringOperation as WireOperation } from "@mentingo/luma-sdk";

/** Preserve the operation discriminant when converting the grouped TypeBox union. */
/** Maps validated Core operation payloads to the generated client wire contract. */
export function toWireAuthoringOperation(operation: AuthoringOperation): WireOperation {
  switch (operation.type) {
    case "lesson.create": {
      if (operation.payload.lessonType === "ai_mentor") {
        if (!operation.payload.judgeConfiguration)
          throw new BadRequestException("courseAuthoring.errors.mentorJudgeRequired");
        return {
          ...operation,
          type: "lesson.create",
          payload: {
            ...operation.payload,
            judgeConfiguration: operation.payload.judgeConfiguration,
          },
        };
      }
      return { ...operation, type: "lesson.create", payload: operation.payload };
    }
    case "lesson.update":
      return { ...operation, type: "lesson.update" };
    case "chapter.create":
      return { ...operation, type: "chapter.create" };
    case "chapter.update":
      return { ...operation, type: "chapter.update" };
    case "chapter.delete":
      return { ...operation, type: "chapter.delete" };
    case "lesson.delete":
      return { ...operation, type: "lesson.delete" };
    case "chapter.reorder":
      return { ...operation, type: "chapter.reorder" };
    case "lesson.reorder":
      return { ...operation, type: "lesson.reorder" };
    default:
      return operation;
  }
}
