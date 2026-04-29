export type CourseResumeProgress = {
  courseId: string;
  lessonId: string;
  chapterId?: string;
  updatedAt: number;
};

const STORAGE_PREFIX = "mentingo:course-resume:v1";

function getStorageKey(params: { userId?: string; courseId: string }) {
  const userKey = params.userId ?? "anon";
  return `${STORAGE_PREFIX}:${userKey}:${params.courseId}`;
}

export function saveCourseResumeProgress(params: {
  userId?: string;
  courseId: string;
  lessonId: string;
  chapterId?: string;
}) {
  if (typeof window === "undefined") return;
  if (!params.courseId || !params.lessonId) return;

  const key = getStorageKey({ userId: params.userId, courseId: params.courseId });
  const value: CourseResumeProgress = {
    courseId: params.courseId,
    lessonId: params.lessonId,
    chapterId: params.chapterId,
    updatedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

export function getCourseResumeProgress(params: { userId?: string; courseId: string }) {
  if (typeof window === "undefined") return undefined;
  if (!params.courseId) return undefined;

  const key = getStorageKey({ userId: params.userId, courseId: params.courseId });

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CourseResumeProgress;

    if (!parsed?.courseId || !parsed?.lessonId || parsed.courseId !== params.courseId) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

