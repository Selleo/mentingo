import { createContext } from "react";

type FileDropHandler = ((files: File[]) => void) | null;

/** Lets the conversation delegate attachments to its mounted composer's existing upload flow. */
export const CourseGenerationFileDropContext = createContext<
  ((handler: FileDropHandler) => void) | null
>(null);
