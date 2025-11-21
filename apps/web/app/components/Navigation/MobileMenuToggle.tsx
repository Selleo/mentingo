import { useTranslation } from "react-i18next";

import type { Dispatch, SetStateAction } from "react";

type MobileMenuToggleProps = {
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  hasConfigurationIssues?: boolean;
};

export function MobileMenuToggle({
  isMobileNavOpen,
  setIsMobileNavOpen,
  hasConfigurationIssues,
}: MobileMenuToggleProps) {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => setIsMobileNavOpen((prevState) => !prevState)}
      className="relative flex w-min gap-x-2 rounded-lg bg-neutral-50 px-3 py-2 2xl:sr-only"
    >
      {hasConfigurationIssues && (
        <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
      )}
      {isMobileNavOpen ? (
        <>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M18.851 6.45129C18.9366 6.36587 19.0044 6.26446 19.0507 6.15282C19.0971 6.04118 19.1209 5.92152 19.121 5.80065C19.1211 5.67979 19.0974 5.56009 19.0512 5.4484C19.005 5.33671 18.9373 5.2352 18.8518 5.14969C18.7664 5.06417 18.665 4.99631 18.5534 4.94999C18.4417 4.90367 18.3221 4.87979 18.2012 4.87972C18.0803 4.87964 17.9606 4.90337 17.849 4.94956C17.7373 4.99574 17.6358 5.06347 17.5502 5.14889L11.9998 10.6993L6.45104 5.14889C6.27833 4.97618 6.04409 4.87915 5.79984 4.87915C5.55559 4.87915 5.32135 4.97618 5.14864 5.14889C4.97593 5.3216 4.87891 5.55584 4.87891 5.80009C4.87891 6.04433 4.97593 6.27858 5.14864 6.45129L10.699 12.0001L5.14864 17.5489C5.06313 17.6344 4.99529 17.7359 4.94901 17.8477C4.90273 17.9594 4.87891 18.0791 4.87891 18.2001C4.87891 18.321 4.90273 18.4408 4.94901 18.5525C4.99529 18.6642 5.06313 18.7658 5.14864 18.8513C5.32135 19.024 5.55559 19.121 5.79984 19.121C5.92078 19.121 6.04054 19.0972 6.15227 19.0509C6.264 19.0046 6.36553 18.9368 6.45104 18.8513L11.9998 13.3009L17.5502 18.8513C17.723 19.0238 17.9571 19.1206 18.2012 19.1205C18.4453 19.1203 18.6793 19.0232 18.8518 18.8505C19.0243 18.6778 19.1212 18.4436 19.121 18.1995C19.1209 17.9554 19.0238 17.7214 18.851 17.5489L13.3006 12.0001L18.851 6.45129Z"
              fill="#121521"
            />
          </svg>
          <span className="body-sm-md text-neutral-900">{t("navigationSideBar.close")}</span>
        </>
      ) : (
        <>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M3 6H21V8H3V6ZM3 11H21V13H3V11ZM3 16H21V18H3V16Z" fill="black" />
          </svg>
          <span className="body-sm-md text-neutral-900">{t("navigationSideBar.menu")}</span>
        </>
      )}
    </button>
  );
}
