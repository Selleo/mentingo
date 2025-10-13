import { type FC, type PropsWithChildren, useEffect } from "react";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import Loader from "~/modules/common/Loader/Loader";
import { useTheme } from "~/modules/Theme";

export const ThemeWrapper: FC<PropsWithChildren> = ({ children }) => {
  const { setColorSchema } = useTheme();
  const { data: globalSettingsData, isLoading, isSuccess } = useGlobalSettings();

  useEffect(() => {
    if (isSuccess && globalSettingsData?.primaryColor && globalSettingsData?.contrastColor) {
      setColorSchema(globalSettingsData.primaryColor, globalSettingsData.contrastColor);
    }
  }, [isSuccess, globalSettingsData, setColorSchema]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  return <>{children}</>;
};
