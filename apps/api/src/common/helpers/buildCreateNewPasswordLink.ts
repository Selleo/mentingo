type CreateNewPasswordLinkParams =
  | {
      createToken: string;
      email: string;
      resetToken?: never;
    }
  | {
      createToken?: never;
      email: string;
      resetToken: string;
    };

export function buildCreateNewPasswordLink(
  baseUrl: string,
  { createToken, resetToken, email }: CreateNewPasswordLinkParams,
) {
  const query = new URLSearchParams({ email });

  if (createToken) {
    query.set("createToken", createToken);
  }

  if (resetToken) {
    query.set("resetToken", resetToken);
  }

  return `${baseUrl.replace(/\/$/, "")}/auth/create-new-password?${query.toString()}`;
}
