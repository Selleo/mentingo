import { Link } from "@remix-run/react";
import { LOGIN_METHODS, OAUTH_LOGIN_METHODS } from "@repo/shared";
import { ArrowUpRight, SquareAsterisk } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useUpdateLoginMethod } from "~/api/mutations/admin/useUpdateLoginMethod";
import { useLoginMethodSetup } from "~/api/queries/admin/useLoginMethodSetup";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { OAUTH_LOGIN_METHOD_ENV_GROUP_IDS } from "~/modules/Admin/Envs/Envs.constants";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import type { LoginMethod, OAuthLoginMethod } from "@repo/shared";
import type { GetLoginMethodSetupResponse } from "~/api/generated-api";

type LoginMethodSetup = GetLoginMethodSetupResponse["data"];

const OAUTH_LOGIN_METHOD_VALUES: readonly LoginMethod[] = Object.values(OAUTH_LOGIN_METHODS);

const isOAuthLoginMethod = (method: LoginMethod): method is OAuthLoginMethod =>
  OAUTH_LOGIN_METHOD_VALUES.includes(method);

const isMissingProviderCredentials = (method: LoginMethod, setup?: LoginMethodSetup) =>
  isOAuthLoginMethod(method) && Boolean(setup?.missingCredentials[method].length);

const LOGIN_METHOD_ICON_CLASS_NAME = "size-4 shrink-0";

const renderLoginMethodIcon = (method: LoginMethod) =>
  match(method)
    .with(LOGIN_METHODS.GOOGLE, () => (
      <Icon name="Google" className={LOGIN_METHOD_ICON_CLASS_NAME} />
    ))
    .with(LOGIN_METHODS.MICROSOFT, () => (
      <Icon name="Microsoft" className={LOGIN_METHOD_ICON_CLASS_NAME} />
    ))
    .with(LOGIN_METHODS.SLACK, () => <Icon name="Slack" className={LOGIN_METHOD_ICON_CLASS_NAME} />)
    .with(LOGIN_METHODS.MAGIC_LINK, () => (
      <Icon name="WandSparkles" className={LOGIN_METHOD_ICON_CLASS_NAME} />
    ))
    .with(LOGIN_METHODS.PASSWORD, () => <SquareAsterisk className={LOGIN_METHOD_ICON_CLASS_NAME} />)
    .exhaustive();

export default function LoginMethods() {
  const { t } = useTranslation();

  const { data: loginMethodSetup, isError: isLoginMethodSetupError } = useLoginMethodSetup();
  const { mutate: updateLoginMethod, isPending: isUpdatingLoginMethod } = useUpdateLoginMethod();

  return (
    <Card id="login-methods" data-testid={SETTINGS_PAGE_HANDLES.LOGIN_METHODS_CARD}>
      <CardHeader>
        <CardTitle className="h5">{t("loginMethods.title")}</CardTitle>
        <CardDescription className="body-lg-md">{t("loginMethods.description")}</CardDescription>
      </CardHeader>
      <CardContent className="body-sm-md flex flex-col divide-y divide-neutral-200">
        {isLoginMethodSetupError && (
          <p role="alert" className="pb-4 text-error-700">
            {t("loginMethods.errors.load")}
          </p>
        )}
        {Object.values(LOGIN_METHODS).map((method) => {
          const isEnabled = loginMethodSetup?.methods[method] ?? false;
          const isMissingCredentials = isMissingProviderCredentials(method, loginMethodSetup);
          const isEnableBlocked = isMissingCredentials && !isEnabled;

          const loginMethodSwitch = (
            <Switch
              id={`login-method-${method}`}
              data-testid={SETTINGS_PAGE_HANDLES.loginMethodSwitch(method)}
              checked={isEnabled}
              disabled={!loginMethodSetup || isUpdatingLoginMethod || isEnableBlocked}
              onCheckedChange={(enabled) => updateLoginMethod({ method, enabled })}
            />
          );

          return (
            <div className="flex items-center justify-between gap-4 py-3" key={method}>
              <Label
                htmlFor={`login-method-${method}`}
                className="body-sm-md flex items-center gap-2"
              >
                {renderLoginMethodIcon(method)}
                {t(`loginMethods.${method}`)}
              </Label>
              <div className="flex items-center gap-2">
                {isOAuthLoginMethod(method) && isMissingCredentials && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      to={`/admin/envs#${OAUTH_LOGIN_METHOD_ENV_GROUP_IDS[method]}`}
                      data-testid={SETTINGS_PAGE_HANDLES.loginMethodEnvsLink(method)}
                    >
                      {t("loginMethods.goToConfiguration")}
                      <ArrowUpRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                )}
                {isEnableBlocked ? (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-not-allowed">{loginMethodSwitch}</span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="center"
                        className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                      >
                        {t("loginMethods.notConfiguredTooltip")}
                        <TooltipArrow className="fill-black" />
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  loginMethodSwitch
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
