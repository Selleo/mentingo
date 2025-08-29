export const getCourseStatus = (status: string) => {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "private":
      return "Private";
    default:
      return "Draft";
  }
};
