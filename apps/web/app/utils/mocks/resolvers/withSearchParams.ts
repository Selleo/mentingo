import { passthrough, type ResponseResolver } from "msw";

type Predicate = (searchParams: URLSearchParams) => boolean;
type Args = Parameters<ResponseResolver>[0];

export const withSearchParams =
  (predicate: Predicate, resolver: ResponseResolver) => (args: Args) => {
    const { request } = args;
    const url = new URL(request.url);

    if (!predicate(url.searchParams)) {
      return passthrough();
    }

    return resolver(args);
  };
