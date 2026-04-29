export function shouldEmitAiMentorLessonPassedEvent(
  previousPassed: boolean | null | undefined,
  nextPassed: boolean,
): boolean {
  return nextPassed && previousPassed !== true;
}

export function resolveStoredAiMentorPassed(
  previousPassed: boolean | null | undefined,
  nextPassed: boolean,
): boolean {
  return previousPassed === true || nextPassed;
}
