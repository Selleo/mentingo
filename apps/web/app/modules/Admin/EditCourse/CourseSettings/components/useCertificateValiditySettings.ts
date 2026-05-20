import {
  CERTIFICATE_VALIDITY_TYPES,
  CERTIFICATE_VALIDITY_UNITS,
  type CertificateValiditySetting,
  type CertificateValidityType,
  type CertificateValidityUnit,
} from "@repo/shared";
import { useEffect, useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCertificateValidityImpact } from "~/api/mutations/useCertificateValidityImpact";
import { useUpdateCourseSettings } from "~/api/mutations/useUpdateCourseSettings";

import { certificateValidityFormSchema } from "../validators/certificateValidityFormSchema";

import {
  CERTIFICATE_VALIDITY_ACTIONS,
  type CertificateValidityAction,
  type CertificateValidityState,
  type UseCertificateValiditySettingsParams,
} from "./CertificateValiditySettings.types";

import type { CertificateValidityFormValues } from "../validators/certificateValidityFormSchema";

const INITIAL_CERTIFICATE_VALIDITY_STATE: CertificateValidityState = {
  isValidityEnabled: false,
  validityType: CERTIFICATE_VALIDITY_TYPES.PERIOD,
  validityValue: 1,
  validityUnit: CERTIFICATE_VALIDITY_UNITS.YEARS,
  validityDate: "",
  pendingValidity: null,
  validityImpact: null,
  isValidityImpactOpen: false,
  validityDateError: null,
};

const certificateValidityReducer = (
  state: CertificateValidityState,
  action: CertificateValidityAction,
): CertificateValidityState =>
  match(action)
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SYNC_FROM_SETTINGS }, ({ certificateValidity }) => {
      if (!certificateValidity) return { ...state, isValidityEnabled: false };

      return match(certificateValidity)
        .with({ type: CERTIFICATE_VALIDITY_TYPES.PERIOD }, ({ type, value, unit }) => ({
          ...state,
          isValidityEnabled: true,
          validityType: type,
          validityValue: value,
          validityUnit: unit,
        }))
        .with({ type: CERTIFICATE_VALIDITY_TYPES.FIXED_DATE }, ({ type, date }) => ({
          ...state,
          isValidityEnabled: true,
          validityType: type,
          validityDate: date,
        }))
        .exhaustive();
    })
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_ENABLED }, ({ value }) => ({
      ...state,
      isValidityEnabled: value,
      validityDateError: null,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_TYPE }, ({ value }) => ({
      ...state,
      validityType: value,
      validityDateError: null,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_VALUE }, ({ value }) => ({
      ...state,
      validityValue: value,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_UNIT }, ({ value }) => ({
      ...state,
      validityUnit: value,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_DATE }, ({ value }) => ({
      ...state,
      validityDate: value,
      validityDateError: null,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_PENDING_VALIDITY }, ({ value }) => ({
      ...state,
      pendingValidity: value,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_IMPACT }, ({ value }) => ({
      ...state,
      validityImpact: value,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_IMPACT_OPEN }, ({ value }) => ({
      ...state,
      isValidityImpactOpen: value,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_VALIDITY_DATE_ERROR }, ({ value }) => ({
      ...state,
      validityDateError: value,
    }))
    .with({ type: CERTIFICATE_VALIDITY_ACTIONS.CLEAR_PENDING_IMPACT }, () => ({
      ...state,
      pendingValidity: null,
      validityImpact: null,
      isValidityImpactOpen: false,
    }))
    .exhaustive();

const buildCertificateValidityPayload = (
  values: CertificateValidityFormValues,
): CertificateValiditySetting =>
  match(values)
    .with({ isValidityEnabled: false }, () => null)
    .with({ validityType: CERTIFICATE_VALIDITY_TYPES.FIXED_DATE }, ({ validityDate }) => ({
      type: CERTIFICATE_VALIDITY_TYPES.FIXED_DATE,
      date: validityDate,
    }))
    .otherwise(({ validityValue, validityUnit }) => ({
      type: CERTIFICATE_VALIDITY_TYPES.PERIOD,
      value: Math.max(1, validityValue),
      unit: validityUnit,
    }));

const areCertificateValiditySettingsEqual = (
  savedValidity: CertificateValiditySetting | undefined,
  draftValidity: CertificateValiditySetting,
) => {
  if (!savedValidity && !draftValidity) return true;
  if (!savedValidity || !draftValidity) return false;
  if (savedValidity.type !== draftValidity.type) return false;

  return match(savedValidity)
    .with({ type: CERTIFICATE_VALIDITY_TYPES.FIXED_DATE }, ({ date }) => {
      return draftValidity.type === CERTIFICATE_VALIDITY_TYPES.FIXED_DATE
        ? date === draftValidity.date
        : false;
    })
    .with({ type: CERTIFICATE_VALIDITY_TYPES.PERIOD }, ({ value, unit }) => {
      return draftValidity.type === CERTIFICATE_VALIDITY_TYPES.PERIOD
        ? value === draftValidity.value && unit === draftValidity.unit
        : false;
    })
    .exhaustive();
};

export function useCertificateValiditySettings({
  courseId,
  certificateValidity,
}: UseCertificateValiditySettingsParams) {
  const { t } = useTranslation();
  const [
    {
      isValidityEnabled,
      validityType,
      validityDate,
      validityValue,
      validityUnit,
      pendingValidity,
      validityImpact,
      isValidityImpactOpen,
      validityDateError,
    },
    dispatch,
  ] = useReducer(certificateValidityReducer, INITIAL_CERTIFICATE_VALIDITY_STATE);

  const { mutate: updateCourseSettings, isPending: isUpdatingCourseSettings } =
    useUpdateCourseSettings();
  const { mutateAsync: getValidityImpact, isPending: isCheckingValidityImpact } =
    useCertificateValidityImpact();
  const validationSchema = useMemo(() => certificateValidityFormSchema(t), [t]);

  useEffect(() => {
    dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SYNC_FROM_SETTINGS, certificateValidity });
  }, [certificateValidity]);

  const validityFormValues = useMemo<CertificateValidityFormValues>(
    () => ({
      isValidityEnabled,
      validityType,
      validityValue,
      validityUnit,
      validityDate,
    }),
    [isValidityEnabled, validityDate, validityType, validityUnit, validityValue],
  );

  const draftValidity = useMemo<CertificateValiditySetting>(() => {
    const draftValues = match(validityFormValues)
      .with(
        { isValidityEnabled: true, validityType: CERTIFICATE_VALIDITY_TYPES.FIXED_DATE },
        (values) => {
          if (values.validityDate) return values;

          return {
            ...values,
            validityDate:
              certificateValidity?.type === CERTIFICATE_VALIDITY_TYPES.FIXED_DATE
                ? certificateValidity.date
                : "",
          };
        },
      )
      .otherwise((values) => values);

    return buildCertificateValidityPayload(draftValues);
  }, [certificateValidity, validityFormValues]);

  const hasValidityChanges = useMemo(() => {
    if (
      validityFormValues.isValidityEnabled &&
      validityFormValues.validityType === CERTIFICATE_VALIDITY_TYPES.FIXED_DATE &&
      !validityFormValues.validityDate
    ) {
      return true;
    }

    return !areCertificateValiditySettingsEqual(certificateValidity, draftValidity);
  }, [certificateValidity, draftValidity, validityFormValues]);

  const saveValidity = (applyValidityToExistingCertificates: boolean) => {
    if (!pendingValidity && isValidityEnabled) return;

    if (validityType === CERTIFICATE_VALIDITY_TYPES.FIXED_DATE && !validityDate) return;

    updateCourseSettings({
      courseId,
      data: {
        certificateValidity: pendingValidity,
        applyValidityToExistingCertificates,
      },
    });

    dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.CLEAR_PENDING_IMPACT });
  };

  const handleValiditySave = async () => {
    const validationResult = validationSchema.safeParse(validityFormValues);

    if (!validationResult.success) {
      const validityDateError =
        validationResult.error.flatten().fieldErrors.validityDate?.[0] ?? null;
      dispatch({
        type: CERTIFICATE_VALIDITY_ACTIONS.SET_VALIDITY_DATE_ERROR,
        value: validityDateError,
      });
      return;
    }

    const certificateValidityPayload = buildCertificateValidityPayload(validationResult.data);

    dispatch({
      type: CERTIFICATE_VALIDITY_ACTIONS.SET_PENDING_VALIDITY,
      value: certificateValidityPayload,
    });

    const impact = await getValidityImpact({
      courseId,
      certificateValidity: certificateValidityPayload,
    });

    if (impact.activeCertificateCount) {
      dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_IMPACT, value: impact });
      dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_IMPACT_OPEN, value: true });

      return;
    }

    updateCourseSettings({ courseId, data: { certificateValidity: certificateValidityPayload } });
  };

  return {
    isValidityEnabled,
    validityType,
    validityValue,
    validityUnit,
    validityDate,
    validityImpact,
    isValidityImpactOpen,
    validityDateError,
    hasValidityChanges,
    isCheckingValidityImpact,
    isUpdatingCourseSettings,
    setIsValidityEnabled: (value: boolean) =>
      dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_ENABLED, value }),
    setValidityType: (value: CertificateValidityType) =>
      dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_TYPE, value }),
    setValidityValue: (value: number) =>
      dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_VALUE, value }),
    setValidityUnit: (value: CertificateValidityUnit) =>
      dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_UNIT, value }),
    setValidityDate: (value: string) =>
      dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_DATE, value }),
    setIsValidityImpactOpen: (value: boolean) =>
      dispatch({ type: CERTIFICATE_VALIDITY_ACTIONS.SET_IMPACT_OPEN, value }),
    saveValidity,
    handleValiditySave,
  };
}
