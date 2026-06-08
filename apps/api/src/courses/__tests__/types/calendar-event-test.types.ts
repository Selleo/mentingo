export type CalendarEventTestResponse = {
  id: string;
  sourceType: string;
  payload: {
    courseDueDate?: {
      courseId: string;
      groupId: string;
    };
  };
};
