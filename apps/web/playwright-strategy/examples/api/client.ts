export type FixtureApiClient = {
  createCourse: (payload: { title: string }) => Promise<{ id: string; title: string }>;
  deleteCourse: (courseId: string) => Promise<void>;
  createChapter: (payload: {
    courseId: string;
    title: string;
  }) => Promise<{ id: string; title: string }>;
};

export const createFixtureApiClient = (): FixtureApiClient => {
  return {
    async createCourse(payload) {
      return { id: globalThis.crypto.randomUUID(), title: payload.title };
    },
    async deleteCourse(_courseId) {
      // placeholder
    },
    async createChapter(payload) {
      return { id: globalThis.crypto.randomUUID(), title: payload.title };
    },
  };
};
