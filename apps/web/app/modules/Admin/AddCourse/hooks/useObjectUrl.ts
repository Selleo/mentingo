import { useEffect, useState } from "react";

export const useObjectUrl = (file: unknown) => {
  const [objectUrl, setObjectUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!(file instanceof File)) {
      setObjectUrl(undefined);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setObjectUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [file]);

  return objectUrl;
};
