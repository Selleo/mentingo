export const saveEntryToNavigationHistory = (request: Request) => {
  const attemptedUrl = new URL(request.url);

  sessionStorage.setItem(
    "navigation-history",
    JSON.stringify({
      state: {
        navigationHistory: [
          {
            pathname: attemptedUrl.pathname,
            timestamp: Date.now(),
          },
        ],
      },
      version: 0,
    }),
  );
};
