import { CERTIFICATE_VALIDITY_TYPES, CERTIFICATE_VALIDITY_UNITS } from "@repo/shared";
import { match } from "ts-pattern";

import {
  CERTIFICATE_VALIDITY_ACTIONS,
  type CertificateValidityAction,
  type CertificateValidityState,
} from "./certificateValiditySettings.types";

export const INITIAL_CERTIFICATE_VALIDITY_STATE: CertificateValidityState = {
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

export const certificateValidityReducer = (
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
