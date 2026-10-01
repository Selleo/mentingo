import { useTranslation } from "react-i18next";

type Props = {
  name: string;
  deleted: boolean;
};

export function AuthorName({ name, deleted }: Props) {
  const { t } = useTranslation();

  return deleted ? t("common.deletedUser") : name;
}
