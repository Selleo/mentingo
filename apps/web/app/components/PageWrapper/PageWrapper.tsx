import { useNavigate } from "@remix-run/react";

import { Icon } from "~/components/Icon";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { HTMLAttributes, ReactNode } from "react";

type PageWrapperProps = HTMLAttributes<HTMLDivElement> & {
  breadcrumbs?: { title: string; href: string }[];
  backButton?: BackButton;
  isBarebones?: boolean;
  children: ReactNode;
  className?: string;
};

type BackButton = { href: string; title: string };

type Breadcrumb = { title: string; href: string };

type BreadcrumbsProps = {
  breadcrumbs: Breadcrumb[];
  backButton?: BackButton;
};

export const Breadcrumbs = ({ breadcrumbs = [], backButton }: BreadcrumbsProps) => {
  const navigate = useNavigate();
  if (!breadcrumbs.length) return null;

  const lastIndex = breadcrumbs.length - 1;
  const lastBreadcrumb = breadcrumbs[lastIndex];

  return (
    <BreadcrumbList className="mb-4">
      {backButton && (
        <BreadcrumbItem className="mr-3">
          <BreadcrumbLink className="details-md cursor-pointer text-primary-800">
            <Button
              variant="outline"
              onClick={() => navigate(backButton.href)}
              className="h-min w-auto text-sm"
            >
              <Icon name="ChevronLeft" className="mr-2 size-3" />
              {backButton.title}
            </Button>
          </BreadcrumbLink>
        </BreadcrumbItem>
      )}
      {breadcrumbs.slice(0, lastIndex).map(({ href, title }, index) => (
        <BreadcrumbItem key={index}>
          <BreadcrumbLink
            className="details-md text-neutral-800 hover:text-neutral-800"
            href={href}
          >
            {title}
          </BreadcrumbLink>
          <BreadcrumbSeparator />
        </BreadcrumbItem>
      ))}
      <BreadcrumbItem>
        <BreadcrumbLink
          className="details-md text-neutral-950 hover:text-neutral-950"
          href={lastBreadcrumb.href}
        >
          {lastBreadcrumb.title}
        </BreadcrumbLink>
      </BreadcrumbItem>
    </BreadcrumbList>
  );
};

export const PageWrapper = ({
  className,
  breadcrumbs,
  backButton,
  isBarebones,
  children,
  ...props
}: PageWrapperProps) => {
  const hasBreadcrumbs = Boolean(breadcrumbs);

  const classes = cn(
    !isBarebones && "w-full pt-6 px-4 pb-4 md:px-6 md:pb-6 3xl:pt-12 3xl:px-8 3xl:pb-8",
    {
      "pt-8 md:pt-6 3xl:pt-6 3xl:pb-2 [&_.breadcrumbs]:mb-2": hasBreadcrumbs,
    },
    className,
  );

  return (
    <div className={classes} {...props}>
      {breadcrumbs && (
        <div className="breadcrumbs">
          <Breadcrumbs breadcrumbs={breadcrumbs} backButton={backButton} />
        </div>
      )}
      {children}
    </div>
  );
};
