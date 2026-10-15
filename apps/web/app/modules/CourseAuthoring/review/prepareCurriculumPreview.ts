import { CourseAuthoringOrderError } from "@repo/shared";

import type { AuthoringSession, CurriculumPreview } from "../courseAuthoring.types";

/** Retry an incomplete snapshot once, then permit inspection without authorizing Apply. */
export const prepareCurriculumPreview = async (
  build: (snapshot?: AuthoringSession, inspectIncomplete?: boolean) => CurriculumPreview | null,
  refresh: () => Promise<AuthoringSession | undefined>,
): Promise<CurriculumPreview | null> => {
  try {
    return build();
  } catch (error) {
    if (!(error instanceof CourseAuthoringOrderError) || error.code !== "missingDependency")
      throw error;
  }
  let snapshot: AuthoringSession | undefined;
  try {
    snapshot = await refresh();
  } catch {
    // A failed refresh must not prevent reading content already available locally.
  }
  try {
    return build(snapshot);
  } catch (error) {
    if (!(error instanceof CourseAuthoringOrderError) || error.code !== "missingDependency")
      throw error;
    return build(snapshot, true);
  }
};
