import type {
  CertificateValiditySetting,
  CertificateValidityType,
  CertificateValidityUnit,
} from "@repo/shared";

export const CERTIFICATE_VALIDITY_ACTIONS = {
  SYNC_FROM_SETTINGS: "syncFromSettings",
  SET_ENABLED: "setEnabled",
  SET_TYPE: "setType",
  SET_VALUE: "setValue",
  SET_UNIT: "setUnit",
  SET_DATE: "setDate",
  SET_PENDING_VALIDITY: "setPendingValidity",
  SET_IMPACT: "setImpact",
  SET_IMPACT_OPEN: "setImpactOpen",
  SET_VALIDITY_DATE_ERROR: "setValidityDateError",
  CLEAR_PENDING_IMPACT: "clearPendingImpact",
} as const;

export type CertificateValidityImpact = {
  activeCertificateCount: number;
  immediatelyExpiringCertificateCount: number;
};

export type CertificateValidityState = {
  isValidityEnabled: boolean;
  validityType: CertificateValidityType;
  validityValue: number;
  validityUnit: CertificateValidityUnit;
  validityDate: string;
  pendingValidity: CertificateValiditySetting;
  validityImpact: CertificateValidityImpact | null;
  isValidityImpactOpen: boolean;
  validityDateError: string | null;
};

export type CertificateValidityAction =
  | {
      type: typeof CERTIFICATE_VALIDITY_ACTIONS.SYNC_FROM_SETTINGS;
      certificateValidity: CertificateValiditySetting | undefined;
    }
  | { type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_ENABLED; value: boolean }
  | { type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_TYPE; value: CertificateValidityType }
  | { type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_VALUE; value: number }
  | { type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_UNIT; value: CertificateValidityUnit }
  | { type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_DATE; value: string }
  | {
      type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_PENDING_VALIDITY;
      value: CertificateValiditySetting;
    }
  | {
      type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_IMPACT;
      value: CertificateValidityImpact | null;
    }
  | { type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_IMPACT_OPEN; value: boolean }
  | { type: typeof CERTIFICATE_VALIDITY_ACTIONS.SET_VALIDITY_DATE_ERROR; value: string | null }
  | { type: typeof CERTIFICATE_VALIDITY_ACTIONS.CLEAR_PENDING_IMPACT };

export type UseCertificateValiditySettingsParams = {
  courseId: string;
  certificateValidity: CertificateValiditySetting | undefined;
};
