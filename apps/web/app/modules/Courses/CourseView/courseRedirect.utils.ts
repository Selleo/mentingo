export const buildCourseRedirectPath = (requestUrl: string, slug: string) => {
  const redirectUrl = new URL(requestUrl);
  redirectUrl.pathname = `/course/${slug}`;

  return `${redirectUrl.pathname}${redirectUrl.search}`;
};

export const shouldRedirectToCourseSlug = (idOrSlug: string, slug?: string): slug is string =>
  Boolean(slug && slug !== idOrSlug);
