import { afterEach } from "vitest";

// Clear localStorage between tests to prevent state leakage
afterEach(() => {
  localStorage.clear();
});
