import { useEffect, useState } from "react";
import { useForm, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useBulkUpsertSecret } from "~/api/mutations/admin/useBulkUpsertSecret";
import { useSecret } from "~/api/queries/admin/useSecret";
import { ssoEnabledQueryOptions } from "~/api/queries/useSSOEnabled";
import { queryClient } from "~/api/queryClient";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SECRET_METADATA } from "~/modules/Admin/Envs/Envs.constants";

import type React from "react";

type SecretKey = keyof typeof SECRET_METADATA;
type FormValues = Partial<Record<SecretKey, string>>;

interface SecretFieldProps {
  name: SecretKey;
  labelKey: string;
  placeholderKey: string;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
}

const SecretField = ({ name, labelKey, placeholderKey, register, setValue }: SecretFieldProps) => {
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
  }, [viewSecret, secretData?.data.value, name, setValue]);

  return (
    <div className="w-full" data-testid={name}>
      <Label className="text-xl" htmlFor={name}>
        {t(labelKey)}
      </Label>
      <div className="relative">
        <Input
          data-testid={`${name}-input`}
          id={name}
          {...register(name)}
          disabled={!viewSecret || isFetching}
          placeholder={!viewSecret ? t(placeholderKey) : undefined}
          aria-busy={isFetching}
        />

        <Button
          type="button"
          variant="ghost"
          data-testid={`${name}-toggle`}
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

  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({ defaultValues: {} });

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
    await queryClient.invalidateQueries({ queryKey: ssoEnabledQueryOptions().queryKey });
  };

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminGroupsView.breadcrumbs.dashboard"),
          href: "/",
        },
        {
          title: t("adminEnvsView.breadcrumbs.envs"),
          href: "/admin/envs",
        },
      ]}
    >
      <div className="flex flex-col gap-16">
        <div className="mx-auto flex h-auto w-full max-w-4xl flex-col gap-6">
          <h4 className="h4 font-bold">{t("adminEnvsView.name")}</h4>
          <div className="rounded-2xl bg-white p-6 drop-shadow">
            <form onSubmit={handleSubmit(onSubmit)} className="flex size-full flex-col gap-8">
              <div className="flex w-full items-center justify-between">
                <h4 className="h4">{t("adminEnvsView.keysTitle")}</h4>
                {hasAnyValue ? (
                  <Button type="submit" data-testid="env-submit" className="flex gap-2">
                    <Icon name="Checkmark" className="size-4" />
                    {t("adminEnvsView.form.save")}
                  </Button>
                ) : (
                  <></>
                )}
              </div>

              {(Object.keys(SECRET_METADATA) as SecretKey[]).map((key) => {
                const meta = SECRET_METADATA[key];
                if (!meta) return null;

                return (
                  <SecretField
                    key={key}
                    name={key}
                    labelKey={meta.labelKey}
                    placeholderKey={meta.placeholderKey}
                    register={register}
                    setValue={setValue}
                  />
                );
              })}
            </form>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Envs;
