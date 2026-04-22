type CreateNewPasswordLinkParams =
  | {
      createToken: string;
      resetToken?: never;
    }
  | {
      createToken?: never;
      resetToken: string;
    };

export function buildCreateNewPasswordLink(
  baseUrl: string,
  { createToken, resetToken }: CreateNewPasswordLinkParams,
) {
  const query = new URLSearchParams();

  if (createToken) query.set("createToken", createToken);
  if (resetToken) query.set("resetToken", resetToken);

  return `${baseUrl.replace(/\/$/, "")}/auth/create-new-password?${query.toString()}`;
}
