export enum Environment {
  PRODUCTION = "production",
  STAGING = "staging",
  DEVELOPMENT = "development",
}

export const environmentValidation = (environment: string) => {
  switch (environment) {
    case "production":
      return Environment.PRODUCTION;
    case "staging":
      return Environment.STAGING;
    default:
      return Environment.DEVELOPMENT;
  }
};
