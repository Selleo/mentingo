import { join } from "node:path";

const webRoot = process.cwd().endsWith("apps/web")
  ? process.cwd()
  : join(process.cwd(), "apps/web");
const fixturePath = (filename: string) => join(webRoot, "e2e/data/curriculum/files", filename);

export const CURRICULUM_TEST_DATA = {
  youtubeVideoUrl: "https://www.youtube.com/watch?v=PvB0kWs2IPQ",
  files: {
    image: fixturePath("content-image.png"),
    video: fixturePath("content-video.mp4"),
    documentPreview: fixturePath("content-file-preview.pdf"),
    fileDownload: fixturePath("content-file-download.pdf"),
    presentationPreview: fixturePath("content-presentation-preview.pptx"),
    presentationDownload: fixturePath("content-presentation-download.pptx"),
    quizPhotoSingleChoice: fixturePath("quiz-photo-single-choice.png"),
    quizPhotoMultipleChoice: fixturePath("quiz-photo-multiple-choice.png"),
    aiMentorResource: fixturePath("ai-mentor-resource.pdf"),
    aiMentorAvatar: fixturePath("ai-mentor-avatar.png"),
  },
} as const;
