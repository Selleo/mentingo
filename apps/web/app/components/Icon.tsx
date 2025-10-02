import { memo } from "react";

import * as icons from "../assets/svgs";

import type { IconName, SVGComponentProps } from "~/types/shared";

type IconProps = SVGComponentProps & {
  name: IconName;
};

export const Icon = memo(({ name, className, ...restProps }: IconProps) => {
  // eslint-disable-next-line import/namespace
  const IconComponent = icons[name];

  return <IconComponent {...restProps} className={className} />;
});
