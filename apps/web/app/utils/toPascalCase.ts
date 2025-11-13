import { capitalize } from "lodash-es";

export const pascalCase = (text: string) => {
  return text
    .split(" ")
    .map((el) => capitalize(el))
    .join(" ");
};
