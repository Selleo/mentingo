export type CompetenciesJobData =
  | { operation: "sync"; tenantId: string; subjectId: string; courseId: string }
  | {
      operation: "assignment";
      tenantId: string;
      actorId: string;
      actionId: string;
      subjectId: string;
      requestId: string;
    };
