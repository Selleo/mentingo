export const REPORTS_IDS = {
  learner: "33333333-3333-4333-8333-333333333333",
  course: "44444444-4444-4444-8444-444444444444",
  path: "55555555-5555-4555-8555-555555555555",
  group: "66666666-6666-4666-8666-666666666666",
  export: "77777777-7777-4777-8777-777777777777",
  config: "88888888-8888-4888-8888-888888888888",
  owner: "99999999-9999-4999-8999-999999999999",
  inaccessibleCourse: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
} as const;

export const REPORTS_OPTIONS = {
  groups: [{ id: REPORTS_IDS.group, label: "Product team" }],
  learners: [{ id: REPORTS_IDS.learner, label: "Mina Shah" }],
  courses: [{ id: REPORTS_IDS.course, label: "Security Essentials" }],
  paths: [{ id: REPORTS_IDS.path, label: "Customer journey" }],
  canManageShared: true,
};

export const REPORTS_RESULT = {
  rows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      learner: { id: REPORTS_IDS.learner, name: "Mina Shah", email: "mina@example.com" },
      course: { id: REPORTS_IDS.course, title: "Security Essentials" },
      path: { id: REPORTS_IDS.path, title: "Customer journey" },
      status: "completed",
      progress: 100,
      score: 87,
      attempts: 2,
      certificate: { status: "active", issuedAt: "2026-04-14T12:00:00.000Z" },
      enrolledAt: "2026-02-02T09:00:00.000Z",
      completedAt: "2026-04-14T12:00:00.000Z",
      lastActivityAt: "2026-04-14T12:00:00.000Z",
      groupIds: [REPORTS_IDS.group],
      pathCourses: [
        {
          courseId: REPORTS_IDS.course,
          courseTitle: "Security Essentials",
          status: "inProgress",
          progress: 75,
          enrolledAt: "2026-02-02T09:00:00.000Z",
          completedAt: null,
        },
      ],
    },
  ],
  metrics: {
    learners: 1,
    platformCourses: 1,
    activeLearners30d: 1,
    courseEnrollments: 1,
    courseCompletions: 1,
    courseCompletionRate: 100,
    averageProgress: 100,
    averageScore: 87,
    activeCertificates: 1,
    certificatesIssued: 1,
    developmentPathsCompleted: 1,
  },
  breakdowns: {
    groups: [
      {
        id: REPORTS_IDS.group,
        label: "Product team",
        learners: 1,
        courseEnrollments: 1,
        completionRate: 100,
      },
    ],
    courses: [
      {
        id: REPORTS_IDS.course,
        label: "Security Essentials",
        learners: 1,
        courseEnrollments: 1,
        completionRate: 100,
      },
    ],
    paths: [
      {
        id: REPORTS_IDS.path,
        label: "Customer journey",
        learners: 1,
        courseEnrollments: 1,
        completionRate: 100,
      },
    ],
  },
  total: 1,
  page: 1,
  pageSize: 10,
  capturedAt: "2026-04-14T12:00:00.000Z",
};

export const REPORTS_INACCESSIBLE_CONFIGURATION = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Inaccessible course filter",
  visibility: "personal",
  query: {
    view: "learner",
    timezone: "UTC",
    groupIds: [],
    subjectId: REPORTS_IDS.learner,
    filter: {
      match: "all",
      rules: [{ field: "courseId", operator: "eq", value: REPORTS_IDS.inaccessibleCourse }],
    },
  },
  ownerId: REPORTS_IDS.owner,
  isAvailable: false,
  failureCode: "references_unavailable",
  updatedAt: "2026-04-14T12:00:00.000Z",
};
