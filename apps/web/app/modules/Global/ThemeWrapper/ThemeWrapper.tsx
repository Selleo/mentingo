import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ThemeWrapperContent } from "./ThemeWrapperContent";

import type { FC, PropsWithChildren } from "react";

export const ThemeWrapper: FC<PropsWithChildren> = ({ children }) => {
  const { currentUser } = useCurrentUserStore();

  const isAuthenticated = Boolean(currentUser);

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return <ThemeWrapperContent>{children}</ThemeWrapperContent>;
};
