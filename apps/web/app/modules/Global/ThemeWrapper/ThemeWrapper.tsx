import { type FC, type PropsWithChildren, useEffect } from "react";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import Loader from "~/modules/common/Loader/Loader";
import { useTheme } from "~/modules/Theme";

export const ThemeWrapper: FC<PropsWithChildren> = ({ children }) => {
  const { setPrimaryColor } = useTheme();
  const { data: globalSettingsData, isLoading, isSuccess } = useGlobalSettings();

  useEffect(() => {
    if (isSuccess && globalSettingsData?.primaryColor) {
      setPrimaryColor(globalSettingsData.primaryColor);
    }
  }, [isSuccess, globalSettingsData, setPrimaryColor]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  return <>{children}</>;
};
