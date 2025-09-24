import { HttpResponse, http } from "msw";

import { userDetailsMocks } from "~/utils/mocks/data/userDetails";
import { withSearchParams } from "~/utils/mocks/resolvers/withSearchParams";

const getUserDetails = withSearchParams(
  () => true,
  ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || "";
    const user = userDetailsMocks?.data.find((user) => user.id === userId);
    if (!user) return HttpResponse.json({}, { status: 404 });
    if (user.forbidden) return HttpResponse.json({ data: [], error: true }, { status: 403 });

    delete user.forbidden;
    return HttpResponse.json({ data: user, error: false }, { status: 200 });
  },
);

export const handlers = [http.get("/api/user/details", getUserDetails)];
