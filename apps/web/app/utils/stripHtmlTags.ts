/**
 * Removes HTML tags from a string.
 * @param input - The string from which HTML tags should be removed.
 * @returns The input string without HTML tags.
 */
export const stripHtmlTags = (input: string) => input.replace(/<[^>]*>/g, "");
