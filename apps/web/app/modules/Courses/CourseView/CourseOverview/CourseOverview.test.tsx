import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";

import CourseOverview from "./CourseOverview";

const mocks = vi.hoisted(() => ({
  generateTranslations: vi.fn(),
  getSessionForFile: vi.fn(),
  initVideoUpload: vi.fn(),
  toggleLearningMode: vi.fn(),
  updateCourse: vi.fn(),
  updateCourseMedia: vi.fn(),
  uploadVideo: vi.fn(),
  toast: vi.fn(),
}));

const course = {
  id: "course-1",
  availableLocales: ["en"],
  baseLanguage: "en",
  category: "Analytics",
  categoryId: "category-1",
  chapters: [],
  description: "Course description",
  estimatedDurationSeconds: 3_600,
  learningOutcomes: [],
  thumbnailPositionY: 50,
  thumbnailUrl: "/course-image.jpg",
  title: "Course title",
};

vi.mock("~/api/mutations", () => ({
  useToggleCourseStudentMode: () => ({
    mutate: mocks.toggleLearningMode,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useGenerateMissingTranslations", () => ({
  default: () => ({
    mutateAsync: mocks.generateTranslations,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useInitVideoUpload", () => ({
  useInitVideoUpload: () => ({
    mutateAsync: mocks.initVideoUpload,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useUpdateCourse", () => ({
  useUpdateCourse: () => ({
    mutateAsync: mocks.updateCourse,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useUpdateCourseMedia", () => ({
  useUpdateCourseMedia: () => ({
    mutateAsync: mocks.updateCourseMedia,
    isPending: false,
  }),
}));

vi.mock("~/api/queries", () => ({
  useCategories: () => ({
    data: [
      { id: "category-1", title: "Analytics" },
      { id: "category-2", title: "Data" },
    ],
  }),
  useCurrentUser: () => ({
    data: { permissions: [] },
  }),
}));

vi.mock("~/api/queries/useAIConfigured", () => ({
  useAIConfigured: () => ({
    data: { enabled: false },
  }),
}));

vi.mock("~/api/queries/admin/useHasMissingTranslations", () => ({
  useMissingTranslations: () => ({
    data: { data: { hasMissingTranslations: false } },
  }),
}));

vi.mock("~/hooks/useTusVideoUpload", () => ({
  useTusVideoUpload: () => ({
    getSessionForFile: mocks.getSessionForFile,
    uploadVideo: mocks.uploadVideo,
    isUploading: false,
  }),
}));

vi.mock("~/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course,
    isAdminExperience: true,
    isCourseStudentModeActive: false,
    isPreviewMode: false,
  }),
}));

vi.mock("~/modules/Admin/EditCourse/components/CourseLanguageSelector", () => ({
  CourseLanguageSelector: () => <div>Language selector</div>,
}));

vi.mock("./CourseCategoryEditor", () => ({
  default: ({ onChange }: { onChange: (categoryId: string) => Promise<void> }) => (
    <button type="button" onClick={() => void onChange("category-2")}>
      Change category
    </button>
  ),
}));

vi.mock("./CourseDescriptionModal", () => ({
  default: ({
    onChangeDescription,
    onSaveDescription,
  }: {
    onChangeDescription: (description: string) => void;
    onSaveDescription: () => Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={() => onChangeDescription("Updated description")}>
        Change description
      </button>
      <button type="button" onClick={() => void onSaveDescription()}>
        Save description
      </button>
    </div>
  ),
}));

vi.mock("./CourseHeroImage", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./CourseMediaModal", () => ({
  default: ({
    onImageSelection,
    onPositionChange,
    onSave,
    onTrailerSelection,
  }: {
    onImageSelection: (file: File) => void;
    onPositionChange: (position: number) => void;
    onSave: () => Promise<void>;
    onTrailerSelection: (file: File) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onImageSelection(new File(["image"], "course-image.jpg", { type: "image/jpeg" }))
        }
      >
        Select image
      </button>
      <button
        type="button"
        onClick={() =>
          onTrailerSelection(new File(["video"], "course-trailer.mp4", { type: "video/mp4" }))
        }
      >
        Select trailer
      </button>
      <button
        type="button"
        onClick={() => {
          const file = new File(["video"], "large-trailer.mp4", { type: "video/mp4" });
          Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 + 1 });
          onTrailerSelection(file);
        }}
      >
        Select oversized trailer
      </button>
      <button type="button" onClick={() => onPositionChange(75)}>
        Change position
      </button>
      <button type="button" onClick={() => void onSave()}>
        Save media
      </button>
    </div>
  ),
}));

vi.mock("./CourseOverviewActions", () => ({
  default: ({ onOpenDetails }: { onOpenDetails: () => void }) => (
    <button type="button" onClick={onOpenDetails}>
      Open details
    </button>
  ),
}));

vi.mock("./CourseSettingsDrawer", () => ({
  default: () => <div>Course settings drawer</div>,
}));

vi.mock("./CourseTitleEditor", () => ({
  default: ({
    onChange,
    onSave,
  }: {
    onChange: (title: string) => void;
    onSave: () => Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={() => onChange("Updated course title")}>
        Change title
      </button>
      <button type="button" onClick={() => void onSave()}>
        Save title
      </button>
    </div>
  ),
}));

vi.mock("./CourseWhatYouWillLearn", () => ({
  default: () => <div>Learning outcomes</div>,
}));

describe("CourseOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:course-image"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    const uploadSession = { resourceId: "resource-1", uploadUrl: "https://upload.test" };

    mocks.initVideoUpload.mockResolvedValue(uploadSession);
    mocks.getSessionForFile.mockImplementation(
      async ({ init }: { init: () => Promise<typeof uploadSession> }) => init(),
    );
    mocks.uploadVideo.mockResolvedValue(undefined);
    mocks.updateCourseMedia.mockResolvedValue(undefined);
  });

  it("uploads selected trailer and saves the image with its position", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <MemoryRouter>
        <CourseOverview
          idOrSlug="course-slug"
          language="en"
          onLanguageChange={vi.fn()}
          openGenerateTranslationModal={false}
          setOpenGenerateTranslationModal={vi.fn()}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId(COURSE_OVERVIEW_HANDLES.EDIT_MEDIA_BUTTON));
    await user.click(screen.getByRole("button", { name: "Select image" }));
    await user.click(screen.getByRole("button", { name: "Select trailer" }));
    await user.click(screen.getByRole("button", { name: "Change position" }));
    await user.click(screen.getByRole("button", { name: "Save media" }));

    await waitFor(() => {
      expect(mocks.initVideoUpload).toHaveBeenCalledWith({
        filename: "course-trailer.mp4",
        sizeBytes: 5,
        mimeType: "video/mp4",
        title: "course-trailer.mp4",
        resource: "course",
        entityId: "course-1",
        entityType: "course",
        relationshipType: "trailer",
      });
      expect(mocks.uploadVideo).toHaveBeenCalledWith({
        file: expect.objectContaining({ name: "course-trailer.mp4" }),
        session: {
          resourceId: "resource-1",
          uploadUrl: "https://upload.test",
        },
      });
      expect(mocks.updateCourseMedia).toHaveBeenCalledWith({
        courseId: "course-1",
        data: {
          language: "en",
          thumbnailPositionY: 75,
          image: expect.objectContaining({ name: "course-image.jpg" }),
        },
      });
      expect(URL.createObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({ name: "course-image.jpg" }),
      );
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:course-image");
    });
  });

  it("shows a toast and skips trailers above the maximum file size", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <MemoryRouter>
        <CourseOverview
          idOrSlug="course-slug"
          language="en"
          onLanguageChange={vi.fn()}
          openGenerateTranslationModal={false}
          setOpenGenerateTranslationModal={vi.fn()}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId(COURSE_OVERVIEW_HANDLES.EDIT_MEDIA_BUTTON));
    await user.click(screen.getByRole("button", { name: "Select oversized trailer" }));

    expect(mocks.toast).toHaveBeenCalledWith({
      description: "Video file exceeds the maximum allowed size",
      variant: "destructive",
    });
    expect(mocks.initVideoUpload).not.toHaveBeenCalled();
  });

  it("updates metadata from the shared form state", async () => {
    const user = userEvent.setup();
    mocks.updateCourse.mockResolvedValue(undefined);

    renderWith().render(
      <MemoryRouter>
        <CourseOverview
          idOrSlug="course-slug"
          language="en"
          onLanguageChange={vi.fn()}
          openGenerateTranslationModal={false}
          setOpenGenerateTranslationModal={vi.fn()}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Change title" }));
    await user.click(screen.getByRole("button", { name: "Save title" }));
    await user.click(screen.getByRole("button", { name: "Change category" }));
    await user.click(screen.getByRole("button", { name: "Open details" }));
    await user.click(screen.getByRole("button", { name: "Change description" }));
    await user.click(screen.getByRole("button", { name: "Save description" }));

    await waitFor(() => {
      expect(mocks.updateCourse).toHaveBeenCalledWith({
        courseId: "course-1",
        data: {
          language: "en",
          title: "Updated course title",
        },
        courseOverviewCache: { idOrSlug: "course-slug", language: "en" },
      });
      expect(mocks.updateCourse).toHaveBeenCalledWith({
        courseId: "course-1",
        data: {
          categoryId: "category-2",
          language: "en",
        },
        courseOverviewCache: {
          categoryTitle: "Data",
          idOrSlug: "course-slug",
          language: "en",
        },
      });
      expect(mocks.updateCourse).toHaveBeenCalledWith({
        courseId: "course-1",
        data: {
          description: "Updated description",
          language: "en",
        },
        courseOverviewCache: { idOrSlug: "course-slug", language: "en" },
      });
    });
  });
});
