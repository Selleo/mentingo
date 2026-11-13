import type { DeleteCourseChatMessageResponse } from "src/course-chat/schemas/course-chat.schema";

export type CourseChatDeletedMessage = {
  payload: DeleteCourseChatMessageResponse;
  threadRemoved: boolean;
};
