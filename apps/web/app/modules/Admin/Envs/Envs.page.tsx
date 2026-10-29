import { useLocation } from "@remix-run/react";
import { AlertTriangle, Check, ChevronDown, Eye, EyeOff, Plus, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  useForm,
  type UseFormGetFieldState,
  type UseFormRegister,
  type UseFormResetField,
  type UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useBulkUpsertSecret } from "~/api/mutations/admin/useBulkUpsertSecret";
import { useConfigurationState } from "~/api/queries/admin/useConfigurationState";
import { useSecret } from "~/api/queries/admin/useSecret";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import {
  ENV_GROUPS,
  ENV_GROUP_PRESENTATION,
  ENV_STATUS,
  SECRET_METADATA,
} from "~/modules/Admin/Envs/Envs.constants";

import { ENV_PAGE_HANDLES } from "../../../../e2e/data/environment/handles";

import type { EnvGroup, EnvStatus, FormValues, SecretKey } from "./Envs.types";

interface ExpandableEditorProps {
  active: boolean;
  className: string;
  children: ReactNode;
}

const ExpandableEditor = ({ active, className, children }: ExpandableEditorProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(!active);

  useEffect(() => {
    if (active) setCollapsed(false);
  }, [active]);

  return (
    <motion.div
      initial={false}
      hidden={!active && collapsed}
      animate={{ height: active ? "auto" : 0, opacity: active ? 1 : 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => setCollapsed(!active)}
      aria-hidden={!active}
      {...{ inert: active ? undefined : "" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const STATUS_PRESENTATION = {
  [ENV_STATUS.CONFIGURED]: {
    icon: Check,
    border: "border-success-500",
    text: "text-success-700",
    badge: "bg-success-700",
  },
  [ENV_STATUS.ATTENTION]: {
    icon: AlertTriangle,
    border: "border-zest-500",
    text: "text-zest-700",
    badge: "bg-zest-600",
  },
  [ENV_STATUS.NOT_CONFIGURED]: {
    icon: Plus,
    border: "border-neutral-300",
    text: "text-neutral-600",
    badge: "bg-neutral-500",
  },
  [ENV_STATUS.UNKNOWN]: {
    icon: Plus,
    border: "border-neutral-200",
    text: "text-neutral-600",
    badge: "bg-neutral-500",
  },
};

interface SecretFieldProps {
  name: SecretKey;
  missing: boolean;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  getFieldState: UseFormGetFieldState<FormValues>;
  resetField: UseFormResetField<FormValues>;
}

const SecretField = ({
  name,
  missing,
  register,
  setValue,
  getFieldState,
  resetField,
}: SecretFieldProps) => {
  const { t } = useTranslation();
  const [viewSecret, setViewSecret] = useState(false);
  const { data: secretData, isFetching, isError } = useSecret(name, viewSecret);
  const meta: { labelKey: string; descriptionKey?: string; placeholderKey: string } =
    SECRET_METADATA[name];

  useEffect(() => {
    if (viewSecret && secretData?.data.value !== undefined && !getFieldState(name).isDirty) {
      setValue(name, secretData.data.value);
    }
    if (!viewSecret) setValue(name, "");
  }, [viewSecret, secretData?.data?.value, name, setValue, getFieldState]);

  return (
    <div className="min-w-0" data-testid={ENV_PAGE_HANDLES.field(name)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Label className="text-sm text-neutral-950" htmlFor={name}>
          {t(meta.labelKey)}
        </Label>
        <code className="break-all rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
          {name}
        </code>
      </div>
      <div className="relative">
        <Input
          data-testid={ENV_PAGE_HANDLES.input(name)}
          id={name}
          {...register(name)}
          type={viewSecret ? "text" : "password"}
          disabled={!viewSecret || isFetching}
          placeholder={t(meta.placeholderKey)}
          aria-busy={isFetching}
          aria-describedby={meta.descriptionKey ? `${name}-description` : undefined}
          className={cn("h-11 pr-12 disabled:bg-neutral-50 disabled:opacity-100", {
            "border-zest-500": missing,
          })}
          autoComplete="off"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid={ENV_PAGE_HANDLES.toggle(name)}
          onClick={() => {
            if (viewSecret) resetField(name);
            setViewSecret((visible) => !visible);
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-600"
          aria-label={
            viewSecret ? t("adminEnvsView.overview.hide") : t("adminEnvsView.overview.show")
          }
          aria-pressed={viewSecret}
        >
          {viewSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      {isError && (
        <p role="alert" className="mt-2 text-xs text-error-700">
          {t("adminEnvsView.overview.secretError")}
        </p>
      )}
      {meta.descriptionKey && (
        <p id={`${name}-description`} className="mt-2 text-xs leading-5 text-neutral-600">
          {t(meta.descriptionKey)}
        </p>
      )}
    </div>
  );
};

interface GroupEditorProps {
  group: EnvGroup;
  status: EnvStatus;
  missingKeys: string[];
  active: boolean;
  onClose: () => void;
}

const GroupEditor = ({ group, status, missingKeys, active, onClose }: GroupEditorProps) => {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    getFieldState,
    resetField,
    reset,
    formState: { dirtyFields },
  } = useForm<FormValues>({ defaultValues: {} });
  const [revision, setRevision] = useState(0);
  const { mutateAsync: upsertSecrets, isPending } = useBulkUpsertSecret();
  const GroupIcon = ENV_GROUP_PRESENTATION[group.id].icon;
  const hasChanges = Object.keys(dirtyFields).length > 0;

  const discardChanges = () => {
    reset({});
    setRevision((value) => value + 1);
    onClose();
  };

  const saveSecrets = async (data: FormValues) => {
    const secretPairs = Object.entries(data)
      .filter(([name, value]) => dirtyFields[name as SecretKey] && Boolean(value))
      .map(([name, value]) => ({ name, value: value as string }));
    if (!secretPairs.length) return;
    await upsertSecrets(secretPairs);
    reset({});
    setRevision((value) => value + 1);
  };

  return (
    <section
      id={`${group.id}-editor`}
      aria-labelledby={`${group.id}-title`}
      className={cn(
        "col-span-full rounded-xl border bg-white p-5 shadow-sm md:p-6",
        STATUS_PRESENTATION[status].border,
      )}
    >
      <form
        data-testid={active ? ENV_PAGE_HANDLES.FORM : undefined}
        onSubmit={handleSubmit(saveSecrets)}
      >
        <header className="mb-5 flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <GroupIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${group.id}-title`} className="text-lg font-semibold text-neutral-950">
              {t(group.titleKey)}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">{t(group.descriptionKey)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={discardChanges}
            aria-label={t("adminEnvsView.overview.close")}
          >
            <X className="size-5" />
          </Button>
        </header>
        {status === ENV_STATUS.ATTENTION && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-zest-200 bg-zest-50 p-4 text-sm text-zest-800">
            <AlertTriangle className="size-5 shrink-0" />
            <p className="min-w-0 break-words">
              {t("adminEnvsView.overview.missingKeys", { keys: missingKeys.join(", ") })}
            </p>
          </div>
        )}
        <div key={revision} className="grid gap-x-6 gap-y-6 md:grid-cols-2">
          {group.secretNames.map((name) => (
            <SecretField
              key={name}
              name={name}
              missing={status === ENV_STATUS.ATTENTION && missingKeys.includes(name)}
              register={register}
              setValue={setValue}
              getFieldState={getFieldState}
              resetField={resetField}
            />
          ))}
        </div>
        <footer className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-5">
          <Button type="button" variant="ghost" disabled={isPending} onClick={discardChanges}>
            {t("adminEnvsView.overview.cancel")}
          </Button>
          <Button
            type="submit"
            data-testid={active ? ENV_PAGE_HANDLES.SUBMIT : undefined}
            disabled={!hasChanges || isPending}
          >
            {t("adminEnvsView.overview.saveChanges")}
          </Button>
        </footer>
      </form>
    </section>
  );
};

const Envs = () => {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const { hash } = useLocation();
  const [activeGroupId, setActiveGroupId] = useState(hash.slice(1));
  const [filter, setFilter] = useState<(typeof ENV_STATUS)[keyof typeof ENV_STATUS]>(
    ENV_STATUS.ALL,
  );
  const { data: configuration, isError, refetch } = useConfigurationState({ enabled: true });

  useEffect(() => {
    if (!hash) return;
    setActiveGroupId(hash.slice(1));
    setFilter(ENV_STATUS.ALL);
    document
      .getElementById(hash.slice(1))
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [hash]);

  const groups = ENV_GROUPS.map((group) => {
    const services: readonly string[] = ENV_GROUP_PRESENTATION[group.id].services;
    const knownServices = configuration && [
      ...configuration.fullyConfigured,
      ...configuration.partiallyConfigured.map(({ service }) => service),
      ...configuration.notConfigured.map(({ service }) => service),
    ];
    const missingKeys = [
      ...(configuration?.partiallyConfigured ?? []),
      ...(configuration?.notConfigured ?? []),
    ]
      .filter(({ service }) => services.includes(service))
      .flatMap(({ missingKeys }) => missingKeys)
      .filter((key) => (group.secretNames as readonly string[]).includes(key));
    const configuredCount = group.secretNames.length - missingKeys.length;
    const status = match({
      known: Boolean(knownServices && services.every((service) => knownServices.includes(service))),
      configuredCount,
    })
      .with({ known: false }, () => ENV_STATUS.UNKNOWN)
      .with({ configuredCount: 0 }, () => ENV_STATUS.NOT_CONFIGURED)
      .when(
        ({ configuredCount }) => configuredCount === group.secretNames.length,
        () => ENV_STATUS.CONFIGURED,
      )
      .otherwise(() => ENV_STATUS.ATTENTION);
    return { group, missingKeys, configuredCount, status };
  });
  const visibleGroups = groups.filter(
    ({ status }) => filter === ENV_STATUS.ALL || status === filter,
  );
  const attentionGroups = groups.filter(({ status }) => status === ENV_STATUS.ATTENTION);

  return (
    <PageWrapper
      breadcrumbs={[{ title: t("adminEnvsView.breadcrumbs.envs"), href: "/admin/envs" }]}
      data-testid={ENV_PAGE_HANDLES.PAGE}
    >
      <header className="mb-6">
        <h1 className="h4">{t("adminEnvsView.name")}</h1>
        <p className="body-base mt-2 max-w-2xl text-neutral-600">
          {t("adminEnvsView.overview.description")}
        </p>
      </header>
      <div
        className="mb-7 flex flex-wrap gap-2"
        role="group"
        aria-label={t("adminEnvsView.overview.filters")}
      >
        {[
          ENV_STATUS.ALL,
          ENV_STATUS.CONFIGURED,
          ENV_STATUS.ATTENTION,
          ENV_STATUS.NOT_CONFIGURED,
        ].map((value) => {
          const FilterIcon = value !== ENV_STATUS.ALL ? STATUS_PRESENTATION[value].icon : undefined;
          return (
            <Button
              key={value}
              type="button"
              variant="outline"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn("h-11 gap-2 rounded-full border-neutral-300 px-4 text-neutral-800", {
                "border-primary-700 bg-primary-700 text-contrast": filter === value,
              })}
            >
              {FilterIcon && <FilterIcon className="size-3.5" />}
              {t(`adminEnvsView.overview.status.${value}`)}
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full bg-neutral-100 text-xs text-neutral-800",
                  { "bg-white/20 text-contrast": filter === value },
                )}
              >
                {match(value)
                  .with(ENV_STATUS.ALL, () => groups.length)
                  .otherwise(() => groups.filter(({ status }) => status === value).length)}
              </span>
            </Button>
          );
        })}
      </div>
      {isError && (
        <div
          role="alert"
          className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-300 p-4 text-sm"
        >
          <p>{t("adminEnvsView.overview.statusError")}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            {t("adminEnvsView.overview.retry")}
          </Button>
        </div>
      )}
      {attentionGroups.length > 0 && (
        <div className="mb-7 flex flex-wrap items-center gap-4 rounded-xl border border-zest-300 bg-zest-50 px-5 py-3.5 text-zest-800">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="min-w-0 flex-1 text-sm">
            <strong>
              {t("adminEnvsView.overview.attention", { count: attentionGroups.length })}
            </strong>{" "}
            {attentionGroups.map(({ group }) => t(group.titleKey)).join(", ")}.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFilter(ENV_STATUS.ATTENTION)}
            className="border-zest-500 bg-transparent text-zest-800"
          >
            {t("adminEnvsView.overview.showIssues")}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleGroups.map(({ group, status, configuredCount, missingKeys }, index) => {
          const presentation = STATUS_PRESENTATION[status];
          const GroupIcon = ENV_GROUP_PRESENTATION[group.id].icon;
          const StatusIcon = presentation.icon;
          const active = activeGroupId === group.id;
          return (
            <Fragment key={group.id}>
              <motion.button
                layout={prefersReducedMotion ? false : "position"}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                type="button"
                id={group.id}
                aria-expanded={active}
                aria-controls={`${group.id}-editor`}
                onClick={() => setActiveGroupId(active ? "" : group.id)}
                className={cn(
                  "relative flex h-full min-h-[250px] scroll-mt-6 flex-col rounded-xl border bg-white p-5 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                  presentation.border,
                  {
                    "ring-4 ring-primary-100": active,
                    "border-dashed bg-neutral-50": status === ENV_STATUS.NOT_CONFIGURED,
                    "sm:order-none xl:order-none": index < 2,
                    "sm:order-2 xl:order-none": index >= 2 && index < 4,
                    "sm:order-4 xl:order-2": index >= 4 && index < 6,
                    "sm:order-6 xl:order-2": index >= 6 && index < 8,
                    "sm:order-8 xl:order-4": index >= 8,
                  },
                )}
              >
                {(status === ENV_STATUS.CONFIGURED || status === ENV_STATUS.ATTENTION) && (
                  <span
                    className={cn(
                      "absolute -right-2.5 -top-2.5 flex size-8 items-center justify-center rounded-full border-[3px] border-white text-white",
                      presentation.badge,
                    )}
                  >
                    <StatusIcon className="size-4" />
                  </span>
                )}
                <span
                  className={cn(
                    "mb-4 flex size-[52px] items-center justify-center rounded-xl bg-primary-100 text-primary-700",
                    { "bg-neutral-100 text-neutral-600": status === ENV_STATUS.NOT_CONFIGURED },
                  )}
                >
                  <GroupIcon className="size-6" />
                </span>
                <span className="text-lg font-semibold leading-6 text-neutral-950">
                  {t(group.titleKey)}
                </span>
                <span className="mb-4 mt-1 text-sm leading-5 text-neutral-600">
                  {t(group.descriptionKey)}
                </span>
                <span className="mt-auto flex w-full items-center gap-2 border-t border-neutral-200 pt-3 text-xs">
                  <span
                    className={cn("flex flex-1 items-center gap-2 font-medium", presentation.text)}
                  >
                    <StatusIcon className="size-3.5" />
                    {t(`adminEnvsView.overview.status.${status}`)}
                  </span>
                  <span className="text-neutral-600">
                    {status === ENV_STATUS.UNKNOWN ? "—" : configuredCount}/
                    {group.secretNames.length} ENV
                  </span>
                  <ChevronDown
                    className={cn("size-4 shrink-0 text-neutral-600 transition-transform", {
                      "rotate-180": active,
                    })}
                  />
                </span>
              </motion.button>
              <ExpandableEditor
                active={active}
                className={cn("col-span-full min-w-0 overflow-hidden", {
                  "sm:order-1 xl:order-1": index < 2,
                  "sm:order-3 xl:order-1": index >= 2 && index < 4,
                  "sm:order-5 xl:order-3": index >= 4 && index < 6,
                  "sm:order-7 xl:order-3": index >= 6 && index < 8,
                  "sm:order-9 xl:order-5": index >= 8,
                })}
              >
                <GroupEditor
                  group={group}
                  status={status}
                  missingKeys={missingKeys}
                  active={active}
                  onClose={() => setActiveGroupId("")}
                />
              </ExpandableEditor>
            </Fragment>
          );
        })}
      </div>
      {visibleGroups.length === 0 && (
        <p className="py-12 text-center text-sm text-neutral-600">
          {t("adminEnvsView.overview.empty")}
        </p>
      )}
    </PageWrapper>
  );
};

export default Envs;
