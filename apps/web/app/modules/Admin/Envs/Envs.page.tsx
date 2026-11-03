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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
    text: "text-success-700",
    badge: "border-success-200 bg-success-50",
  },
  [ENV_STATUS.ATTENTION]: {
    icon: AlertTriangle,
    text: "text-warning-800",
    badge: "border-warning-200 bg-warning-50",
  },
  [ENV_STATUS.NOT_CONFIGURED]: {
    icon: Plus,
    text: "text-neutral-600",
    badge: "border-neutral-200 bg-neutral-50",
  },
  [ENV_STATUS.UNKNOWN]: {
    icon: Plus,
    text: "text-neutral-600",
    badge: "border-neutral-200 bg-neutral-50",
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
      <div className="mb-2 flex min-w-0 items-baseline gap-2">
        <Label className="body-sm-md text-neutral-950" htmlFor={name}>
          {t(meta.labelKey)}
        </Label>
        <span aria-hidden="true" className="text-neutral-600">
          ·
        </span>
        <code className="details break-all text-neutral-600">{name}</code>
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
          className={cn(
            "pr-12 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:bg-neutral-50 disabled:opacity-100",
            { "border-warning-500": missing },
          )}
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
      className="col-span-full rounded-lg border border-neutral-200 bg-white p-5 shadow-sm md:p-6"
    >
      <form
        data-testid={active ? ENV_PAGE_HANDLES.FORM : undefined}
        onSubmit={handleSubmit(saveSecrets)}
      >
        <header className="mb-5 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
            <GroupIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${group.id}-title`} className="h6 text-neutral-950">
              {t(group.titleKey)}
            </h2>
            <p className="body-sm mt-1 text-neutral-600">{t(group.descriptionKey)}</p>
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
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
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
        <footer className="-mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3 md:-mx-6 md:-mb-6 md:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={discardChanges}
          >
            {t("adminEnvsView.overview.cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
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
      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <div className="mb-6 overflow-x-auto border-b">
          <TabsList
            className="h-auto min-w-max justify-start gap-2 rounded-none bg-transparent p-0"
            aria-label={t("adminEnvsView.overview.filters")}
          >
            {[
              ENV_STATUS.ALL,
              ENV_STATUS.CONFIGURED,
              ENV_STATUS.ATTENTION,
              ENV_STATUS.NOT_CONFIGURED,
            ].map((value) => {
              const FilterIcon =
                value !== ENV_STATUS.ALL ? STATUS_PRESENTATION[value].icon : undefined;
              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="relative gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 data-[state=active]:shadow-none"
                >
                  {FilterIcon && <FilterIcon className="size-4" aria-hidden="true" />}
                  {t(`adminEnvsView.overview.status.${value}`)}
                  <span
                    className={cn(
                      "details-md flex h-5 min-w-5 items-center justify-center rounded-md bg-neutral-100 px-1 text-neutral-600",
                      { "bg-primary-100 text-primary-800": filter === value },
                    )}
                  >
                    {match(value)
                      .with(ENV_STATUS.ALL, () => groups.length)
                      .otherwise(() => groups.filter(({ status }) => status === value).length)}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <TabsContent value={filter} className="m-0">
          {isError && (
            <div
              role="alert"
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-300 p-4 text-sm"
            >
              <p>{t("adminEnvsView.overview.statusError")}</p>
              <Button variant="outline" onClick={() => void refetch()}>
                {t("adminEnvsView.overview.retry")}
              </Button>
            </div>
          )}
          {attentionGroups.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-warning-200 bg-warning-50 p-4 text-warning-800">
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
                size="sm"
                className="border-warning-300 bg-white text-warning-800 hover:border-warning-500"
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
                      "flex h-full min-h-[240px] scroll-mt-6 flex-col rounded-lg border border-neutral-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                      {
                        "border-primary-500 ring-2 ring-primary-100": active,
                        "sm:order-none xl:order-none": index < 2,
                        "sm:order-2 xl:order-none": index >= 2 && index < 4,
                        "sm:order-4 xl:order-2": index >= 4 && index < 6,
                        "sm:order-6 xl:order-2": index >= 6 && index < 8,
                        "sm:order-8 xl:order-4": index >= 8,
                      },
                    )}
                  >
                    <span className="mb-4 flex w-full items-center justify-between gap-2">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                        <GroupIcon className="size-5" />
                      </span>
                      <span
                        className={cn(
                          "details-md inline-flex items-center gap-1.5 rounded-lg border px-2 py-1",
                          presentation.badge,
                          presentation.text,
                        )}
                      >
                        <StatusIcon className="size-3.5 shrink-0" />
                        {t(`adminEnvsView.overview.status.${status}`)}
                      </span>
                    </span>
                    <span className="body-base-md text-neutral-950">{t(group.titleKey)}</span>
                    <span className="body-sm mb-5 mt-1 text-neutral-600">
                      {t(group.descriptionKey)}
                    </span>
                    <span className="mt-auto flex w-full items-center gap-2 border-t border-neutral-200 pt-3 text-xs">
                      <span className="details flex-1 text-neutral-600">
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
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
};

export default Envs;
