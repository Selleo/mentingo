/// <reference types="vitest/globals" />
import "react";

declare module "react" {
  // React 18 types lack `inert`; React 19 ships it as a boolean, so drop this on upgrade.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match React's declaration
  interface HTMLAttributes<T> {
    inert?: "";
  }
}
