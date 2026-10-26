import { useLocation } from "@remix-run/react";
import { useEffect, useState } from "react";
import { useForm, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useBulkUpsertSecret } from "~/api/mutations/admin/useBulkUpsertSecret";
import { LOGIN_METHOD_SETUP_QUERY_KEY } from "~/api/queries/admin/useLoginMethodSetup";
import { useSecret } from "~/api/queries/admin/useSecret";
import { liveKitConfiguredQueryOptions } from "~/api/queries/useLiveKitConfigured";
import { LOGIN_METHODS_QUERY_KEY } from "~/api/queries/useLoginMethods";
import { ssoEnabledQueryOptions } from "~/api/queries/useSSOEnabled";
import { stripePublishableKeyQueryOptions } from "~/api/queries/useStripePublishableKey";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { ENV_GROUPS, SECRET_METADATA } from "~/modules/Admin/Envs/Envs.constants";

import { ENV_PAGE_HANDLES } from "../../../../e2e/data/environment/handles";

import type React from "react";

type SecretKey = keyof typeof SECRET_METADATA;
type FormValues = Partial<Record<SecretKey, string>>;
type SecretMetadata = { labelKey: string; descriptionKey?: string; placeholderKey: string };

interface SecretFieldProps {
  name: SecretKey;
  labelKey: string;
  descriptionKey?: string;
  placeholderKey: string;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
}

const SecretField = ({
  name,
  labelKey,
  descriptionKey,
  placeholderKey,
  register,
  setValue,
}: SecretFieldProps) => {
  const { t } = useTranslation();
  const [viewSecret, setViewSecret] = useState(false);

  const { data: secretData, isFetching } = useSecret(name, viewSecret);

  useEffect(() => {
    if (viewSecret && secretData?.data.value !== undefined) {
      setValue(name, secretData.data.value);
    }
    if (!viewSecret) {
      setValue(name, "");
    }
  }, [viewSecret, secretData?.data?.value, name, setValue]);

  return (
    <div className="w-full" data-testid={ENV_PAGE_HANDLES.field(name)}>
      <Label className="body-sm-md text-neutral-950" htmlFor={name}>
        {t(labelKey)}
      </Label>
      {descriptionKey && <p className="details-md mt-1 text-neutral-600">{t(descriptionKey)}</p>}
      <div className="relative mt-2">
        <Input
          data-testid={ENV_PAGE_HANDLES.input(name)}
          id={name}
          {...register(name)}
          disabled={!viewSecret || isFetching}
          placeholder={!viewSecret ? t(placeholderKey) : undefined}
          aria-busy={isFetching}
        />

        <Button
          type="button"
          variant="ghost"
          data-testid={ENV_PAGE_HANDLES.toggle(name)}
          onClick={() => setViewSecret((v) => !v)}
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-none"
          aria-label={viewSecret ? t("adminEnvsView.form.hide") : t("adminEnvsView.form.show")}
        >
          <Icon name="Eye" className="size-4" />
        </Button>
      </div>
    </div>
  );
};

const Envs = (): React.ReactElement => {
  const { t } = useTranslation();

  const { hash } = useLocation();
  const highlightedGroupId = hash.slice(1);
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({ defaultValues: {} });

  useEffect(() => {
    if (!highlightedGroupId) return;

    document
      .getElementById(highlightedGroupId)
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [highlightedGroupId]);

  const secrets = watch();
  const hasAnyValue = Object.values(secrets).some(Boolean);

  const { mutateAsync: upsertSecrets } = useBulkUpsertSecret();

  const onSubmit = async (data: FormValues) => {
    const secretPairs = Object.entries(data)
      .filter(([, value]) => Boolean(value))
      .map(([name, value]) => ({ name, value: value as string }));

    if (!secretPairs.length) return;

    await upsertSecrets(secretPairs);
    await queryClient.invalidateQueries({ queryKey: ["secrets"] });
    await queryClient.invalidateQueries({ queryKey: ["phishing"] });
    await queryClient.invalidateQueries({ queryKey: ssoEnabledQueryOptions().queryKey });
    await queryClient.invalidateQueries({ queryKey: LOGIN_METHODS_QUERY_KEY });
    await queryClient.invalidateQueries({ queryKey: LOGIN_METHOD_SETUP_QUERY_KEY });
    await queryClient.invalidateQueries(stripePublishableKeyQueryOptions());
    await queryClient.invalidateQueries(liveKitConfiguredQueryOptions);
  };

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminEnvsView.breadcrumbs.envs"),
          href: "/admin/envs",
        },
      ]}
    >
      <form
        data-testid={ENV_PAGE_HANDLES.FORM}
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto flex w-full max-w-6xl flex-col gap-6"
      >
        <div
          className="flex flex-wrap items-center justify-between gap-4"
          data-testid={ENV_PAGE_HANDLES.PAGE}
        >
          <h4 className="h4 font-bold">{t("adminEnvsView.name")}</h4>
          {hasAnyValue && (
            <Button type="submit" data-testid={ENV_PAGE_HANDLES.SUBMIT} className="flex gap-2">
              <Icon name="Checkmark" className="size-4" />
              {t("adminEnvsView.form.save")}
            </Button>
          )}
        </div>

        <div className="columns-1 gap-6 lg:columns-2">
          {ENV_GROUPS.map((group) => (
            <section
              key={group.id}
              id={group.id}
              className={cn(
                "mb-6 flex scroll-mt-6 break-inside-avoid flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm",
                { "border-primary-500 ring-2 ring-primary-100": group.id === highlightedGroupId },
              )}
            >
              <header className="flex flex-col gap-1">
                <h2 className="body-base-md text-neutral-950">{t(group.titleKey)}</h2>
                <p className="details-md text-neutral-600">{t(group.descriptionKey)}</p>
              </header>
              {group.secretNames.map((secretName) => {
                const meta: SecretMetadata = SECRET_METADATA[secretName];

                return (
                  <SecretField
                    key={secretName}
                    name={secretName}
                    labelKey={meta.labelKey}
                    descriptionKey={meta.descriptionKey}
                    placeholderKey={meta.placeholderKey}
                    register={register}
                    setValue={setValue}
                  />
                );
              })}
            </section>
          ))}
        </div>
      </form>
    </PageWrapper>
  );
};

export default Envs;
