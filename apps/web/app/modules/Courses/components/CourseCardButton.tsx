import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/lib/formatters/priceFormatter";

type CourseCardButtonProps = {
  currency: string;
  enrolled: boolean;
  canManageUsers: boolean;
  priceInCents: number;
  isScormCreatePage?: boolean;
};

const CourseCardButton = ({
  currency,
  enrolled,
  canManageUsers,
  priceInCents,
  isScormCreatePage,
}: CourseCardButtonProps) => {
  const { t } = useTranslation();
  const getButtonLabel = (enrolled: boolean, canManageUsers: boolean) => {
    if (enrolled) {
      return (
        <span className="flex items-center gap-x-2">
          <Icon name="ArrowRight" className="size-4 text-white" />{" "}
          {t("clientStatisticsView.button.continue")}
        </span>
      );
    }

    if (isScormCreatePage) return t("clientStatisticsView.button.readMore");

    if (canManageUsers) return t("clientStatisticsView.button.view");

    if (priceInCents)
      return `${t("clientStatisticsView.button.enroll")} - ${formatPrice(priceInCents, currency)}`;

    return t("clientStatisticsView.button.enroll");
  };

  const buttonLabel = getButtonLabel(enrolled, canManageUsers);

  return (
    <Button variant={enrolled ? "secondary" : "primary"} className="mt-auto w-full">
      {buttonLabel}
    </Button>
  );
};

export default CourseCardButton;
