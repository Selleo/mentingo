import readXlsxFile from "read-excel-file/node";

import { ReportsExportRenderer } from "./reports-export.renderer";

import type { ReportsQuery, ReportsResult } from "./schemas/reports.schema";

const collect = async (stream: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const query: ReportsQuery = {
  view: "developmentPaths",
  language: "en",
  timezone: "Europe/Warsaw",
  groupIds: ["3f186e0a-5944-4f6c-b468-e1c2705a0ec9"],
  subjectId: "0f36f99d-9864-4f26-84ef-7d26450fcc27",
  filter: {
    match: "all",
    rules: [{ field: "status", operator: "eq", value: "completed" }],
  },
  page: 1,
  pageSize: 25,
};

const result: ReportsResult = {
  rows: ["active", "expired", "revoked", "notEarned"].map((certificateStatus, index) => ({
    id: `row-${index}`,
    learner: {
      id: "0f36f99d-9864-4f26-84ef-7d26450fcc27",
      name: index === 0 ? '=HYPERLINK("https://example.invalid")' : `Learner ${index}`,
      email: `learner${index}@example.com`,
    },
    course: { id: "3f186e0a-5944-4f6c-b468-e1c2705a0ec9", title: "Safety course" },
    path: { id: "3f186e0a-5944-4f6c-b468-e1c2705a0ec9", title: "Safety path" },
    status: "completed",
    progress: 100,
    score: index === 3 ? null : 88,
    attempts: index + 1,
    certificate: {
      status: certificateStatus as "active" | "expired" | "revoked" | "notEarned",
      issuedAt: null,
    },
    enrolledAt: "2026-01-02T10:00:00.000Z",
    completedAt: "2026-02-03T11:00:00.000Z",
    lastActivityAt: "2026-02-03T11:00:00.000Z",
    groupIds: [query.groupIds[0]],
    pathCourses: [
      {
        courseId: "3f186e0a-5944-4f6c-b468-e1c2705a0ec9",
        courseTitle: "Safety course",
        status: "completed",
        progress: 100,
        enrolledAt: "2026-01-02T10:00:00.000Z",
        completedAt: "2026-02-03T11:00:00.000Z",
      },
    ],
  })),
  metrics: {
    platformCourses: 2,
    learners: 4,
    activeLearners30d: 2,
    courseEnrollments: 4,
    courseCompletions: 4,
    courseCompletionRate: 100,
    averageProgress: 100,
    averageScore: 88,
    activeCertificates: 3,
    certificatesIssued: 3,
    developmentPathsCompleted: 1,
  },
  breakdowns: { groups: [], courses: [], paths: [] },
  total: 4,
  page: 1,
  pageSize: 100,
  capturedAt: "2026-02-03T11:00:00.000Z",
};

describe("ReportsExportRenderer", () => {
  const renderer = new ReportsExportRenderer();

  it("renders a readable summary and typed records in XLSX", async () => {
    const courseId = "3f186e0a-5944-4f6c-b468-e1c2705a0ec9";
    const buffer = await collect(
      await renderer.render(
        "xlsx",
        result,
        {
          ...query,
          filter: {
            match: "all",
            rules: [
              { field: "status", operator: "eq", value: "completed" },
              { field: "courseId", operator: "eq", value: courseId },
            ],
          },
        },
        new Date("2026-02-03T12:00:00.000Z"),
        {
          groups: ["Product Team"],
          subject: "Leadership path",
          recordLabels: { [courseId]: "Safety course" },
        },
      ),
    );
    const summary = (await readXlsxFile(buffer, { sheet: 1 })).flat().map(String);
    const records = await readXlsxFile(buffer, { sheet: 2 });
    const recordCells = records.flat().map((cell) => String(cell ?? ""));

    expect(summary.some((cell) => cell.startsWith("Development paths · Leadership path |"))).toBe(
      true,
    );
    expect(summary).toContain("Product Team");
    expect(summary).toContain("CONDITIONS - ALL MUST MATCH");
    expect(summary.some((cell) => cell.includes("Europe/Warsaw"))).toBe(false);
    expect(summary.some((cell) => cell.includes("Completion status is Completed"))).toBe(true);
    expect(summary.some((cell) => cell.includes("Course is Safety course"))).toBe(true);
    expect(summary.some((cell) => cell.includes(courseId))).toBe(false);
    expect(summary).toContain("4");
    expect(summary).toContain("Learning activity");

    const [header, ...rows] = records;
    expect(header).toContain("Learner");
    expect(header).not.toContain("Development path");
    expect(rows).toHaveLength(4);
    expect(rows[0][header.indexOf("Progress")]).toBe(1);
    expect(rows[0][header.indexOf("Enrolled at")]).toBeInstanceOf(Date);
    expect(recordCells).toContain("Safety course: Completed (100%)");
    expect(recordCells).toContain('\'=HYPERLINK("https://example.invalid")');
    expect(recordCells).not.toContain('=HYPERLINK("https://example.invalid")');
    expect(recordCells).toContain("-");
    expect(recordCells).not.toContain("'-");
    expect(recordCells.filter((cell) => cell === "learner0@example.com")).toHaveLength(1);
    expect(recordCells.filter((cell) => cell === "learner3@example.com")).toHaveLength(1);
  });

  it("renders a PDF without loading external content", async () => {
    const buffer = await collect(
      await renderer.render("pdf", result, query, new Date("2026-02-03T12:00:00.000Z")),
    );
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
