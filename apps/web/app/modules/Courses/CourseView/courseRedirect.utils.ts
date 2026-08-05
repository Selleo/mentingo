export const buildCourseRedirectPath = (requestUrl: string, slug: string) => {
  const redirectUrl = new URL(requestUrl);
  redirectUrl.pathname = `/course/${slug}`;

  return `${redirectUrl.pathname}${redirectUrl.search}`;
};
