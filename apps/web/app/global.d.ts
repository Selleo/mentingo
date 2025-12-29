/// <reference types="vitest/globals" />

declare global {
  interface Window {
    ENV: Record<string, string>;
  }
}