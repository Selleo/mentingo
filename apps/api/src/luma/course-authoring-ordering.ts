import type { CourseAuthoringPlacement } from "./course-authoring.types";
import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";

export const buildAuthoringPlacements = (
  operations: AuthoringOperation[],
): CourseAuthoringPlacement[] => {
  const placements: CourseAuthoringPlacement[] = [];
  const pending = new Map<string, CourseAuthoringPlacement[]>();
  const deleted = new Set(
    operations
      .filter(
        (operation) => operation.type === "chapter.delete" || operation.type === "lesson.delete",
      )
      .map((operation) => operation.targetId),
  );
  const flush = (group: string) => {
    const lastByTarget = new Map<string, CourseAuthoringPlacement>();
    for (const placement of pending.get(group) ?? [])
      lastByTarget.set(placement.targetId, placement);
    placements.push(
      ...[...lastByTarget.values()].sort((left, right) => left.displayOrder - right.displayOrder),
    );
    pending.delete(group);
  };
  for (const operation of operations) {
    if (deleted.has(operation.targetId)) continue;
    let group: string;
    let placement: CourseAuthoringPlacement;
    switch (operation.type) {
      case "chapter.create":
      case "chapter.update":
        group = "chapters";
        placement = {
          kind: "chapter",
          targetId: operation.targetId,
          displayOrder: operation.payload.displayOrder + 1,
        };
        break;
      case "lesson.create":
      case "lesson.update":
        if (operation.displayOrder === undefined || deleted.has(operation.chapterId)) continue;
        group = `lessons:${operation.chapterId}`;
        placement = {
          kind: "lesson",
          chapterId: operation.chapterId,
          targetId: operation.targetId,
          displayOrder: operation.displayOrder + 1,
        };
        break;
      case "chapter.reorder":
      case "lesson.reorder": {
        group = operation.type === "chapter.reorder" ? "chapters" : `lessons:${operation.targetId}`;
        flush(group);
        operation.payload.orderedIds
          .filter((id) => !deleted.has(id))
          .forEach((id, index) => {
            if (operation.type === "chapter.reorder") {
              placements.push({ kind: "chapter", targetId: id, displayOrder: index + 1 });
            } else {
              placements.push({
                kind: "lesson",
                chapterId: operation.targetId,
                targetId: id,
                displayOrder: index + 1,
              });
            }
          });
        continue;
      }
      default:
        continue;
    }
    const siblings = pending.get(group) ?? [];
    siblings.push(placement);
    pending.set(group, siblings);
  }
  for (const group of pending.keys()) flush(group);
  return placements;
};
