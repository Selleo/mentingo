type AuthorNameParts = {
  firstName?: string | null;
  lastName?: string | null;
};

export const DEFAULT_AUTHOR_STAT_IMAGE =
  "https://images.unsplash.com/vector-1756860574486-9e0c75696f6c?q=80&w=1160&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export const DEFAULT_AUTHOR_MODAL_IMAGE =
  "https://plus.unsplash.com/premium_vector-1721991052634-15ade548d2df?q=80&w=1160&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export const getAuthorName = (author?: AuthorNameParts) => {
  if (!author?.firstName && !author?.lastName) return "";

  return `${author.firstName ?? ""} ${author.lastName ?? ""}`.trim();
};
