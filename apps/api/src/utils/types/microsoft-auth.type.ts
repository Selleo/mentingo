export interface MicrosoftProfile {
  id: string;
  displayName: string;
  userPrincipalName: string;
  name: {
    givenName: string;
    familyName?: string;
  };
  provider: string;
  _raw: string;
  _json: {
    id: string;
    displayName: string;
    userPrincipalName: string;
    givenName: string;
    surname?: string;
    mail?: string;
    [key: string]: any;
  };
}
