import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CONFIGURATION_STATE_QUERY_KEY } from "~/api/queries/admin/useConfigurationState";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { SECRET_METADATA } from "~/modules/Admin/Envs/Envs.constants";
import { SecretField } from "~/modules/Admin/Envs/Envs.page";

import type { LoginMethod, LoginMethodSetup } from "~/api/queries/useLoginMethods";

type SecretKey = keyof typeof SECRET_METADATA;
type Values = Partial<Record<SecretKey, string>>;
const order: LoginMethod[] = ["google", "microsoft", "slack", "magicLink", "password"];

export default function LoginMethods() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [provider, setProvider] = useState<"google" | "microsoft" | "slack" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>();
  const setup = useQuery({
    queryKey: ["loginMethodSetup"],
    queryFn: async () =>
      (await ApiClient.instance.get<{ data: LoginMethodSetup }>("/api/env/login-methods/setup"))
        .data.data,
  });
  const update = useMutation({
    mutationFn: async (data: {
      method: LoginMethod;
      enabled: boolean;
      configuration?: { name: string; value: string }[];
    }) =>
      (await ApiClient.instance.post<{ data: LoginMethodSetup }>("/api/env/login-methods", data))
        .data.data,
    onSuccess: async (data) => {
      client.setQueryData(["loginMethodSetup"], data);
      await Promise.all(
        [["loginMethods"], ["ssoEnabled"], ["secrets"], CONFIGURATION_STATE_QUERY_KEY].map(
          (queryKey) => client.invalidateQueries({ queryKey }),
        ),
      );
      setProvider(null);
      form.reset();
      setError(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      setError(t(err.response?.data?.message ?? "loginMethods.errors.save")),
  });
  const close = () => {
    if (!update.isPending) {
      setProvider(null);
      form.reset();
      setError(null);
    }
  };
  const toggle = (method: LoginMethod, enabled: boolean) => {
    setError(null);
    if (
      enabled &&
      (method === "google" || method === "microsoft" || method === "slack") &&
      setup.data?.missing[method].length
    ) {
      form.reset();
      setProvider(method);
      return;
    }
    update.mutate({ method, enabled });
  };
  return (
    <section className="space-y-4" aria-label={t("loginMethods.title")}>
      <h3 className="text-xl font-semibold">{t("loginMethods.title")}</h3>
      {setup.isError && <p role="alert">{t("loginMethods.errors.load")}</p>}
      {order.map((method) => (
        <div className="flex items-center justify-between gap-4" key={method}>
          <Label htmlFor={`login-method-${method}`}>{t(`loginMethods.${method}`)}</Label>
          <Switch
            id={`login-method-${method}`}
            checked={setup.data?.methods[method] ?? false}
            disabled={!setup.data || update.isPending}
            onCheckedChange={(enabled) => toggle(method, enabled)}
          />
        </div>
      ))}
      {error && !provider && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Dialog
        open={!!provider}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {t("loginMethods.configure", {
                provider: provider ? t(`loginMethods.${provider}`) : "",
              })}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              if (!provider) return;
              const configuration = (setup.data?.missing[provider] ?? []).map((name) => ({
                name,
                value: values[name as SecretKey]?.trim() ?? "",
              }));
              if (configuration.some(({ value }) => !value)) {
                setError(t("loginMethods.errors.missingConfiguration"));
                return;
              }
              update.mutate({ method: provider, enabled: true, configuration });
            })}
          >
            {provider &&
              setup.data?.missing[provider].map((name) => {
                const key = name as SecretKey;
                const meta = SECRET_METADATA[key];
                return (
                  meta && (
                    <SecretField
                      key={key}
                      name={key}
                      {...meta}
                      register={form.register}
                      setValue={form.setValue}
                      createOnly
                    />
                  )
                );
              })}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={update.isPending} onClick={close}>
                {t("common.button.cancel")}
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {t("adminEnvsView.form.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
