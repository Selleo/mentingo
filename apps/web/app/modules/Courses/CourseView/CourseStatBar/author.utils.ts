type AuthorNameParts = {
  firstName?: string | null;
  lastName?: string | null;
};

export const getAuthorName = (author?: AuthorNameParts) => {
  if (!author?.firstName && !author?.lastName) return "";

  return `${author.firstName ?? ""} ${author.lastName ?? ""}`.trim();
};
