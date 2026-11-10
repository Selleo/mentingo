export const courseReturnPath = (search: string): string | null => {
  const path = new URLSearchParams(search).get("returnTo");
  if (!path || path.includes("\\")) return null;

  try {
    const parsed = new URL(path, "https://local.invalid");
    if (
      parsed.origin !== "https://local.invalid" ||
      !/^\/course\/[^/?#]+(?:\/lesson\/[^/?#]+)?$/.test(parsed.pathname)
    ) {
      return null;
    }
    if (`${parsed.pathname}${parsed.search}${parsed.hash}` !== path) return null;
    return path;
  } catch {
    return null;
  }
};
