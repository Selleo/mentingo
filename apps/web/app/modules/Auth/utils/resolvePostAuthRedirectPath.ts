import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";

type ResolvePostAuthRedirectPathOptions = {
  pathname?: string | null;
};

export const resolvePostAuthRedirectPath = ({ pathname }: ResolvePostAuthRedirectPathOptions) => {
  if (!pathname) return LOGIN_REDIRECT_URL;

  const normalizedPathname = pathname.trim();

  if (!normalizedPathname) return LOGIN_REDIRECT_URL;
  if (!normalizedPathname.startsWith("/")) return LOGIN_REDIRECT_URL;
  if (normalizedPathname.startsWith("//")) return LOGIN_REDIRECT_URL;
  if (normalizedPathname.includes("://")) return LOGIN_REDIRECT_URL;
  if (normalizedPathname.startsWith("/auth")) return LOGIN_REDIRECT_URL;

  return normalizedPathname;
};
