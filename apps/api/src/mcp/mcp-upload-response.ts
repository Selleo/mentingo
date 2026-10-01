type UploadResult = Record<string, unknown>;

/** Add a concrete destination to grants using the tenant URL bound to the MCP access token. */
export function withMcpUploadInstructions<T extends UploadResult>(
  result: T,
  mcpResourceUrl: string,
  input: Record<string, unknown>,
): T & UploadResult {
  const origin = new URL(mcpResourceUrl).origin;

  if (typeof result.uploadPath === "string" && typeof result.token === "string") {
    const uploadUrl = new URL(result.uploadPath, origin).toString();
    const scheme =
      typeof result.authorizationScheme === "string" ? result.authorizationScheme : "Bearer";
    return {
      ...result,
      uploadUrl,
      uploadRequest: {
        url: uploadUrl,
        method: result.method,
        headers: { Authorization: `${scheme} ${result.token}` },
        bodyType: "multipart/form-data",
        fileField: result.fileField,
        fields: result.fields,
        ...(result.additionalFileField ? { additionalFileField: result.additionalFileField } : {}),
      },
      acceptedFile: { filename: input.filename, mimeType: input.mimeType, sizeBytes: input.size },
      instructions: [
        "Send the local file bytes to uploadRequest.url exactly; do not replace its host with another API domain.",
        "Use uploadRequest.method and Authorization header. Send every listed field and the file under fileField as multipart form data; let the HTTP client set the Content-Type boundary.",
        "The token is valid only for this tenant, route, method and file. It expires and is consumed on one attempt; request a new grant after a failed upload.",
        "Do not send the MCP OAuth token or browser cookies to this upload endpoint.",
      ],
    };
  }

  if (typeof result.tusEndpoint === "string") {
    const uploadUrl = new URL(result.tusEndpoint, origin).toString();
    const tenantHosted = new URL(uploadUrl).origin === origin;
    return {
      ...result,
      uploadUrl,
      ...(typeof result.completePath === "string"
        ? { completeUrl: new URL(result.completePath, origin).toString() }
        : {}),
      instructions: tenantHosted
        ? "Upload to uploadUrl using the TUS protocol, returned tusHeaders and metadata. Use the same tenant host for any returned completion path; do not send multipart form data or substitute another API host."
        : "Upload directly to the returned provider uploadUrl using the TUS protocol and returned tusHeaders and metadata. Do not send the Mentingo upload grant to any other URL.",
    };
  }

  return result;
}
