import { isRouteErrorResponse } from "@remix-run/react";
import { isAxiosError, isCancel } from "axios";
import { useTranslation } from "react-i18next";
import { match, P } from "ts-pattern";

import ErrorPage from "~/components/ErrorPage/ErrorPage";

import type { IconName } from "~/types/shared";

export const APP_ERROR_KINDS = {
  SESSION_EXPIRED: "sessionExpired",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "notFound",
  CONNECTION: "connection",
  UNKNOWN: "unknown",
} as const;

type AppErrorKind = (typeof APP_ERROR_KINDS)[keyof typeof APP_ERROR_KINDS];

type ErrorPageContent = {
  iconName: IconName;
  actionLabelKey: string;
  actionTarget?: string;
};

const getErrorStatus = (error: unknown) =>
  match(error)
    .when(isRouteErrorResponse, (routeError) => routeError.status)
    .when(isAxiosError, (axiosError) => axiosError.response?.status)
    .otherwise(() => undefined);

export const getAppErrorKind = (error: unknown): AppErrorKind => {
  const isConnectionError = isCancel(error) || (isAxiosError(error) && !error.response);

  return match({ status: getErrorStatus(error), isConnectionError })
    .with({ status: 401 }, () => APP_ERROR_KINDS.SESSION_EXPIRED)
    .with({ status: 403 }, () => APP_ERROR_KINDS.FORBIDDEN)
    .with({ status: 404 }, () => APP_ERROR_KINDS.NOT_FOUND)
    .with({ isConnectionError: true }, () => APP_ERROR_KINDS.CONNECTION)
    .otherwise(() => APP_ERROR_KINDS.UNKNOWN);
};

const getErrorPageContent = (kind: AppErrorKind): ErrorPageContent =>
  match(kind)
    .returnType<ErrorPageContent>()
    .with(APP_ERROR_KINDS.SESSION_EXPIRED, () => ({
      iconName: "Logout",
      actionLabelKey: "errorPage.action.logIn",
      actionTarget: "/auth/login",
    }))
    .with(APP_ERROR_KINDS.FORBIDDEN, () => ({
      iconName: "Blocked",
      actionLabelKey: "common.button.goToDashboard",
      actionTarget: "/",
    }))
    .with(APP_ERROR_KINDS.NOT_FOUND, () => ({
      iconName: "Search",
      actionLabelKey: "common.button.goToDashboard",
      actionTarget: "/",
    }))
    .with(P.union(APP_ERROR_KINDS.CONNECTION, APP_ERROR_KINDS.UNKNOWN), () => ({
      iconName: "Warning",
      actionLabelKey: "errorPage.action.tryAgain",
    }))
    .exhaustive();

const getErrorStack = (error: unknown) =>
  match(error)
    .with(P.instanceOf(Error), ({ stack }) => stack)
    .otherwise(() => undefined);

type ErrorBoundaryProps = {
  error: unknown;
};

const CustomErrorBoundary = ({ error }: ErrorBoundaryProps) => {
  const { t } = useTranslation();

  const kind = getAppErrorKind(error);
  const { iconName, actionLabelKey, actionTarget } = getErrorPageContent(kind);
  const stack = import.meta.env.DEV ? getErrorStack(error) : undefined;

  return (
    <ErrorPage
      title={t(`errorPage.${kind}.title`)}
      description={t(`errorPage.${kind}.description`)}
      iconName={iconName}
      actionLabel={t(actionLabelKey)}
      to={actionTarget}
      onAction={actionTarget ? undefined : () => window.location.reload()}
    >
      {stack && (
        <pre className="max-h-64 overflow-auto rounded-sm bg-neutral-100 p-4 text-left text-xs text-neutral-600">
          {stack}
        </pre>
      )}
    </ErrorPage>
  );
};

export default CustomErrorBoundary;
