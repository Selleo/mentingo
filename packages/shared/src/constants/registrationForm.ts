export const FORM_TYPES = {
  REGISTRATION: "registration",
} as const;

export type FormType = (typeof FORM_TYPES)[keyof typeof FORM_TYPES];

export enum FORM_FIELD_TYPES {
  CHECKBOX = "checkbox",
}

export type RegistrationFormFieldType = `${FORM_FIELD_TYPES}`;
