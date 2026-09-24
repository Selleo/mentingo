const originalWarn = console.warn;

console.warn = (...args: unknown[]) => {
  if (
    args.some(
      (arg) =>
        typeof arg === "string" &&
        arg.includes("[Langfuse SDK]") &&
        arg.includes("No exporter configured"),
    )
  ) {
    return;
  }

  originalWarn(...args);
};
