import { isEmpty } from "lodash-es";

export const filterChangedData = <T>(data: Partial<T>, originalData?: Partial<T>) =>
  Object.entries(data).reduce((acc, [key, value]) => {
    if (!isEmpty(value) && value !== originalData?.[key as keyof typeof originalData]) {
      acc[key as keyof T] = value as T[keyof T];
    }
    return acc;
  }, {} as Partial<T>);
