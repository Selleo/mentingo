import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import type React from "react";

interface InputElementProps {
  labelKey: string;
  inputPlaceholderKey: string;
  inputName: string;
  register: ReturnType<typeof useForm>["register"];
}

const InputElement = ({
  labelKey,
  inputPlaceholderKey,
  inputName,
  register,
}: InputElementProps) => {
  const { t } = useTranslation();
  const [viewSecret, setViewSecret] = useState(false);

  const toggleSecret = () => setViewSecret(!viewSecret);

  return (
    <div className="w-full">
      <Label className="text-xl">{t(labelKey)}</Label>
      <div className="relative">
        <Input
          {...register(inputName)}
          disabled={!viewSecret}
          type="text"
          placeholder={!viewSecret ? t(inputPlaceholderKey) : undefined}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={toggleSecret}
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-none"
        >
          <Icon name="Eye" className="size-4" />
        </Button>
      </div>
    </div>
  );
};

const Envs = (): React.ReactElement => {
  const { t } = useTranslation();

  const onSubmit = () => console.log("submit");

  const { register, handleSubmit, watch } = useForm();

  const secrets = watch();

  const hasAnyValue = Object.values(secrets).some(Boolean);

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
                  <Button type="submit" className="flex gap-2">
                    <Icon name="Checkmark" className="size-4" />
                    {t("adminEnvsView.form.save")}
                  </Button>
                ) : (
                  <></>
                )}
              </div>

              <InputElement
                labelKey="adminEnvsView.form.openai.label"
                inputName="OPENAI_API_KEY"
                register={register}
                inputPlaceholderKey="adminEnvsView.form.openai.placeholder"
              />

              <InputElement
                labelKey="adminEnvsView.form.bunny.label"
                inputName="BUNNY_KEY"
                register={register}
                inputPlaceholderKey="adminEnvsView.form.bunny.placeholder"
              />

              <InputElement
                labelKey="adminEnvsView.form.googleSSO.label"
                inputName="GOOGLE_SSO_KEY"
                register={register}
                inputPlaceholderKey="adminEnvsView.form.googleSSO.placeholder"
              />

              <InputElement
                labelKey="adminEnvsView.form.microsoftSSO.label"
                inputName="MICROSOFT_SSO_KEY"
                register={register}
                inputPlaceholderKey="adminEnvsView.form.microsoftSSO.placeholder"
              />
            </form>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Envs;
