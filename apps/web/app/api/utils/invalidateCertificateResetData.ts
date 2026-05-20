import { CERTIFICATE_RESET_OPTIONS_QUERY_KEY } from "~/api/queries/useCertificateResetOptions";
import { CERTIFICATE_RESET_USERS_QUERY_KEY } from "~/api/queries/useCertificateResetUsers";
import { queryClient } from "~/api/queryClient";

export async function invalidateCertificateResetData() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [CERTIFICATE_RESET_OPTIONS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: CERTIFICATE_RESET_USERS_QUERY_KEY }),
  ]);
}
