import { http, HttpResponse } from "msw";

import { categories } from "../data/categories";

import { handlers as authHandlers } from "./auth";
import { handlers as courseHandlers } from "./course";
import { handlers as userHandlers } from "./userDetails";

export const handlers = [
  http.get("/api/categories", () => {
    return HttpResponse.json(categories);
  }),
  ...courseHandlers,
  ...authHandlers,
  ...userHandlers,
];
