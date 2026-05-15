import { useCallback, useReducer } from "react";

type CourseChatState = {
  openMessageId?: string;
  page: number;
};

const COURSE_CHAT_REDUCER_TYPE = {
  SET_OPEN_MESSAGE: "set_open_message",
  SET_PAGE: "set_page",
  TOGGLE_OPEN_MESSAGE: "toggle_open_message",
} as const;

type CourseChatAction =
  | { type: typeof COURSE_CHAT_REDUCER_TYPE.SET_OPEN_MESSAGE; messageId?: string }
  | { type: typeof COURSE_CHAT_REDUCER_TYPE.SET_PAGE; page: number }
  | { type: typeof COURSE_CHAT_REDUCER_TYPE.TOGGLE_OPEN_MESSAGE; messageId: string };

const initialCourseChatState: CourseChatState = { page: 1 };

function courseChatReducer(state: CourseChatState, action: CourseChatAction): CourseChatState {
  switch (action.type) {
    case COURSE_CHAT_REDUCER_TYPE.SET_OPEN_MESSAGE:
      return { ...state, openMessageId: action.messageId };
    case COURSE_CHAT_REDUCER_TYPE.SET_PAGE:
      return { ...state, page: action.page, openMessageId: undefined };
    case COURSE_CHAT_REDUCER_TYPE.TOGGLE_OPEN_MESSAGE:
      return {
        ...state,
        openMessageId: state.openMessageId === action.messageId ? undefined : action.messageId,
      };
    default:
      return state;
  }
}

export function useCourseChatState() {
  const [state, dispatch] = useReducer(courseChatReducer, initialCourseChatState);

  return {
    ...state,
    setOpenMessage: useCallback(
      (messageId?: string) =>
        dispatch({ type: COURSE_CHAT_REDUCER_TYPE.SET_OPEN_MESSAGE, messageId }),
      [],
    ),
    setPage: useCallback(
      (page: number) => dispatch({ type: COURSE_CHAT_REDUCER_TYPE.SET_PAGE, page }),
      [],
    ),
    toggleOpenMessage: useCallback(
      (messageId: string) =>
        dispatch({ type: COURSE_CHAT_REDUCER_TYPE.TOGGLE_OPEN_MESSAGE, messageId }),
      [],
    ),
  };
}
