/** Map authoring positions to native one-based question numbers without mutating a proposal.
 * Sort stably so zero-based, one-based, and sparse positions preserve their reviewed order.
 * Answer positions and question content remain unchanged.
 */
export const normalizeAuthoringQuizQuestionOrder = <T extends { displayOrder: number }>(
  questions: readonly T[],
): T[] =>
  [...questions]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((question, index) => ({ ...question, displayOrder: index + 1 }));
