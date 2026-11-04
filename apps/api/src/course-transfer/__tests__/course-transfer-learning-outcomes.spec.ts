import { CourseTransferMaterializerService } from "../services/course-transfer-materializer.service";

describe("archive course learning outcomes updates", () => {
  it("preserves every localized outcome when updating an existing imported course", async () => {
    const updateTargetCourse = jest.fn().mockResolvedValue(undefined);
    const materializer = new CourseTransferMaterializerService(
      { updateTargetCourse } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const learningOutcomes = {
      en: Array.from({ length: 9 }, (_, index) => `Outcome ${index + 1}`),
      pl: ["Rozpoznaj ryzyko", "Oceń wynik"],
    };

    await materializer["updateTargetCourseFromSource"]({
      targetCourseId: "existing-target-id",
      sourceCourseId: "source-course-id",
      sourceTenantId: "source-tenant-id",
      targetAuthorId: "actor-id",
      categoryId: "category-id",
      sourceSnapshot: {
        course: {
          id: "source-course-id",
          title: { en: "Updated course" },
          description: { en: "Updated description" },
          thumbnailS3Key: null,
          authorMetadata: null,
          learningOutcomes,
        },
      },
      courseSettings: { certificateSignature: null },
      resourceCollection: { courses: { internal: {} } },
    } as never);

    expect(updateTargetCourse).toHaveBeenCalledWith(
      "existing-target-id",
      expect.objectContaining({ learningOutcomes }),
    );
  });
});
