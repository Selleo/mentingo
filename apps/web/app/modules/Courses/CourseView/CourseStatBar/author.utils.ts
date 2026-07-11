type AuthorNameParts = {
  firstName?: string | null;
  lastName?: string | null;
};

export const DEFAULT_AUTHOR_STAT_IMAGE =
  "https://images.unsplash.com/vector-1756860574486-9e0c75696f6c?q=80&w=1160&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export const DEFAULT_AUTHOR_MODAL_IMAGE =
  "https://images.unsplash.com/photo-1616065297556-f05bc00c9a3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB3b21hbiUyMGZ1bGwlMjBib2R5JTIwcG9ydHJhaXQlMjBidXNpbmVzc3xlbnwxfHx8fDE3NzM4MjA4MTV8MA&ixlib=rb-4.1.0&q=80&w=1080";

export const getAuthorName = (author?: AuthorNameParts) => {
  if (!author?.firstName && !author?.lastName) return "";

  return `${author.firstName ?? ""} ${author.lastName ?? ""}`.trim();
};
