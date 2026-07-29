import { COURSE_FEATURE, ENTITY_TYPES, LESSON_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { AiMentorConfigurationService } from "./ai-mentor-configuration.service";

import type { CourseFeaturePolicyService } from "src/courses/course-feature-policy.service";
import type { MasterCourseService } from "src/courses/master-course.service";
import type { AdminLessonService } from "src/lesson/services/adminLesson.service";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { AiMentorConfigurationRepository } from "../repositories/ai-mentor-configuration.repository";
import type { AiMentorConfigurationGraphService } from "./ai-mentor-configuration-graph.service";

const courseId = "4eeb7cf8-c437-4a73-867d-d58e67827eb1";
const lessonId = "d223ef10-f19e-4af4-9dfc-55b60edc6fc1";
const currentUser = {
  userId: "91f378d3-8021-4269-881d-4d896ee61d66",
  tenantId: "242359db-654d-4af2-93ee-71ac0ddb4d9f",
} as CurrentUserType;

describe("AiMentorConfigurationService generation authoring gate", () => {
  const createService = () => {
    const repository = {
      findCourseAuthoringContext: jest.fn().mockResolvedValue({
        courseId,
        baseLanguage: SUPPORTED_LANGUAGES.EN,
      }),
      findLessonContext: jest.fn().mockResolvedValue({
        courseId,
        lessonId,
        lessonType: LESSON_TYPES.AI_MENTOR,
        aiMentorLessonId: "13647a0c-5dc8-407d-a041-2a8aec0fb4eb",
        configurationId: null,
        configurationType: null,
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [SUPPORTED_LANGUAGES.EN],
      }),
    };
    const graphService = {};
    const adminLessonService = { validateAccess: jest.fn().mockResolvedValue(undefined) };
    const masterCourseService = {
      assertCourseContentEditable: jest.fn().mockResolvedValue(undefined),
      assertCourseContentEditableByLessonId: jest.fn().mockResolvedValue(undefined),
    };
    const courseFeaturePolicyService = {
      assertCourseFeatureEnabled: jest.fn().mockResolvedValue(undefined),
      assertCourseFeatureEnabledByLessonId: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiMentorConfigurationService(
      repository as unknown as AiMentorConfigurationRepository,
      graphService as AiMentorConfigurationGraphService,
      adminLessonService as unknown as AdminLessonService,
      masterCourseService as unknown as MasterCourseService,
      courseFeaturePolicyService as unknown as CourseFeaturePolicyService,
    );

    return {
      adminLessonService,
      courseFeaturePolicyService,
      masterCourseService,
      repository,
      service,
    };
  };

  it("authorizes a new unsaved lesson at course scope", async () => {
    const {
      adminLessonService,
      courseFeaturePolicyService,
      masterCourseService,
      service,
    } = createService();

    await expect(
      service.prepareGenerationAuthoringContext(courseId, undefined, currentUser),
    ).resolves.toEqual({ courseId, baseLanguage: SUPPORTED_LANGUAGES.EN });
    expect(masterCourseService.assertCourseContentEditable).toHaveBeenCalledWith(courseId);
    expect(courseFeaturePolicyService.assertCourseFeatureEnabled).toHaveBeenCalledWith(
      courseId,
      COURSE_FEATURE.CURRICULUM_EDITING,
    );
    expect(adminLessonService.validateAccess).toHaveBeenCalledWith(
      ENTITY_TYPES.COURSE,
      currentUser,
      courseId,
    );
  });

  it("authorizes an existing AI Mentor lesson and rejects a mismatched course", async () => {
    const { service } = createService();

    await expect(
      service.prepareGenerationAuthoringContext(
        "f886da17-ae2f-48c6-b565-d999779ff297",
        lessonId,
        currentUser,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
